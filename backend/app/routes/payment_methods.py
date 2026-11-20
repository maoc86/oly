from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PaymentMethod
from app.schemas import PaymentMethodPublic

router = APIRouter(prefix="/payment-methods", tags=["payment-methods"])


@router.get("", response_model=list[PaymentMethodPublic])
def list_active_payment_methods(db: Session = Depends(get_db)):
    methods = (
        db.query(PaymentMethod)
        .filter(PaymentMethod.is_active == True)  # noqa: E712
        .all()
    )
    return [PaymentMethodPublic.model_validate(p) for p in methods]
