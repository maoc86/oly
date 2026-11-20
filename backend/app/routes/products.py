"""Catálogo público de productos."""

from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Category, Product, ProductVariant
from app.schemas import (
    CategoryResponse,
    ProductListResponse,
    ProductResponse,
    ProductVariantResponse,
)

router = APIRouter(prefix="/products", tags=["products"])
categories_router = APIRouter(prefix="/categories", tags=["categories"])


def _stock(p: Product) -> int:
    return sum(int(v.stock or 0) for v in p.variants)


def product_to_list(p: Product) -> ProductListResponse:
    return ProductListResponse(
        id=p.id,
        sku=p.sku,
        name=p.name,
        slug=p.slug,
        description=p.description,
        price=Decimal(str(p.price or 0)),
        wholesale_price=p.wholesale_price,
        offer_price=p.offer_price,
        offer_active=bool(p.offer_active),
        display_price=Decimal(str(p.get_display_price())),
        category_id=p.category_id,
        category=CategoryResponse.model_validate(p.category) if p.category else None,
        brand=p.brand,
        gender=p.gender,
        image_url=p.image_url,
        images=p.images,
        is_featured=bool(p.is_featured),
        is_new=bool(p.is_new),
        is_active=bool(p.is_active),
        stock=_stock(p),
        created_at=p.created_at,
    )


def product_to_detail(p: Product) -> ProductResponse:
    base = product_to_list(p)
    return ProductResponse(
        **base.model_dump(),
        cost=p.cost,
        variants=[ProductVariantResponse.model_validate(v) for v in p.variants],
    )


@categories_router.get("", response_model=list[CategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    """Categorías activas para la navegación y filtros de la tienda."""
    return [
        CategoryResponse.model_validate(c)
        for c in db.query(Category)
        .filter(Category.is_active == True)  # noqa: E712
        .order_by(Category.sort_order, Category.name)
        .all()
    ]


@router.get("", response_model=list[ProductListResponse])
def list_products(
    category: Optional[str] = None,
    gender: Optional[str] = None,
    brand: Optional[str] = None,
    featured: Optional[bool] = None,
    new: Optional[bool] = None,
    search: Optional[str] = None,
    sort: str = Query("newest", pattern="^(newest|price_asc|price_desc|name)$"),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(Product).options(joinedload(Product.variants), joinedload(Product.category)).filter(Product.is_active == True)  # noqa: E712

    if category:
        q = q.join(Category).filter(Category.slug == category)
    if gender:
        q = q.filter(Product.gender == gender)
    if brand:
        q = q.filter(Product.brand == brand)
    if featured is not None:
        q = q.filter(Product.is_featured == featured)
    if new is not None:
        q = q.filter(Product.is_new == new)
    if search:
        like = f"%{search.strip()}%"
        q = q.filter(Product.name.ilike(like) | Product.description.ilike(like))

    if sort == "price_asc":
        q = q.order_by(Product.price.asc())
    elif sort == "price_desc":
        q = q.order_by(Product.price.desc())
    elif sort == "name":
        q = q.order_by(Product.name.asc())
    else:
        q = q.order_by(Product.created_at.desc(), Product.id.desc())

    products = q.limit(limit).all()
    return [product_to_list(p) for p in products]


@router.get("/featured", response_model=list[ProductListResponse])
def featured_products(
    limit: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    products = (
        db.query(Product)
        .options(joinedload(Product.variants), joinedload(Product.category))
        .filter(Product.is_active == True, Product.is_featured == True)  # noqa: E712
        .order_by(Product.created_at.desc())
        .limit(limit)
        .all()
    )
    return [product_to_list(p) for p in products]


@router.get("/{identifier}", response_model=ProductResponse)
def get_product(identifier: str, db: Session = Depends(get_db)):
    q = db.query(Product).options(joinedload(Product.variants), joinedload(Product.category))
    if identifier.isdigit():
        product = q.filter(Product.id == int(identifier)).first()
    else:
        product = q.filter(Product.slug == identifier).first()
    if not product or not product.is_active:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return product_to_detail(product)
