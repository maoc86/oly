"""Órdenes de compra (checkout online) y gestión administrativa de ventas."""

import re
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    FinanceEntry,
    FinanceEntryType,
    InventoryMovement,
    Order,
    OrderItem,
    OrderStatus,
    PaymentMethod,
    Product,
    ProductVariant,
    ShippingMethod,
    User,
)
from app.schemas import OrderCreate, OrderResponse
from app.site_config import get_config
from app.utils.auth import get_current_user, require_permission
from app.utils.rate_limit import order_rate_limit
from app.mailer import build_order_context, send_template_email
from app.services.sales import reserve_order
from app.routes.coupons import apply_coupon_to_order, release_coupon
from app.routes.admin_finance import record_sale_income

router = APIRouter(prefix="/orders", tags=["orders"])

# Los archivos subidos se guardan con nombre `uuid4().hex + extensión`. Validar
# ese patrón evita que un cliente envíe una URL arbitraria como "comprobante".
_RECEIPT_FILENAME_RE = re.compile(r"^[0-9a-f]{32}\.(jpg|png|webp|gif|pdf)$")


def _is_valid_receipt_url(url: str) -> bool:
    path = url.split("?", 1)[0]
    if "/receipts/" not in path and "/uploads/" not in path:
        return False
    return bool(_RECEIPT_FILENAME_RE.match(path.rsplit("/", 1)[-1]))


def _order_query(db: Session):
    return db.query(Order).options(
        joinedload(Order.items).joinedload(OrderItem.product),
        joinedload(Order.items).joinedload(OrderItem.variant),
        joinedload(Order.payment_method),
        joinedload(Order.user),
    )


def _load_order(db: Session, order_id: int) -> Order:
    order = _order_query(db).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return order


@router.post("", response_model=OrderResponse)
def create_order(
    data: OrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(order_rate_limit),
):
    config = get_config(db)

    if not data.items:
        raise HTTPException(status_code=400, detail="La orden no tiene artículos.")

    pm = None
    if data.payment_method_id:
        pm = db.query(PaymentMethod).filter(PaymentMethod.id == data.payment_method_id).first()
        if not pm:
            raise HTTPException(status_code=400, detail="El método de pago no existe.")
        if not pm.is_active:
            raise HTTPException(status_code=400, detail="Ese método de pago ya no está disponible.")
        if pm.requires_reference and not (data.reference or "").strip():
            raise HTTPException(status_code=400, detail="Este método de pago requiere una referencia.")
        if pm.requires_receipt and not (data.receipt_url or "").strip():
            raise HTTPException(
                status_code=400,
                detail="Este método de pago requiere que adjuntes el comprobante de pago.",
            )

    if not data.terms_accepted:
        raise HTTPException(status_code=400, detail="Debés aceptar los términos y condiciones.")

    receipt_url = (data.receipt_url or "").strip()
    if receipt_url and not _is_valid_receipt_url(receipt_url):
        raise HTTPException(status_code=400, detail="El comprobante adjunto no es válido.")
    receipt_url = receipt_url or None

    shipping_method = None
    if data.shipping_method_id:
        shipping_method = (
            db.query(ShippingMethod).filter(ShippingMethod.id == data.shipping_method_id).first()
        )
        if not shipping_method or not shipping_method.is_active:
            raise HTTPException(status_code=400, detail="El método de envío no está disponible.")

    order = Order(
        user_id=current_user.id,
        status=OrderStatus.PENDING,
        channel="online",
        payment_method_id=data.payment_method_id,
        payment_reference=(data.reference or "").strip()[:120] or None,
        payment_receipt_url=receipt_url,
        terms_accepted_at=datetime.utcnow(),
        shipping_method_id=data.shipping_method_id,
        shipping_address=(data.shipping_address or "").strip() or None,
        shipping_city=(data.shipping_city or "").strip() or None,
        shipping_state=(data.shipping_state or "").strip() or None,
        shipping_zip=(data.shipping_zip or "").strip() or None,
        notes=(data.notes or "").strip() or None,
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
        shipping_method=shipping_method,
    )

    if (data.coupon_code or "").strip():
        apply_coupon_to_order(
            db,
            order,
            data.coupon_code,
            config=config,
            payment_method=pm,
            shipping_method=shipping_method,
        )

    # Queda PENDING: se completa cuando el admin confirma el pago.
    db.commit()
    db.refresh(order)
    send_template_email(
        db,
        "order_created",
        current_user.email,
        build_order_context(db, order, buyer_name=current_user.name),
    )
    return OrderResponse.model_validate(order)


@router.get("", response_model=list[OrderResponse])
def list_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    orders = (
        _order_query(db)
        .filter(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return [OrderResponse.model_validate(o) for o in orders]


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = (
        _order_query(db)
        .filter(Order.id == order_id, Order.user_id == current_user.id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    return OrderResponse.model_validate(order)


# ─── Administración de órdenes ────────────────────────────────────────

@router.get("/admin/all", response_model=list[OrderResponse])
def admin_list_orders(
    status: str = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.view_all")),
):
    query = _order_query(db)
    if status:
        try:
            query = query.filter(Order.status == OrderStatus(status))
        except ValueError:
            raise HTTPException(status_code=400, detail="Estado inválido")
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return [OrderResponse.model_validate(o) for o in orders]


@router.get("/admin/{order_id}", response_model=OrderResponse)
def admin_get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.view_all")),
):
    return OrderResponse.model_validate(_load_order(db, order_id))


@router.post("/admin/{order_id}/confirm", response_model=OrderResponse)
def admin_confirm_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.manage")),
):
    """El admin confirma que recibió el pago: completa la orden y registra el ingreso."""
    order = _load_order(db, order_id)
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="La orden está cancelada y no puede confirmarse.")
    if order.status == OrderStatus.COMPLETED:
        return OrderResponse.model_validate(order)

    order.status = OrderStatus.COMPLETED
    record_sale_income(db, order)
    db.commit()
    db.refresh(order)

    buyer = order.user
    if buyer:
        send_template_email(
            db,
            "payment_confirmed",
            buyer.email,
            build_order_context(db, order, buyer_name=buyer.name),
        )
    return OrderResponse.model_validate(order)


@router.post("/admin/{order_id}/cancel", response_model=OrderResponse)
def admin_cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.manage")),
):
    """Rechaza/cancela la orden: devuelve el stock y libera el cupón."""
    order = _load_order(db, order_id)
    if order.status == OrderStatus.CANCELLED:
        return OrderResponse.model_validate(order)
    if order.status == OrderStatus.COMPLETED:
        # Revierte el ingreso automático (si existía) para cerrar la cuenta.
        income_entry = db.query(FinanceEntry).filter(
            FinanceEntry.related_order_id == order.id,
            FinanceEntry.type == FinanceEntryType.INCOME,
        ).first()
        if income_entry:
            db.delete(income_entry)

    for item in order.items:
        variant = item.variant
        if variant:
            previous_stock = variant.stock
            variant.stock = (variant.stock or 0) + item.quantity
            db.add(
                InventoryMovement(
                    product_id=variant.product_id,
                    product_variant_id=variant.id,
                    user_id=current_user.id,
                    movement_type="return",
                    quantity=item.quantity,
                    previous_stock=previous_stock,
                    new_stock=variant.stock,
                    reference=f"Cancelación orden #{order.id}",
                )
            )

    order.status = OrderStatus.CANCELLED
    release_coupon(db, order)
    db.commit()
    db.refresh(order)

    buyer = order.user
    if buyer:
        send_template_email(
            db,
            "order_cancelled",
            buyer.email,
            build_order_context(db, order, buyer_name=buyer.name),
        )
    return OrderResponse.model_validate(order)
