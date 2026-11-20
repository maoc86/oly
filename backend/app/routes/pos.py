"""Punto de venta (POS): venta presencial en tienda y turnos de caja.

Un usuario con rol ``vendedor`` (o un admin) vende productos del catálogo en el
mostrador. La venta se guarda como una ``Order`` completada al instante
(``channel="pos"``) para que quede contabilizada igual que una compra online.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    CashSession,
    CashSessionStatus,
    Order,
    OrderItem,
    OrderStatus,
    PaymentMethod,
    Product,
    ProductVariant,
    User,
)
from app.routes.admin_finance import record_sale_income
from app.site_config import get_config
from app.schemas import (
    CashCurrencyTotal,
    CashMethodTotal,
    CashSessionClose,
    CashSessionOpen,
    CashSessionResponse,
    CashSessionSummary,
    OrderResponse,
    PaymentMethodResponse,
    PosCatalogResponse,
    PosProductResponse,
    PosSaleCreate,
    ProductVariantResponse,
)
from app.services.sales import reserve_order, _money
from app.utils.auth import require_permission, require_vendedor

router = APIRouter(prefix="/pos", tags=["pos"])


def _session_summary(db: Session, session: CashSession) -> CashSessionSummary:
    orders = (
        db.query(Order)
        .options(joinedload(Order.payment_method), joinedload(Order.items))
        .filter(Order.cash_session_id == session.id, Order.status == OrderStatus.COMPLETED)
        .all()
    )
    totals: dict[tuple, dict] = {}
    by_currency_agg: dict[str, dict] = {}
    cash_usd = 0.0
    other_usd = 0.0
    total_usd = 0.0
    items = 0
    for o in orders:
        pm = o.payment_method
        name = pm.name if pm else "Sin método"
        currency = (o.payment_currency or "USD").upper()
        amount = float(o.payment_total if o.payment_total is not None else (o.total or 0))
        is_cash = bool(pm and pm.is_cash)
        key = (pm.id if pm else None, name, currency, is_cash)
        entry = totals.setdefault(key, {"total": 0.0, "count": 0})
        entry["total"] += amount
        entry["count"] += 1
        usd = float(o.total or 0)
        if is_cash:
            cash_usd += usd
        else:
            other_usd += usd
        total_usd += usd
        # Consolidado por moneda (en la moneda de cada método).
        cur = by_currency_agg.setdefault(currency, {"total": 0.0, "count": 0})
        cur["total"] += amount
        cur["count"] += 1
        items += sum(int(i.quantity or 0) for i in o.items)

    by_method = [
        CashMethodTotal(
            payment_method_id=key[0],
            name=key[1],
            currency=key[2],
            is_cash=key[3],
            total=Decimal(str(_money(val["total"]))),
            count=val["count"],
        )
        for key, val in sorted(totals.items(), key=lambda kv: kv[0][1])
    ]

    by_currency = [
        CashCurrencyTotal(
            currency=currency,
            total=Decimal(str(_money(val["total"]))),
            count=val["count"],
        )
        for currency, val in sorted(by_currency_agg.items())
    ]

    cash_sales = _money(cash_usd)
    return CashSessionSummary(
        expected_cash=Decimal(str(_money(float(session.opening_float or 0) + cash_sales))),
        cash_sales=Decimal(str(cash_sales)),
        other_sales=Decimal(str(_money(other_usd))),
        orders=len(orders),
        items=items,
        by_method=by_method,
        by_currency=by_currency,
        total_usd=Decimal(str(_money(total_usd))),
    )


def _session_response(db: Session, session: CashSession) -> CashSessionResponse:
    summary = _session_summary(db, session)
    counted = float(session.counted_cash) if session.counted_cash is not None else None
    difference = None
    if counted is not None:
        difference = Decimal(str(_money(counted - float(summary.expected_cash))))
    return CashSessionResponse(
        id=session.id,
        user_id=session.user_id,
        user_name=session.user.name if session.user else None,
        status=session.status.value if hasattr(session.status, "value") else str(session.status),
        opening_float=session.opening_float or Decimal("0"),
        counted_cash=session.counted_cash,
        difference=difference,
        notes=session.notes,
        opened_at=session.opened_at,
        closed_at=session.closed_at,
        summary=summary,
    )


# ─── Catálogo ────────────────────────────────────────────────────────

@router.get("/products", response_model=PosCatalogResponse)
def pos_catalog(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_vendedor),
):
    """Productos activos con sus variantes (talla/color, precio y stock)."""
    q = db.query(Product).options(joinedload(Product.variants)).filter(Product.is_active == True)  # noqa: E712
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(Product.name.ilike(like) | Product.sku.ilike(like))
    products = q.order_by(Product.name).limit(500).all()

    out = []
    for p in products:
        variants = [ProductVariantResponse.model_validate(v) for v in p.variants if v.is_active]
        out.append(
            PosProductResponse(
                id=p.id,
                name=p.name,
                sku=p.sku,
                image_url=p.image_url,
                display_price=Decimal(str(p.get_display_price())),
                variants=variants,
            )
        )
    return PosCatalogResponse(products=out)


@router.get("/payment-methods", response_model=list[PaymentMethodResponse])
def list_pos_payment_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_vendedor),
):
    methods = (
        db.query(PaymentMethod)
        .filter(
            PaymentMethod.is_active == True,  # noqa: E712
            PaymentMethod.available_at_pos == True,  # noqa: E712
        )
        .order_by(PaymentMethod.name)
        .all()
    )
    return [PaymentMethodResponse.model_validate(m) for m in methods]


# ─── Venta directa ───────────────────────────────────────────────────

@router.post("/sales", response_model=OrderResponse)
def create_pos_sale(
    data: PosSaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_vendedor),
):
    session = (
        db.query(CashSession)
        .filter(
            CashSession.user_id == current_user.id,
            CashSession.status == CashSessionStatus.OPEN,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=400, detail="Tenés que abrir la caja antes de vender.")

    pm = db.query(PaymentMethod).filter(PaymentMethod.id == data.payment_method_id).first()
    if not pm:
        raise HTTPException(status_code=400, detail="El método de pago no existe.")
    if not pm.is_active:
        raise HTTPException(status_code=400, detail="Ese método de pago ya no está disponible.")
    if not pm.available_at_pos:
        raise HTTPException(status_code=400, detail="Ese método de pago no está habilitado para el POS.")

    config = get_config(db)

    order = Order(
        user_id=current_user.id,
        status=OrderStatus.PENDING,
        channel="pos",
        sold_by_id=current_user.id,
        buyer_name=(data.buyer.name or "").strip() or None,
        buyer_cedula=(data.buyer.cedula or "").strip() or None,
        buyer_phone=(data.buyer.phone or "").strip() or None,
        buyer_email=(data.buyer.email or "").strip() or None,
        payment_method_id=pm.id,
        payment_reference=(data.reference or "").strip()[:120] or None,
        terms_accepted_at=datetime.utcnow(),
        cash_session_id=session.id,
        total=0,
    )
    db.add(order)
    db.flush()

    reserve_order(
        db,
        order,
        items=data.items,
        config=config,
        payment_method=pm,
        is_pos=True,
    )

    order.status = OrderStatus.COMPLETED
    record_sale_income(db, order)
    db.commit()
    db.refresh(order)

    return OrderResponse.model_validate(order)


@router.get("/sales", response_model=list[OrderResponse])
def list_pos_sales(
    cash_session_id: Optional[int] = None,
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_vendedor),
):
    q = (
        db.query(Order)
        .options(
            joinedload(Order.items).joinedload(OrderItem.product),
            joinedload(Order.items).joinedload(OrderItem.variant),
            joinedload(Order.payment_method),
        )
        .filter(Order.channel == "pos")
        .filter(Order.sold_by_id == current_user.id)
    )
    if cash_session_id:
        q = q.filter(Order.cash_session_id == cash_session_id)
    orders = q.order_by(Order.created_at.desc(), Order.id.desc()).limit(limit).all()
    return [OrderResponse.model_validate(o) for o in orders]


# ─── Caja (turnos) ───────────────────────────────────────────────────

@router.get("/cash/current", response_model=Optional[CashSessionResponse])
def current_cash_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pos.cash.manage")),
):
    session = (
        db.query(CashSession)
        .filter(
            CashSession.user_id == current_user.id,
            CashSession.status == CashSessionStatus.OPEN,
        )
        .order_by(CashSession.opened_at.desc())
        .first()
    )
    if not session:
        return None
    return _session_response(db, session)


@router.post("/cash/open", response_model=CashSessionResponse)
def open_cash_session(
    data: CashSessionOpen,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pos.cash.manage")),
):
    existing = (
        db.query(CashSession)
        .filter(
            CashSession.user_id == current_user.id,
            CashSession.status == CashSessionStatus.OPEN,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ya tenés una caja abierta.")
    if data.opening_float is not None and data.opening_float < 0:
        raise HTTPException(status_code=400, detail="El fondo inicial no puede ser negativo.")

    session = CashSession(
        user_id=current_user.id,
        status=CashSessionStatus.OPEN,
        opening_float=data.opening_float or Decimal("0"),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_response(db, session)


@router.get("/cash/sessions", response_model=list[CashSessionResponse])
def list_cash_sessions(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pos.cash.manage")),
):
    sessions = (
        db.query(CashSession)
        .filter(CashSession.user_id == current_user.id)
        .order_by(CashSession.opened_at.desc())
        .limit(limit)
        .all()
    )
    return [_session_response(db, s) for s in sessions]


@router.get("/cash/{session_id}", response_model=CashSessionResponse)
def get_cash_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pos.cash.manage")),
):
    session = db.query(CashSession).filter(CashSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    if session.user_id != current_user.id and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="No autorizado")
    return _session_response(db, session)


@router.post("/cash/{session_id}/close", response_model=CashSessionResponse)
def close_cash_session(
    session_id: int,
    data: CashSessionClose,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("pos.cash.manage")),
):
    session = db.query(CashSession).filter(CashSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Caja no encontrada")
    if session.user_id != current_user.id and not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="No autorizado")
    if session.status == CashSessionStatus.CLOSED:
        raise HTTPException(status_code=400, detail="Esta caja ya está cerrada.")
    if data.counted_cash is not None and data.counted_cash < 0:
        raise HTTPException(status_code=400, detail="El efectivo contado no puede ser negativo.")

    session.counted_cash = data.counted_cash or Decimal("0")
    session.notes = (data.notes or "").strip() or None
    session.status = CashSessionStatus.CLOSED
    session.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return _session_response(db, session)


def _is_admin(user: User) -> bool:
    from app.permissions import is_admin
    return is_admin(user)
