"""Base de datos de clientes (panel admin)."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Customer, User
from app.schemas import CustomerCreate, CustomerResponse
from app.utils.auth import require_permission

router = APIRouter(prefix="/admin/customers", tags=["admin-customers"])


@router.get("", response_model=list[CustomerResponse])
def list_customers(
    search: Optional[str] = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.view_all")),
):
    q = db.query(Customer)
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(Customer.name.ilike(like) | Customer.email.ilike(like) | Customer.phone.ilike(like))
    customers = q.order_by(Customer.name.asc()).limit(limit).all()
    return [CustomerResponse.model_validate(c) for c in customers]


@router.post("", response_model=CustomerResponse)
def create_customer(
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.view_all")),
):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    customer = Customer(
        name=name,
        email=(data.email or "").strip() or None,
        phone=(data.phone or "").strip() or None,
        cedula=(data.cedula or "").strip() or None,
        address=(data.address or "").strip() or None,
        notes=(data.notes or "").strip() or None,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.view_all")),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    customer.name = name
    customer.email = (data.email or "").strip() or None
    customer.phone = (data.phone or "").strip() or None
    customer.cedula = (data.cedula or "").strip() or None
    customer.address = (data.address or "").strip() or None
    customer.notes = (data.notes or "").strip() or None
    db.commit()
    db.refresh(customer)
    return CustomerResponse.model_validate(customer)


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("orders.view_all")),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    db.delete(customer)
    db.commit()
    return {"detail": "Cliente eliminado"}
