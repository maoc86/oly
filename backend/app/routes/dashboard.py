import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import (
    Category,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductVariant,
    User,
)
from app.schemas import DashboardStats, OrderResponse
from app.utils.auth import require_admin
from sqlalchemy.orm import joinedload

router = APIRouter(prefix="/admin/dashboard", tags=["admin-dashboard"])

# Caché en memoria con TTL (evita re-ejecutar las queries por visita).
_CACHE: dict = {"data": None, "expires": 0.0}
_CACHE_TTL = 30.0


def invalidate_dashboard_cache():
    _CACHE["data"] = None
    _CACHE["expires"] = 0.0


@router.get("", response_model=DashboardStats)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    now = time.time()
    if _CACHE["data"] is not None and now < _CACHE["expires"]:
        return _CACHE["data"]

    total_products = db.query(func.count(Product.id)).scalar()
    total_categories = db.query(func.count(Category.id)).scalar()
    total_users = db.query(func.count(User.id)).scalar()

    total_orders = db.query(func.count(Order.id)).filter(Order.status == OrderStatus.COMPLETED).scalar()
    pending_orders = db.query(func.count(Order.id)).filter(Order.status == OrderStatus.PENDING).scalar()
    total_revenue = (
        db.query(func.coalesce(func.sum(Order.total), 0))
        .filter(Order.status == OrderStatus.COMPLETED)
        .scalar()
    )

    # Artículos vendidos (de órdenes completadas).
    total_items_sold = (
        db.query(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order, Order.id == OrderItem.order_id)
        .filter(Order.status == OrderStatus.COMPLETED)
        .scalar()
    )

    # Variantes con stock por debajo del mínimo.
    low_stock = (
        db.query(func.count(ProductVariant.id))
        .filter(ProductVariant.stock <= ProductVariant.min_stock, ProductVariant.min_stock > 0)
        .scalar()
    )

    recent_orders = (
        db.query(Order)
        .options(joinedload(Order.user), joinedload(Order.items).joinedload(OrderItem.product))
        .order_by(Order.created_at.desc())
        .limit(5)
        .all()
    )

    result = DashboardStats(
        total_products=total_products,
        total_categories=total_categories,
        total_users=total_users,
        total_orders=total_orders,
        pending_orders=pending_orders,
        total_revenue=total_revenue,
        total_items_sold=int(total_items_sold or 0),
        low_stock=int(low_stock or 0),
        recent_orders=[OrderResponse.model_validate(o) for o in recent_orders],
    )
    _CACHE["data"] = result
    _CACHE["expires"] = time.time() + _CACHE_TTL
    return result
