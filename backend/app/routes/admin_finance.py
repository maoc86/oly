"""Libro de caja: ingresos (automáticos por venta + manuales) y egresos manuales.

Los importes se guardan en su moneda (amount/currency) y normalizados a USD
(amount_usd) para poder sumar el balance. Los ingresos automáticos se generan al
confirmar una orden y quedan ligados a ella. Incluye proveedores, cuentas por
pagar y pagos a proveedores.
"""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    FinanceEntry,
    FinanceEntryType,
    Order,
    OrderStatus,
    Payable,
    PayableStatus,
    PaymentMethod,
    Payout,
    User,
    Vendor,
)
from app.routes.settings_exchange import get_active_usd_rate
from app.utils.auth import require_permission

router = APIRouter(prefix="/admin/finance", tags=["admin-finance"])

SUPPORTED_CURRENCIES = ("USD", "VES")

INCOME_CATEGORIES = ["Venta", "Otro ingreso"]
EXPENSE_CATEGORIES = ["Marketing", "Operativo", "Pago a proveedores", "Salarios", "Mercancía", "Otro"]
VENDOR_CATEGORIES = ["Proveedor de ropa", "Papelería", "Hosting / Servidores", "Marketing", "Operativo", "Salarios", "Otro"]

VALID_PAYABLE_STATUS = {s.value for s in PayableStatus}


def _money(value: float) -> float:
    return round(float(value or 0) + 1e-9, 2)


def _to_usd(amount: float, currency: str, rate: Optional[float], db: Session) -> tuple[float, float]:
    currency = (currency or "USD").strip().upper()
    if currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=400, detail=f"Moneda {currency} no soportada")
    if currency == "USD":
        return _money(amount), 1.0
    r = rate
    if r is None or r <= 0:
        r = get_active_usd_rate(db)
    if r is None or r <= 0:
        raise HTTPException(
            status_code=400,
            detail="No hay tasa de cambio disponible para registrar el movimiento en bolívares.",
        )
    return _money(amount / float(r)), float(r)


def _entry_out(e: FinanceEntry) -> dict:
    return {
        "id": e.id,
        "type": e.type.value if hasattr(e.type, "value") else str(e.type),
        "amount": float(e.amount),
        "currency": e.currency,
        "rate": float(e.rate) if e.rate is not None else None,
        "amount_usd": float(e.amount_usd),
        "category": e.category,
        "description": e.description,
        "date": e.date,
        "related_order_id": e.related_order_id,
        "payment_method_id": e.payment_method_id,
        "created_at": e.created_at,
    }


class FinanceEntryIn(BaseModel):
    type: str  # "income" | "expense"
    amount: float
    currency: str = "USD"
    category: Optional[str] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    rate: Optional[float] = None
    payment_method_id: Optional[int] = None


@router.get("/categories")
def categories(current_user: User = Depends(require_permission("finance.view_all"))):
    return {
        "income": INCOME_CATEGORIES,
        "expense": EXPENSE_CATEGORIES,
        "vendors": VENDOR_CATEGORIES,
    }


@router.get("/entries")
def list_entries(
    type: Optional[str] = None,
    category: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view_all")),
):
    q = db.query(FinanceEntry)
    if type:
        try:
            q = q.filter(FinanceEntry.type == FinanceEntryType(type))
        except ValueError:
            raise HTTPException(status_code=400, detail="Tipo de movimiento inválido")
    if category:
        q = q.filter(FinanceEntry.category == category)
    if from_date:
        q = q.filter(FinanceEntry.date >= datetime.fromisoformat(from_date))
    if to_date:
        q = q.filter(FinanceEntry.date <= datetime.fromisoformat(to_date))
    if search:
        like = f"%{search}%"
        q = q.filter(
            (FinanceEntry.description.ilike(like)) | (FinanceEntry.category.ilike(like))
        )
    entries = q.order_by(FinanceEntry.date.desc(), FinanceEntry.id.desc()).offset(skip).limit(limit).all()
    return [_entry_out(e) for e in entries]


@router.get("/summary")
def summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view_all")),
):
    income = db.query(func.coalesce(func.sum(FinanceEntry.amount_usd), 0)).filter(
        FinanceEntry.type == FinanceEntryType.INCOME
    ).scalar()
    expense = db.query(func.coalesce(func.sum(FinanceEntry.amount_usd), 0)).filter(
        FinanceEntry.type == FinanceEntryType.EXPENSE
    ).scalar()

    by_category = (
        db.query(FinanceEntry.category, FinanceEntry.type, func.coalesce(func.sum(FinanceEntry.amount_usd), 0))
        .group_by(FinanceEntry.category, FinanceEntry.type)
        .all()
    )
    cats = []
    for category, t, total in by_category:
        cats.append(
            {
                "category": category or "Sin categoría",
                "type": t.value if hasattr(t, "value") else str(t),
                "total": _money(total),
            }
        )

    total_sales = _money(
        db.query(func.coalesce(func.sum(Order.total), 0))
        .filter(Order.status == OrderStatus.COMPLETED)
        .scalar()
    )
    pending_payables = _money(
        db.query(func.coalesce(func.sum(Payable.amount_usd), 0))
        .filter(Payable.status == PayableStatus.PENDING.value)
        .scalar()
    )

    return {
        "income": _money(income),
        "expense": _money(expense),
        "balance": _money(float(income) - float(expense)),
        "by_category": cats,
        "total_sales": total_sales,
        "pending_payables": pending_payables,
    }


@router.get("/balances")
def balances(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view_all")),
):
    """Saldo por cuenta (método de pago) más un balance general en USD."""
    methods = db.query(PaymentMethod).order_by(PaymentMethod.id).all()
    rows = (
        db.query(
            FinanceEntry.payment_method_id,
            FinanceEntry.type,
            FinanceEntry.currency,
            func.coalesce(func.sum(FinanceEntry.amount), 0).label("amount"),
            func.coalesce(func.sum(FinanceEntry.amount_usd), 0).label("amount_usd"),
        )
        .group_by(FinanceEntry.payment_method_id, FinanceEntry.type, FinanceEntry.currency)
        .all()
    )
    agg = {}
    gen_income = 0.0
    gen_expense = 0.0
    for pm_id, etype, currency, amount, amount_usd in rows:
        agg.setdefault(pm_id, {}).setdefault(etype, {})[currency] = (float(amount or 0), float(amount_usd or 0))
        if etype == FinanceEntryType.INCOME:
            gen_income += float(amount_usd or 0)
        elif etype == FinanceEntryType.EXPENSE:
            gen_expense += float(amount_usd or 0)

    accounts = []
    for m in methods:
        pm_agg = agg.get(m.id, {})
        income_native = expense_native = income_usd = expense_usd = 0.0
        for etype, by_currency in pm_agg.items():
            for currency, (amt, amt_usd) in by_currency.items():
                if etype == FinanceEntryType.INCOME:
                    income_native += amt
                    income_usd += amt_usd
                elif etype == FinanceEntryType.EXPENSE:
                    expense_native += amt
                    expense_usd += amt_usd
        accounts.append(
            {
                "payment_method_id": m.id,
                "name": m.name,
                "type": m.type,
                "currency": m.currency,
                "bank_name": m.bank_name,
                "account_holder": m.account_holder,
                "account_number": m.account_number,
                "income": _money(income_native),
                "expense": _money(expense_native),
                "balance": _money(income_native - expense_native),
                "income_usd": _money(income_usd),
                "expense_usd": _money(expense_usd),
                "balance_usd": _money(income_usd - expense_usd),
            }
        )

    gen_income = _money(gen_income)
    gen_expense = _money(gen_expense)
    return {
        "accounts": accounts,
        "general": {
            "income_usd": gen_income,
            "expense_usd": gen_expense,
            "balance_usd": _money(gen_income - gen_expense),
        },
    }


@router.post("/entries")
def create_entry(
    data: FinanceEntryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    if data.type not in ("income", "expense"):
        raise HTTPException(status_code=400, detail="El tipo debe ser 'income' o 'expense'")
    if data.amount is None or data.amount < 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor o igual a 0")

    amount_usd, rate = _to_usd(data.amount, data.currency, data.rate, db)
    entry = FinanceEntry(
        type=FinanceEntryType(data.type),
        amount=data.amount,
        currency=(data.currency or "USD").strip().upper(),
        rate=rate,
        amount_usd=amount_usd,
        category=(data.category or "").strip()[:60] or None,
        description=(data.description or "").strip()[:255] or None,
        date=data.date or datetime.utcnow(),
        related_order_id=None,
        payment_method_id=data.payment_method_id,
        created_by=current_user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _entry_out(entry)


@router.put("/entries/{entry_id}")
def update_entry(
    entry_id: int,
    data: FinanceEntryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    entry = db.query(FinanceEntry).filter(FinanceEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    if entry.related_order_id is not None:
        raise HTTPException(status_code=400, detail="Los movimientos automáticos de venta no se pueden editar.")

    if data.type not in ("income", "expense"):
        raise HTTPException(status_code=400, detail="El tipo debe ser 'income' o 'expense'")
    if data.amount is None or data.amount < 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor o igual a 0")

    amount_usd, rate = _to_usd(data.amount, data.currency, data.rate, db)
    entry.type = FinanceEntryType(data.type)
    entry.amount = data.amount
    entry.currency = (data.currency or "USD").strip().upper()
    entry.rate = rate
    entry.amount_usd = amount_usd
    entry.category = (data.category or "").strip()[:60] or None
    entry.description = (data.description or "").strip()[:255] or None
    entry.date = data.date or entry.date
    entry.payment_method_id = data.payment_method_id
    db.commit()
    db.refresh(entry)
    return _entry_out(entry)


@router.delete("/entries/{entry_id}")
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    entry = db.query(FinanceEntry).filter(FinanceEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Movimiento no encontrado")
    if entry.related_order_id is not None:
        raise HTTPException(status_code=400, detail="Los movimientos automáticos de venta no se pueden borrar.")
    db.delete(entry)
    db.commit()
    return {"detail": "Movimiento eliminado"}


@router.post("/sync")
def sync_sales(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    """Crea los ingresos faltantes para órdenes ya completadas (idempotente)."""
    orders = (
        db.query(Order)
        .filter(Order.status == OrderStatus.COMPLETED)
        .order_by(Order.id)
        .all()
    )
    created = 0
    for order in orders:
        existing = (
            db.query(FinanceEntry)
            .filter(
                FinanceEntry.related_order_id == order.id,
                FinanceEntry.type == FinanceEntryType.INCOME,
            )
            .first()
        )
        if existing:
            continue
        amount_usd = _money(float(order.total or 0))
        if amount_usd <= 0:
            continue
        currency = (order.payment_currency or "USD").strip().upper()
        rate = float(order.payment_rate or 0) or 1.0
        amount = float(order.payment_total or order.total or 0)
        db.add(
            FinanceEntry(
                type=FinanceEntryType.INCOME,
                amount=amount,
                currency=currency,
                rate=rate,
                amount_usd=amount_usd,
                category="Venta",
                description=f"Venta — Orden #{order.id}",
                date=order.created_at or datetime.utcnow(),
                related_order_id=order.id,
                payment_method_id=order.payment_method_id,
                created_by=current_user.id,
            )
        )
        created += 1
    db.commit()
    return {"created": created}


def record_sale_income(db: Session, order: Order) -> None:
    """Genera el ingreso automático de una orden completada (idempotente)."""
    amount_usd = _money(float(order.total or 0))
    if amount_usd <= 0:
        return
    existing = (
        db.query(FinanceEntry)
        .filter(
            FinanceEntry.related_order_id == order.id,
            FinanceEntry.type == FinanceEntryType.INCOME,
        )
        .first()
    )
    if existing:
        return
    currency = (order.payment_currency or "USD").strip().upper()
    rate = float(order.payment_rate or 0) or 1.0
    amount = float(order.payment_total or order.total or 0)
    db.add(
        FinanceEntry(
            type=FinanceEntryType.INCOME,
            amount=amount,
            currency=currency,
            rate=rate,
            amount_usd=amount_usd,
            category="Venta",
            description=f"Venta — Orden #{order.id}",
            date=datetime.utcnow(),
            related_order_id=order.id,
            payment_method_id=order.payment_method_id,
        )
    )


# ─── Proveedores (vendors) ───────────────────────────────────────────

def _vendor_out(v: Vendor) -> dict:
    return {
        "id": v.id,
        "name": v.name,
        "category": v.category,
        "phone": v.phone,
        "email": v.email,
        "rif": v.rif,
        "notes": v.notes,
        "is_active": v.is_active,
    }


def _payable_out(p: Payable) -> dict:
    return {
        "id": p.id,
        "vendor_id": p.vendor_id,
        "vendor_name": p.vendor.name if p.vendor else None,
        "description": p.description,
        "amount": float(p.amount),
        "currency": p.currency,
        "rate": float(p.rate) if p.rate is not None else None,
        "amount_usd": float(p.amount_usd),
        "due_date": p.due_date.isoformat() if p.due_date else None,
        "status": p.status,
        "created_at": p.created_at,
    }


def _payout_out(p: Payout) -> dict:
    return {
        "id": p.id,
        "vendor_id": p.vendor_id,
        "vendor_name": p.vendor.name if p.vendor else None,
        "amount": float(p.amount),
        "currency": p.currency,
        "rate": float(p.rate) if p.rate is not None else None,
        "amount_usd": float(p.amount_usd),
        "date": p.date,
        "payment_method_id": p.payment_method_id,
        "reference": p.reference,
        "note": p.note,
        "finance_entry_id": p.finance_entry_id,
    }


class VendorIn(BaseModel):
    name: str
    category: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    rif: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


class PayableIn(BaseModel):
    vendor_id: int
    description: Optional[str] = None
    amount: float
    currency: str = "USD"
    rate: Optional[float] = None
    due_date: Optional[date] = None
    status: Optional[str] = None


class PayoutIn(BaseModel):
    vendor_id: int
    amount: float
    currency: str = "USD"
    rate: Optional[float] = None
    date: Optional[datetime] = None
    payment_method_id: Optional[int] = None
    reference: Optional[str] = None
    note: Optional[str] = None
    payable_ids: Optional[list[int]] = None


@router.get("/vendor-categories")
def vendor_categories(current_user: User = Depends(require_permission("finance.view_all"))):
    return {"categories": VENDOR_CATEGORIES}


@router.get("/vendors")
def list_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view_all")),
):
    vendors = db.query(Vendor).order_by(Vendor.name.asc()).all()
    return [_vendor_out(v) for v in vendors]


@router.post("/vendors")
def create_vendor(
    data: VendorIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    v = Vendor(
        name=name,
        category=(data.category or "").strip()[:60] or None,
        phone=(data.phone or "").strip()[:50] or None,
        email=(data.email or "").strip()[:255] or None,
        rif=(data.rif or "").strip()[:40] or None,
        notes=(data.notes or "").strip() or None,
        is_active=data.is_active,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return _vendor_out(v)


@router.put("/vendors/{vendor_id}")
def update_vendor(
    vendor_id: int,
    data: VendorIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    v.name = name
    v.category = (data.category or "").strip()[:60] or None
    v.phone = (data.phone or "").strip()[:50] or None
    v.email = (data.email or "").strip()[:255] or None
    v.rif = (data.rif or "").strip()[:40] or None
    v.notes = (data.notes or "").strip() or None
    v.is_active = data.is_active
    db.commit()
    db.refresh(v)
    return _vendor_out(v)


@router.delete("/vendors/{vendor_id}")
def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    has_payables = db.query(Payable).filter(Payable.vendor_id == vendor_id).count()
    has_payouts = db.query(Payout).filter(Payout.vendor_id == vendor_id).count()
    if has_payables or has_payouts:
        raise HTTPException(status_code=400, detail="El proveedor tiene cuentas o pagos asociados; desactivalo en vez de borrarlo.")
    db.delete(v)
    db.commit()
    return {"detail": "Proveedor eliminado"}


# ─── Cuentas por pagar (payables) ────────────────────────────────────

@router.get("/payables")
def list_payables(
    vendor_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view_all")),
):
    q = db.query(Payable)
    if vendor_id:
        q = q.filter(Payable.vendor_id == vendor_id)
    if status:
        if status not in VALID_PAYABLE_STATUS:
            raise HTTPException(status_code=400, detail="Estado inválido")
        q = q.filter(Payable.status == status)
    payables = q.order_by(Payable.due_date.asc(), Payable.id.desc()).all()
    return [_payable_out(p) for p in payables]


@router.post("/payables")
def create_payable(
    data: PayableIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    vendor = db.query(Vendor).filter(Vendor.id == data.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    if data.amount is None or data.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")
    amount_usd, rate = _to_usd(data.amount, data.currency, data.rate, db)
    p = Payable(
        vendor_id=data.vendor_id,
        description=(data.description or "").strip()[:255] or None,
        amount=data.amount,
        currency=(data.currency or "USD").strip().upper(),
        rate=rate,
        amount_usd=amount_usd,
        due_date=data.due_date,
        status=PayableStatus.PENDING.value,
        created_by=current_user.id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _payable_out(p)


@router.put("/payables/{payable_id}")
def update_payable(
    payable_id: int,
    data: PayableIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    p = db.query(Payable).filter(Payable.id == payable_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Cuenta por pagar no encontrada")
    if data.amount is not None and data.amount > 0:
        amount_usd, rate = _to_usd(data.amount, data.currency, data.rate, db)
        p.amount = data.amount
        p.currency = (data.currency or "USD").strip().upper()
        p.rate = rate
        p.amount_usd = amount_usd
    p.description = (data.description or "").strip()[:255] or None
    p.due_date = data.due_date
    if data.status is not None:
        if data.status not in VALID_PAYABLE_STATUS:
            raise HTTPException(status_code=400, detail="Estado inválido")
        p.status = data.status
    db.commit()
    db.refresh(p)
    return _payable_out(p)


@router.delete("/payables/{payable_id}")
def delete_payable(
    payable_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    p = db.query(Payable).filter(Payable.id == payable_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Cuenta por pagar no encontrada")
    db.delete(p)
    db.commit()
    return {"detail": "Cuenta por pagar eliminada"}


# ─── Pagos (payouts) ─────────────────────────────────────────────────

@router.get("/payouts")
def list_payouts(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view_all")),
):
    payouts = db.query(Payout).order_by(Payout.date.desc(), Payout.id.desc()).offset(skip).limit(limit).all()
    return [_payout_out(p) for p in payouts]


@router.post("/payouts")
def create_payout(
    data: PayoutIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    if data.amount is None or data.amount <= 0:
        raise HTTPException(status_code=400, detail="El monto debe ser mayor a 0")

    vendor = db.query(Vendor).filter(Vendor.id == data.vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    amount_usd, rate = _to_usd(data.amount, data.currency, data.rate, db)
    currency = (data.currency or "USD").strip().upper()
    payout_date = data.date or datetime.utcnow()

    payout = Payout(
        vendor_id=data.vendor_id,
        amount=data.amount,
        currency=currency,
        rate=rate,
        amount_usd=amount_usd,
        date=payout_date,
        payment_method_id=data.payment_method_id,
        reference=(data.reference or "").strip()[:100] or None,
        note=(data.note or "").strip()[:255] or None,
        payable_ids=data.payable_ids or None,
        created_by=current_user.id,
    )
    db.add(payout)
    db.flush()

    entry = FinanceEntry(
        type=FinanceEntryType.EXPENSE,
        amount=data.amount,
        currency=currency,
        rate=rate,
        amount_usd=amount_usd,
        category="Pago a proveedores",
        description=f"Pago a {vendor.name}",
        date=payout_date,
        related_order_id=None,
        payment_method_id=data.payment_method_id,
        created_by=current_user.id,
    )
    db.add(entry)
    db.flush()
    payout.finance_entry_id = entry.id

    if data.payable_ids:
        payables = (
            db.query(Payable)
            .filter(
                Payable.id.in_(data.payable_ids),
                Payable.vendor_id == vendor.id,
                Payable.status == PayableStatus.PENDING.value,
            )
            .all()
        )
        for p in payables:
            p.status = PayableStatus.PAID.value

    db.commit()
    db.refresh(payout)
    return _payout_out(payout)


@router.delete("/payouts/{payout_id}")
def delete_payout(
    payout_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    payout = db.query(Payout).filter(Payout.id == payout_id).first()
    if not payout:
        raise HTTPException(status_code=404, detail="Pago no encontrado")
    # Revierte las cuentas por pagar que este pago había saldado.
    if payout.payable_ids:
        db.query(Payable).filter(
            Payable.id.in_(payout.payable_ids),
            Payable.status == PayableStatus.PAID.value,
        ).update({"status": PayableStatus.PENDING.value}, synchronize_session=False)
    if payout.finance_entry_id:
        entry = db.query(FinanceEntry).filter(FinanceEntry.id == payout.finance_entry_id).first()
        if entry:
            db.delete(entry)
    db.delete(payout)
    db.commit()
    return {"detail": "Pago eliminado"}


# ─── Resumen de proveedores (cuentas por pagar) ──────────────────────

@router.get("/payees")
def payees(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view_all")),
):
    vendor_paid = dict(
        db.query(Payout.vendor_id, func.coalesce(func.sum(Payout.amount_usd), 0))
        .filter(Payout.vendor_id.isnot(None))
        .group_by(Payout.vendor_id)
        .all()
    )
    vendor_accrued = dict(
        db.query(Payable.vendor_id, func.coalesce(func.sum(Payable.amount_usd), 0))
        .filter(Payable.status != PayableStatus.CANCELLED.value)
        .group_by(Payable.vendor_id)
        .all()
    )
    vendor_pending = dict(
        db.query(Payable.vendor_id, func.coalesce(func.sum(Payable.amount_usd), 0))
        .filter(Payable.status == PayableStatus.PENDING.value)
        .group_by(Payable.vendor_id)
        .all()
    )

    vendor_ids = set(vendor_accrued) | set(vendor_paid) | set(vendor_pending)
    result = []
    if vendor_ids:
        vendors = {v.id: v for v in db.query(Vendor).filter(Vendor.id.in_(vendor_ids)).all()}
        for vid in sorted(vendor_ids):
            accrued = _money(vendor_accrued.get(vid, 0))
            paid = _money(vendor_paid.get(vid, 0))
            v = vendors.get(vid)
            name = v.name if v else f"Proveedor #{vid}"
            result.append(
                {
                    "payee_type": "vendor",
                    "payee_id": vid,
                    "name": name,
                    "accrued": accrued,
                    "paid": paid,
                    "pending": _money(vendor_pending.get(vid, 0)),
                }
            )

    result.sort(key=lambda r: (-r["pending"], r["name"].lower()))
    totals = {
        "accrued": _money(sum(r["accrued"] for r in result)),
        "paid": _money(sum(r["paid"] for r in result)),
        "pending": _money(sum(r["pending"] for r in result)),
    }
    return {"payees": result, "totals": totals}


@router.get("/payee-options")
def payee_options(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view_all")),
):
    vendors = db.query(Vendor).filter(Vendor.is_active.is_(True)).order_by(Vendor.name.asc()).all()
    return {"vendors": [_vendor_out(v) for v in vendors]}
