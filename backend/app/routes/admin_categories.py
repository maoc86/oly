import re
import unicodedata

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models import Category, Product
from app.schemas import CategoryCreate, CategoryResponse
from app.utils.auth import require_permission
from app.models import User

router = APIRouter(prefix="/admin/categories", tags=["admin-categories"])


def slugify(name: str) -> str:
    name = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode("ascii")
    name = name.lower().strip()
    name = re.sub(r"[^a-z0-9]+", "-", name)
    return name.strip("-")


def _ensure_slug(db: Session, category: Category) -> None:
    """Genera un slug único a partir del nombre si no se proveyó uno."""
    if category.slug and category.slug.strip():
        return
    base = slugify(category.name) or "categoria"
    slug = base
    n = 1
    while db.query(Category).filter(Category.slug == slug, Category.id != category.id).first():
        n += 1
        slug = f"{base}-{n}"
    category.slug = slug


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("categories.manage")),
):
    return [CategoryResponse.model_validate(c) for c in db.query(Category).all()]


@router.post("", response_model=CategoryResponse)
def create_category(
    data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("categories.manage")),
):
    category = Category(**data.model_dump())
    _ensure_slug(db, category)
    db.add(category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre.")
    db.refresh(category)
    return CategoryResponse.model_validate(category)


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    data: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("categories.manage")),
):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    for field, value in data.model_dump().items():
        setattr(category, field, value)
    _ensure_slug(db, category)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre.")
    db.refresh(category)
    return CategoryResponse.model_validate(category)


@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("categories.manage")),
):
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    products_count = db.query(Product).filter(Product.category_id == category_id).count()
    if products_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"No se puede eliminar la categoría porque tiene {products_count} producto(s) asociado(s).",
        )

    db.delete(category)
    db.commit()
    return {"detail": "Categoría eliminada"}
