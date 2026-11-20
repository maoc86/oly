from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PaymentMethod, Order, FinanceEntry
from app.schemas import PaymentMethodCreate, PaymentMethodResponse
from app.utils.auth import require_permission
from app.models import User

router = APIRouter(prefix="/admin/payment-methods", tags=["admin-payments"])


@router.get("", response_model=list[PaymentMethodResponse])
def list_payment_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.manage")),
):
    return [PaymentMethodResponse.model_validate(p) for p in db.query(PaymentMethod).all()]


@router.post("", response_model=PaymentMethodResponse)
def create_payment_method(
    data: PaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.manage")),
):
    pm = PaymentMethod(**data.model_dump())
    db.add(pm)
    db.commit()
    db.refresh(pm)
    return PaymentMethodResponse.model_validate(pm)


@router.put("/{pm_id}", response_model=PaymentMethodResponse)
def update_payment_method(
    pm_id: int,
    data: PaymentMethodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.manage")),
):
    pm = db.query(PaymentMethod).filter(PaymentMethod.id == pm_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Método de pago no encontrado")
    for field, value in data.model_dump().items():
        setattr(pm, field, value)
    db.commit()
    db.refresh(pm)
    return PaymentMethodResponse.model_validate(pm)


@router.delete("/{pm_id}")
def delete_payment_method(
    pm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.manage")),
):
    pm = db.query(PaymentMethod).filter(PaymentMethod.id == pm_id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Método de pago no encontrado")
    # Desvincula las órdenes y movimientos de caja que usaban este método, para no
    # romper la FK al borrarlo (esas órdenes quedan sin método asociado).
    db.query(Order).filter(Order.payment_method_id == pm_id).update({"payment_method_id": None})
    db.query(FinanceEntry).filter(FinanceEntry.payment_method_id == pm_id).update({"payment_method_id": None})
    db.delete(pm)
    db.commit()
    return {"detail": "Método de pago eliminado"}
