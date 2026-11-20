from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.database import get_db
from app.models import Category, Product
from app.schemas import CategoryCreate, CategoryResponse
from app.utils.auth import require_permission
from app.models import User

router = APIRouter(prefix="/admin/categories", tags=["admin-categories"])


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
