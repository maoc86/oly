"""Métodos de envío (público + admin)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ShippingMethod, User
from app.schemas import ShippingMethodCreate, ShippingMethodResponse
from app.utils.auth import require_permission

router = APIRouter(prefix="/shipping-methods", tags=["shipping"])
admin_router = APIRouter(prefix="/admin/shipping-methods", tags=["admin-shipping"])


@router.get("", response_model=list[ShippingMethodResponse])
def list_active_shipping_methods(db: Session = Depends(get_db)):
    methods = (
        db.query(ShippingMethod)
        .filter(ShippingMethod.is_active == True)  # noqa: E712
        .order_by(ShippingMethod.price.asc())
        .all()
    )
    return [ShippingMethodResponse.model_validate(m) for m in methods]


@admin_router.get("", response_model=list[ShippingMethodResponse])
def list_shipping_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("shipping.manage")),
):
    return [ShippingMethodResponse.model_validate(m) for m in db.query(ShippingMethod).order_by(ShippingMethod.price.asc()).all()]


@admin_router.post("", response_model=ShippingMethodResponse)
def create_shipping_method(
    data: ShippingMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("shipping.manage")),
):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    m = ShippingMethod(
        name=name,
        price=data.price,
        currency=data.currency or "USD",
        description=(data.description or "").strip() or None,
        estimated_days=(data.estimated_days or "").strip() or None,
        is_active=data.is_active,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return ShippingMethodResponse.model_validate(m)


@admin_router.put("/{method_id}", response_model=ShippingMethodResponse)
def update_shipping_method(
    method_id: int,
    data: ShippingMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("shipping.manage")),
):
    m = db.query(ShippingMethod).filter(ShippingMethod.id == method_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Método de envío no encontrado")
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    m.name = name
    m.price = data.price
    m.currency = data.currency or "USD"
    m.description = (data.description or "").strip() or None
    m.estimated_days = (data.estimated_days or "").strip() or None
    m.is_active = data.is_active
    db.commit()
    db.refresh(m)
    return ShippingMethodResponse.model_validate(m)


@admin_router.delete("/{method_id}")
def delete_shipping_method(
    method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("shipping.manage")),
):
    m = db.query(ShippingMethod).filter(ShippingMethod.id == method_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Método de envío no encontrado")
    db.delete(m)
    db.commit()
    return {"detail": "Método de envío eliminado"}
