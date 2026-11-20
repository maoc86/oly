"""Productos favoritos del cliente."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Favorite, Product, User
from app.schemas import FavoriteResponse, ProductListResponse
from app.routes.products import product_to_list
from app.utils.auth import get_current_user

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[FavoriteResponse])
def list_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    favorites = (
        db.query(Favorite)
        .options(joinedload(Favorite.product).joinedload(Product.variants), joinedload(Favorite.product).joinedload(Product.category))
        .filter(Favorite.user_id == current_user.id)
        .order_by(Favorite.created_at.desc())
        .all()
    )
    return [
        FavoriteResponse(
            id=f.id,
            product_id=f.product_id,
            created_at=f.created_at,
            product=product_to_list(f.product) if f.product else None,
        )
        for f in favorites
    ]


@router.post("/{product_id}", response_model=FavoriteResponse)
def add_favorite(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id, Product.is_active == True).first()  # noqa: E712
    if not product:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    existing = db.query(Favorite).filter(Favorite.user_id == current_user.id, Favorite.product_id == product_id).first()
    if existing:
        return FavoriteResponse(id=existing.id, product_id=product_id, created_at=existing.created_at)

    fav = Favorite(user_id=current_user.id, product_id=product_id)
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return FavoriteResponse(id=fav.id, product_id=product_id, created_at=fav.created_at)


@router.delete("/{product_id}")
def remove_favorite(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    fav = db.query(Favorite).filter(Favorite.user_id == current_user.id, Favorite.product_id == product_id).first()
    if not fav:
        raise HTTPException(status_code=404, detail="Favorito no encontrado")
    db.delete(fav)
    db.commit()
    return {"detail": "Favorito eliminado"}
