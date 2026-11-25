"""Análisis de costos y precios de venta.

Permite configurar gastos operativos, gastos fijos, margen de ganancia e impuestos
para calcular el "costo de venta" (precio sugerido) de cada producto. El costo del
producto se toma de la configuración existente (Product.cost).

La configuración se guarda en la tabla `settings` con la clave `costing_config`.
"""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Product, Setting, User
from app.routes.admin_products import product_to_detail, product_to_list
from app.utils.auth import require_permission

router = APIRouter(prefix="/admin/costing", tags=["admin-costing"])

CONFIG_KEY = "costing_config"

DEFAULT_CONFIG = {
    "operational_expenses": 0.0,   # gastos operativos mensuales (USD)
    "fixed_expenses": 0.0,         # gastos fijos mensuales (USD)
    "estimated_monthly_units": 1,   # volumen estimado de ventas mensual (unidades)
    "profit_margin_percent": 0.0,  # margen de ganancia %
    "tax_rate_percent": 0.0,       # impuesto %
}


def _get_config(db: Session) -> dict:
    row = db.query(Setting).filter(Setting.key == CONFIG_KEY).first()
    cfg = dict(DEFAULT_CONFIG)
    if row and row.value:
        try:
            stored = json.loads(row.value)
            if isinstance(stored, dict):
                for k in DEFAULT_CONFIG:
                    if k in stored:
                        cfg[k] = stored[k]
        except (json.JSONDecodeError, TypeError):
            pass
    # Normalizar tipos
    cfg["operational_expenses"] = float(cfg.get("operational_expenses") or 0)
    cfg["fixed_expenses"] = float(cfg.get("fixed_expenses") or 0)
    cfg["estimated_monthly_units"] = max(1, int(cfg.get("estimated_monthly_units") or 1))
    cfg["profit_margin_percent"] = float(cfg.get("profit_margin_percent") or 0)
    cfg["tax_rate_percent"] = float(cfg.get("tax_rate_percent") or 0)
    return cfg


def _set_config(db: Session, cfg: dict) -> dict:
    merged = _get_config(db)
    for k in DEFAULT_CONFIG:
        if k in cfg and cfg[k] is not None:
            merged[k] = cfg[k]
    # Normalizar
    merged["operational_expenses"] = float(merged.get("operational_expenses") or 0)
    merged["fixed_expenses"] = float(merged.get("fixed_expenses") or 0)
    merged["estimated_monthly_units"] = max(1, int(merged.get("estimated_monthly_units") or 1))
    merged["profit_margin_percent"] = float(merged.get("profit_margin_percent") or 0)
    merged["tax_rate_percent"] = float(merged.get("tax_rate_percent") or 0)

    row = db.query(Setting).filter(Setting.key == CONFIG_KEY).first()
    if row:
        row.value = json.dumps(merged)
        row.updated_at = __import__("datetime").datetime.utcnow()
    else:
        db.add(Setting(key=CONFIG_KEY, value=json.dumps(merged)))
    db.commit()
    return merged


def _money(v: float) -> float:
    return round(float(v or 0), 2)


def _calc_item(product: Product, cfg: dict) -> dict:
    product_cost = float(product.cost) if product.cost is not None else 0.0
    units = max(1, cfg["estimated_monthly_units"])
    allocated_op = cfg["operational_expenses"] / units
    allocated_fixed = cfg["fixed_expenses"] / units
    total_cost = product_cost + allocated_op + allocated_fixed

    margin_pct = cfg["profit_margin_percent"]
    margin_amount = total_cost * (margin_pct / 100.0)
    price_before_tax = total_cost + margin_amount

    tax_pct = cfg["tax_rate_percent"]
    tax_amount = price_before_tax * (tax_pct / 100.0)
    suggested_price = price_before_tax + tax_amount

    current_price = float(product.price) if product.price is not None else 0.0
    difference = suggested_price - current_price

    if total_cost > 0:
        margin_on_current = ((current_price - total_cost) / total_cost) * 100.0
    else:
        margin_on_current = 0.0

    return {
        "product_id": product.id,
        "name": product.name,
        "sku": product.sku,
        "image_url": product.image_url,
        "category": product.category.name if product.category else None,
        "category_id": product.category_id,
        "is_active": product.is_active,
        "product_cost": _money(product_cost),
        "allocated_operational": _money(allocated_op),
        "allocated_fixed": _money(allocated_fixed),
        "total_cost": _money(total_cost),
        "profit_margin_percent": margin_pct,
        "margin_amount": _money(margin_amount),
        "price_before_tax": _money(price_before_tax),
        "tax_rate_percent": tax_pct,
        "tax_amount": _money(tax_amount),
        "suggested_price": _money(suggested_price),
        "current_price": _money(current_price),
        "difference": _money(difference),
        "margin_on_current_percent": round(margin_on_current, 2),
        "has_cost": product.cost is not None,
    }


class CostingConfigIn(BaseModel):
    operational_expenses: Optional[float] = None
    fixed_expenses: Optional[float] = None
    estimated_monthly_units: Optional[int] = None
    profit_margin_percent: Optional[float] = None
    tax_rate_percent: Optional[float] = None


class CostingConfigOut(BaseModel):
    operational_expenses: float
    fixed_expenses: float
    estimated_monthly_units: int
    profit_margin_percent: float
    tax_rate_percent: float


class ApplyPriceIn(BaseModel):
    price: float
    round_to: Optional[float] = None  # e.g. 0.5, 1, 5, 10


@router.get("/config", response_model=CostingConfigOut)
def get_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view_all")),
):
    cfg = _get_config(db)
    return CostingConfigOut(**cfg)


@router.put("/config", response_model=CostingConfigOut)
def update_config(
    data: CostingConfigIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    payload = data.model_dump(exclude_unset=True)
    cfg = _set_config(db, payload)
    return CostingConfigOut(**cfg)


@router.get("/analysis")
def analysis(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.view_all")),
):
    cfg = _get_config(db)
    q = db.query(Product).options(joinedload(Product.category))
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(Product.name.ilike(like) | Product.sku.ilike(like))
    if category_id is not None:
        q = q.filter(Product.category_id == category_id)
    if is_active is not None:
        q = q.filter(Product.is_active == is_active)

    total = q.count()
    products = q.order_by(Product.name.asc()).offset(max(0, skip)).limit(max(1, min(limit, 500))).all()

    items = [_calc_item(p, cfg) for p in products]

    # Summary
    with_cost = [i for i in items if i["has_cost"]]
    avg_total_cost = (sum(i["total_cost"] for i in items) / len(items)) if items else 0
    avg_margin_current = (sum(i["margin_on_current_percent"] for i in with_cost) / len(with_cost)) if with_cost else 0

    return {
        "config": cfg,
        "total": total,
        "items": items,
        "summary": {
            "total_products": total,
            "products_with_cost": len(with_cost),
            "products_without_cost": total - len(with_cost),
            "avg_total_cost": _money(avg_total_cost),
            "avg_margin_on_current_percent": round(avg_margin_current, 2),
        },
    }


@router.post("/apply/{product_id}")
def apply_price(
    product_id: int,
    data: ApplyPriceIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("finance.manage")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    price = float(data.price)
    if data.round_to and data.round_to > 0:
        import math
        price = math.ceil(price / data.round_to) * data.round_to

    product.price = price
    db.commit()
    db.refresh(product)
    return {"detail": "Precio actualizado", "product_id": product.id, "new_price": float(product.price)}
