"""Gestión de productos, variantes e inventario (panel admin)."""

import re
import unicodedata
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import InventoryMovement, Product, ProductVariant, User
from app.schemas import (
    InventoryMovementCreate,
    InventoryMovementResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantResponse,
    ProductVariantUpdate,
)
from app.routes.products import product_to_detail, product_to_list
from app.utils.auth import require_permission

router = APIRouter(prefix="/admin/products", tags=["admin-products"])
inventory_router = APIRouter(prefix="/admin/inventory", tags=["admin-inventory"])


def slugify(name: str) -> str:
    name = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode("ascii")
    name = name.lower().strip()
    name = re.sub(r"[^a-z0-9]+", "-", name)
    return name.strip("-")


def _unique_slug(db: Session, name: str, exclude_id: Optional[int] = None) -> str:
    base = slugify(name) or "producto"
    slug = base
    n = 1
    while True:
        q = db.query(Product).filter(Product.slug == slug)
        if exclude_id is not None:
            q = q.filter(Product.id != exclude_id)
        if not q.first():
            return slug
        n += 1
        slug = f"{base}-{n}"


# ─── Productos ───────────────────────────────────────────────────────

@router.get("", response_model=dict)
def list_products(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    q = db.query(Product).options(joinedload(Product.variants), joinedload(Product.category))
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(Product.name.ilike(like) | Product.sku.ilike(like))
    if category_id is not None:
        q = q.filter(Product.category_id == category_id)
    if is_active is not None:
        q = q.filter(Product.is_active == is_active)

    total = q.count()
    products = q.order_by(Product.created_at.desc()).offset(max(0, skip)).limit(max(1, min(limit, 500))).all()
    return {"total": total, "items": [product_to_list(p) for p in products]}


@router.post("", response_model=ProductResponse)
def create_product(
    data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    if data.sku and db.query(Product).filter(Product.sku == data.sku).first():
        raise HTTPException(status_code=400, detail="Ya existe un producto con ese SKU.")

    product = Product(
        name=name,
        slug=data.slug or _unique_slug(db, name),
        sku=(data.sku or "").strip() or None,
        description=data.description,
        price=data.price,
        wholesale_price=data.wholesale_price,
        offer_price=data.offer_price,
        offer_active=data.offer_active,
        cost=data.cost,
        category_id=data.category_id,
        brand=(data.brand or "").strip() or None,
        gender=data.gender or "mujer",
        image_url=data.image_url,
        images=data.images or [],
        is_active=data.is_active,
        is_featured=data.is_featured,
        is_new=data.is_new,
    )
    db.add(product)
    db.flush()

    for v in data.variants:
        _add_variant(db, product, v)

    db.commit()
    db.refresh(product)
    return product_to_detail(product)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    product = (
        db.query(Product)
        .options(joinedload(Product.variants), joinedload(Product.category))
        .filter(Product.id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product_to_detail(product)


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    payload = data.model_dump(exclude_unset=True)

    if "name" in payload and payload["name"] is not None:
        name = payload["name"].strip()
        if not name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
        product.name = name
        if "slug" not in payload:
            product.slug = _unique_slug(db, name, exclude_id=product.id)

    if "slug" in payload:
        product.slug = payload["slug"] or _unique_slug(db, product.name, exclude_id=product.id)

    for field in ("sku", "description", "price", "wholesale_price", "offer_price", "offer_active",
                  "cost", "category_id", "brand", "gender", "image_url", "images",
                  "is_active", "is_featured", "is_new"):
        if field in payload:
            setattr(product, field, payload[field])

    db.commit()
    db.refresh(product)
    return product_to_detail(product)


@router.delete("/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    db.delete(product)
    db.commit()
    return {"detail": "Producto eliminado"}


# ─── Variantes ───────────────────────────────────────────────────────

def _add_variant(db: Session, product: Product, data: ProductVariantCreate) -> ProductVariant:
    if data.sku and db.query(ProductVariant).filter(ProductVariant.sku == data.sku).first():
        raise HTTPException(status_code=400, detail=f"Ya existe una variante con el SKU {data.sku}.")
    variant = ProductVariant(
        product_id=product.id,
        sku=(data.sku or "").strip() or None,
        size=data.size or "Único",
        color=(data.color or "").strip() or None,
        price_override=data.price_override,
        stock=data.stock,
        min_stock=data.min_stock,
        is_active=data.is_active,
    )
    db.add(variant)
    return variant


@router.post("/{product_id}/variants", response_model=ProductVariantResponse)
def add_variant(
    product_id: int,
    data: ProductVariantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    variant = _add_variant(db, product, data)
    db.commit()
    db.refresh(variant)
    return ProductVariantResponse.model_validate(variant)


@router.put("/variants/{variant_id}", response_model=ProductVariantResponse)
def update_variant(
    variant_id: int,
    data: ProductVariantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    variant = db.query(ProductVariant).filter(ProductVariant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variante no encontrada")

    payload = data.model_dump(exclude_unset=True)
    # El stock solo se mueve por inventario; acá se permite fijar el valor directo.
    for field, value in payload.items():
        setattr(variant, field, value)
    db.commit()
    db.refresh(variant)
    return ProductVariantResponse.model_validate(variant)


@router.delete("/variants/{variant_id}")
def delete_variant(
    variant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    variant = db.query(ProductVariant).filter(ProductVariant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variante no encontrada")
    db.delete(variant)
    db.commit()
    return {"detail": "Variante eliminada"}


# ─── Inventario ──────────────────────────────────────────────────────

def _variant_label(v: ProductVariant) -> str:
    parts = [p for p in (v.size, v.color) if p]
    return " / ".join(parts) if parts else (v.sku or f"#{v.id}")


@inventory_router.get("/movements", response_model=list[InventoryMovementResponse])
def list_movements(
    product_variant_id: Optional[int] = None,
    product_id: Optional[int] = None,
    movement_type: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    q = db.query(InventoryMovement).options(
        joinedload(InventoryMovement.variant),
        joinedload(InventoryMovement.product),
        joinedload(InventoryMovement.user),
    )
    if product_variant_id:
        q = q.filter(InventoryMovement.product_variant_id == product_variant_id)
    if product_id:
        q = q.filter(InventoryMovement.product_id == product_id)
    if movement_type:
        q = q.filter(InventoryMovement.movement_type == movement_type)
    movements = q.order_by(InventoryMovement.created_at.desc(), InventoryMovement.id.desc()).limit(limit).all()
    return [
        InventoryMovementResponse(
            id=m.id,
            product_id=m.product_id,
            product_variant_id=m.product_variant_id,
            user_id=m.user_id,
            movement_type=m.movement_type,
            quantity=m.quantity,
            previous_stock=m.previous_stock,
            new_stock=m.new_stock,
            notes=m.notes,
            reference=m.reference,
            created_at=m.created_at,
            product_name=m.product.name if m.product else None,
            variant_label=_variant_label(m.variant) if m.variant else None,
            user_name=m.user.name if m.user else None,
        )
        for m in movements
    ]


@inventory_router.post("/movements", response_model=InventoryMovementResponse)
def create_movement(
    data: InventoryMovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products.manage")),
):
    variant = db.query(ProductVariant).filter(ProductVariant.id == data.product_variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variante no encontrada")

    movement_type = data.movement_type.strip().lower()
    if movement_type not in ("entry", "exit", "adjustment", "return"):
        raise HTTPException(status_code=400, detail="Tipo de movimiento inválido.")

    previous_stock = int(variant.stock or 0)
    quantity = int(data.quantity)

    if movement_type in ("entry", "return"):
        delta = quantity
        new_stock = previous_stock + quantity
    elif movement_type == "exit":
        delta = -quantity
        if quantity > previous_stock:
            raise HTTPException(status_code=400, detail="No hay stock suficiente para esta salida.")
        new_stock = previous_stock - quantity
    else:  # adjustment: quantity es el nuevo stock objetivo
        delta = quantity - previous_stock
        new_stock = quantity

    variant.stock = new_stock

    movement = InventoryMovement(
        product_id=variant.product_id,
        product_variant_id=variant.id,
        user_id=current_user.id,
        movement_type=movement_type,
        quantity=delta,
        previous_stock=previous_stock,
        new_stock=new_stock,
        notes=(data.notes or "").strip() or None,
        reference=(data.reference or "").strip() or None,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)

    return InventoryMovementResponse(
        id=movement.id,
        product_id=movement.product_id,
        product_variant_id=movement.product_variant_id,
        user_id=movement.user_id,
        movement_type=movement.movement_type,
        quantity=movement.quantity,
        previous_stock=movement.previous_stock,
        new_stock=movement.new_stock,
        notes=movement.notes,
        reference=movement.reference,
        created_at=movement.created_at,
        product_name=variant.product.name if variant.product else None,
        variant_label=_variant_label(variant),
        user_name=current_user.name,
    )
