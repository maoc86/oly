"""Cupones / códigos de descuento.

El cupón se valida en el checkout (``POST /coupons/validate`` para la vista
previa) y se aplica de forma definitiva al crear la orden. El descuento se
calcula sobre el subtotal de los productos y se descuenta del total.
"""

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import (
    Coupon,
    CouponType,
    CouponUsage,
    Order,
    Product,
    ProductVariant,
    User,
)
from app.schemas import (
    CouponCreate,
    CouponResponse,
    CouponUpdate,
    CouponUsageResponse,
    CouponValidate,
    CouponValidateResponse,
)
from app.services.sales import finalize_totals
from app.utils.auth import get_current_user_optional, require_permission
from app.utils.timezone import local_now

router = APIRouter(prefix="/coupons", tags=["coupons"])
admin_router = APIRouter(prefix="/admin/coupons", tags=["admin-coupons"])


def _money(value: float) -> float:
    return round(float(value) + 1e-9, 2)


def normalize_code(code: str) -> str:
    return (code or "").strip().upper()


def _coupon_type(value) -> CouponType:
    if isinstance(value, CouponType):
        return value
    try:
        return CouponType(str(value))
    except ValueError:
        raise HTTPException(status_code=400, detail="Tipo de cupón inválido.")


def _item_product_id(item) -> Optional[int]:
    pid = getattr(item, "product_id", None)
    if pid is None:
        variant_id = getattr(item, "product_variant_id", None)
        if variant_id is not None:
            return None  # se resuelve contra BD en validate
    return pid


def _eligible_base(coupon: Coupon, *, items=None, subtotal: Optional[float] = None) -> float:
    if items:
        total = 0.0
        for item in items:
            # Restricción por producto (solo aplica a esas líneas).
            if coupon.product_id is not None:
                pid = getattr(item, "product_id", None)
                if pid is not None and pid != coupon.product_id:
                    continue
            price = getattr(item, "subtotal", None)
            if price is None:
                price = getattr(item, "unit_price", 0) or 0
            total += float(price or 0)
        return _money(total)
    return _money(subtotal or 0)


def _validate_coupon(
    coupon: Coupon,
    *,
    db: Session,
    product_id: Optional[int] = None,
    items=None,
    subtotal: Optional[float] = None,
) -> float:
    now = local_now()

    if not coupon.is_active:
        raise HTTPException(status_code=400, detail="Este cupón ya no está activo.")
    if coupon.starts_at and now < coupon.starts_at:
        raise HTTPException(status_code=400, detail="Este cupón todavía no está vigente.")
    if coupon.expires_at and now > coupon.expires_at:
        raise HTTPException(status_code=400, detail="Este cupón ya venció.")
    if coupon.usage_limit is not None and int(coupon.used_count or 0) >= int(coupon.usage_limit):
        raise HTTPException(status_code=400, detail="Este cupón alcanzó su límite de usos.")

    if coupon.product_id is not None:
        if product_id is None or int(product_id) != int(coupon.product_id):
            raise HTTPException(status_code=400, detail="Este cupón no aplica a este producto.")

    if coupon.category_id is not None:
        # La restricción por categoría se chequea contra los productos de la compra.
        matched = False
        if items:
            for item in items:
                pid = getattr(item, "product_id", None)
                if pid is None:
                    vid = getattr(item, "product_variant_id", None)
                    if vid is not None:
                        v = db.query(ProductVariant).filter(ProductVariant.id == vid).first()
                        pid = v.product_id if v else None
                if pid is not None:
                    p = db.query(Product).filter(Product.id == pid).first()
                    if p and p.category_id == coupon.category_id:
                        matched = True
                        break
        elif product_id is not None:
            p = db.query(Product).filter(Product.id == product_id).first()
            matched = bool(p and p.category_id == coupon.category_id)
        if not matched:
            raise HTTPException(status_code=400, detail="Este cupón no aplica a esta categoría.")

    base = _eligible_base(coupon, items=items, subtotal=subtotal)
    if base <= 0:
        raise HTTPException(status_code=400, detail="No hay un importe válido para aplicar el cupón.")

    if base < float(coupon.min_amount or 0):
        raise HTTPException(
            status_code=400,
            detail=f"Este cupón se aplica a compras desde ${_money(float(coupon.min_amount)):.2f}.",
        )

    ctype = _coupon_type(coupon.type)
    value = float(coupon.value or 0)
    if ctype == CouponType.PERCENTAGE:
        if value <= 0 or value > 100:
            raise HTTPException(status_code=400, detail="El porcentaje del cupón no es válido.")
        discount = base * (value / 100)
        if coupon.max_discount is not None:
            discount = min(discount, float(coupon.max_discount))
    else:
        if value <= 0:
            raise HTTPException(status_code=400, detail="El monto del cupón no es válido.")
        discount = value

    discount = _money(min(discount, base))
    if discount <= 0:
        raise HTTPException(status_code=400, detail="El cupón no genera ningún descuento.")
    return discount


def _load_coupon(db: Session, code: str, *, lock: bool = False) -> Coupon:
    query = db.query(Coupon).filter(Coupon.code == normalize_code(code))
    if lock:
        query = query.with_for_update()
    coupon = query.first()
    if not coupon:
        raise HTTPException(status_code=400, detail="El cupón no existe.")
    return coupon


def apply_coupon_to_order(
    db: Session,
    order: Order,
    code: str,
    *,
    config: dict,
    payment_method=None,
    shipping_method=None,
) -> Coupon:
    """Aplica y registra el cupón en una orden recién reservada."""
    coupon = _load_coupon(db, code, lock=True)

    items = list(order.items)
    product_id = items[0].product_id if items else None

    discount = _validate_coupon(coupon, db=db, product_id=product_id, items=items)

    order.coupon_id = coupon.id
    order.coupon_code = coupon.code
    order.discount_amount = Decimal(str(discount))

    # Recalcula descuento/impuesto/envío/total y el snapshot de cobro.
    finalize_totals(
        order,
        config=config,
        payment_method=payment_method,
        shipping_method=shipping_method,
        discount=discount,
        db=db,
    )

    coupon.used_count = int(coupon.used_count or 0) + 1
    db.add(
        CouponUsage(
            coupon_id=coupon.id,
            user_id=order.user_id,
            order_id=order.id,
            discount_amount=Decimal(str(discount)),
        )
    )
    return coupon


def release_coupon(db: Session, order: Order) -> None:
    """Devuelve el uso del cupón cuando una orden se cancela."""
    if not order.coupon_id:
        return
    coupon = (
        db.query(Coupon)
        .filter(Coupon.id == order.coupon_id)
        .with_for_update()
        .first()
    )
    if coupon:
        coupon.used_count = max(0, int(coupon.used_count or 0) - 1)
    usage = db.query(CouponUsage).filter(CouponUsage.order_id == order.id).first()
    if usage:
        db.delete(usage)


# ─── Checkout ───────────────────────────────────────────
@router.post("/validate", response_model=CouponValidateResponse)
def validate_coupon(
    data: CouponValidate,
    db: Session = Depends(get_db),
    _current_user: Optional[User] = Depends(get_current_user_optional),
):
    if not (data.code or "").strip():
        raise HTTPException(status_code=400, detail="Ingresá un código de cupón.")

    coupon = _load_coupon(db, data.code)
    discount = _validate_coupon(
        coupon,
        db=db,
        product_id=data.product_id,
        items=data.items,
        subtotal=data.subtotal,
    )
    return CouponValidateResponse(
        valid=True,
        code=coupon.code,
        type=_coupon_type(coupon.type).value,
        value=float(coupon.value or 0),
        discount=discount,
        message=f"Cupón aplicado: -${discount:.2f}",
    )


# ─── Admin ──────────────────────────────────────────────
def _serialize(coupon: Coupon) -> CouponResponse:
    return CouponResponse(
        id=coupon.id,
        code=coupon.code,
        type=_coupon_type(coupon.type).value,
        value=float(coupon.value or 0),
        min_amount=float(coupon.min_amount or 0),
        max_discount=float(coupon.max_discount) if coupon.max_discount is not None else None,
        usage_limit=coupon.usage_limit,
        used_count=int(coupon.used_count or 0),
        starts_at=coupon.starts_at,
        expires_at=coupon.expires_at,
        product_id=coupon.product_id,
        category_id=coupon.category_id,
        is_active=bool(coupon.is_active),
        created_at=coupon.created_at,
    )


def _apply_payload(db: Session, coupon: Coupon, payload: dict, *, creating: bool) -> None:
    if creating or "code" in payload:
        code = normalize_code(payload.pop("code", coupon.code if not creating else ""))
        if not code:
            raise HTTPException(status_code=400, detail="El código del cupón es obligatorio.")
        if len(code) > 50:
            raise HTTPException(status_code=400, detail="El código no puede superar 50 caracteres.")
        coupon.code = code

    if creating or "type" in payload:
        ctype = _coupon_type(payload.pop("type", coupon.type if not creating else CouponType.PERCENTAGE))
        coupon.type = ctype
    else:
        ctype = _coupon_type(coupon.type)

    if "value" in payload:
        value = float(payload.pop("value"))
        if value <= 0:
            raise HTTPException(status_code=400, detail="El valor del cupón debe ser mayor que cero.")
        if ctype == CouponType.PERCENTAGE and value > 100:
            raise HTTPException(status_code=400, detail="El porcentaje no puede superar 100.")
        coupon.value = Decimal(str(_money(value)))

    if "min_amount" in payload:
        min_amount = float(payload.pop("min_amount") or 0)
        if min_amount < 0:
            raise HTTPException(status_code=400, detail="El monto mínimo no puede ser negativo.")
        coupon.min_amount = Decimal(str(_money(min_amount)))

    if "max_discount" in payload:
        raw = payload.pop("max_discount")
        if raw is None:
            coupon.max_discount = None
        else:
            max_discount = float(raw)
            if max_discount < 0:
                raise HTTPException(status_code=400, detail="El tope de descuento no puede ser negativo.")
            coupon.max_discount = Decimal(str(_money(max_discount)))

    if "usage_limit" in payload:
        raw = payload.pop("usage_limit")
        if raw is None:
            coupon.usage_limit = None
        else:
            usage_limit = int(raw)
            if usage_limit < 1:
                raise HTTPException(status_code=400, detail="El límite de usos debe ser al menos 1.")
            coupon.usage_limit = usage_limit

    if "starts_at" in payload:
        coupon.starts_at = payload.pop("starts_at")
    if "expires_at" in payload:
        coupon.expires_at = payload.pop("expires_at")
    if "product_id" in payload:
        product_id = payload.pop("product_id")
        if product_id is not None and not db.query(Product).filter(Product.id == product_id).first():
            raise HTTPException(status_code=400, detail="El producto indicado no existe.")
        coupon.product_id = product_id
    if "category_id" in payload:
        from app.models import Category
        category_id = payload.pop("category_id")
        if category_id is not None and not db.query(Category).filter(Category.id == category_id).first():
            raise HTTPException(status_code=400, detail="La categoría indicada no existe.")
        coupon.category_id = category_id
    if "is_active" in payload:
        coupon.is_active = bool(payload.pop("is_active"))

    if coupon.starts_at and coupon.expires_at and coupon.expires_at <= coupon.starts_at:
        raise HTTPException(
            status_code=400,
            detail="La fecha de vencimiento debe ser posterior a la de inicio.",
        )


@admin_router.get("", response_model=dict)
def list_coupons(
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("coupons.manage")),
):
    query = db.query(Coupon)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(Coupon.code.ilike(like))
    if is_active is not None:
        query = query.filter(Coupon.is_active == is_active)

    total = query.count()
    coupons = (
        query.order_by(Coupon.created_at.desc())
        .offset(max(0, skip))
        .limit(max(1, min(limit, 500)))
        .all()
    )
    return {"total": total, "items": [_serialize(c) for c in coupons]}


@admin_router.post("", response_model=CouponResponse)
def create_coupon(
    data: CouponCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("coupons.manage")),
):
    coupon = Coupon()
    _apply_payload(db, coupon, data.model_dump(), creating=True)
    if db.query(Coupon).filter(Coupon.code == coupon.code).first():
        raise HTTPException(status_code=400, detail="Ya existe un cupón con ese código.")
    db.add(coupon)
    db.commit()
    db.refresh(coupon)
    return _serialize(coupon)


@admin_router.put("/{coupon_id}", response_model=CouponResponse)
def update_coupon(
    coupon_id: int,
    data: CouponUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("coupons.manage")),
):
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Cupón no encontrado.")

    _apply_payload(db, coupon, data.model_dump(exclude_unset=True), creating=False)
    duplicate = (
        db.query(Coupon)
        .filter(Coupon.code == coupon.code, Coupon.id != coupon.id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="Ya existe un cupón con ese código.")
    db.commit()
    db.refresh(coupon)
    return _serialize(coupon)


@admin_router.delete("/{coupon_id}")
def delete_coupon(
    coupon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("coupons.manage")),
):
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Cupón no encontrado.")

    if int(coupon.used_count or 0) > 0 or coupon.usages:
        coupon.is_active = False
        db.commit()
        return {"detail": "El cupón tiene usos registrados: se desactivó en lugar de eliminarse."}

    db.delete(coupon)
    db.commit()
    return {"detail": "Cupón eliminado"}


@admin_router.get("/{coupon_id}/usages", response_model=list[CouponUsageResponse])
def list_coupon_usages(
    coupon_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("coupons.manage")),
):
    coupon = db.query(Coupon).filter(Coupon.id == coupon_id).first()
    if not coupon:
        raise HTTPException(status_code=404, detail="Cupón no encontrado.")

    usages = (
        db.query(CouponUsage)
        .options(joinedload(CouponUsage.user))
        .filter(CouponUsage.coupon_id == coupon_id)
        .order_by(CouponUsage.created_at.desc())
        .all()
    )
    return [
        CouponUsageResponse(
            id=u.id,
            coupon_id=u.coupon_id,
            user_id=u.user_id,
            user_name=u.user.name if u.user else None,
            order_id=u.order_id,
            discount_amount=float(u.discount_amount or 0),
            created_at=u.created_at,
        )
        for u in usages
    ]
