from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import HeroSlide, User
from app.schemas import PLACEMENTS, HeroSlideCreate, HeroSlideResponse
from app.utils.auth import require_permission

router = APIRouter(tags=["hero-slides"])


@router.get("/hero-slides", response_model=list[HeroSlideResponse])
def list_hero_slides(placement: Optional[str] = None, db: Session = Depends(get_db)):
    """Slides activos del hero, en el orden configurado por el admin."""
    q = db.query(HeroSlide).filter(HeroSlide.is_active == True)  # noqa: E712
    if placement:
        q = q.filter(HeroSlide.placement == placement)
    slides = q.order_by(HeroSlide.sort_order, HeroSlide.id).all()
    return [HeroSlideResponse.model_validate(s) for s in slides]


@router.get("/admin/hero-slides", response_model=list[HeroSlideResponse])
def list_all_hero_slides(
    placement: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings.manage")),
):
    q = db.query(HeroSlide)
    if placement:
        q = q.filter(HeroSlide.placement == placement)
    return [
        HeroSlideResponse.model_validate(s)
        for s in q.order_by(HeroSlide.sort_order, HeroSlide.id).all()
    ]


@router.post("/admin/hero-slides", response_model=HeroSlideResponse)
def create_hero_slide(
    data: HeroSlideCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings.manage")),
):
    slide = HeroSlide(**data.model_dump())
    db.add(slide)
    db.commit()
    db.refresh(slide)
    return HeroSlideResponse.model_validate(slide)


@router.put("/admin/hero-slides/{slide_id}", response_model=HeroSlideResponse)
def update_hero_slide(
    slide_id: int,
    data: HeroSlideCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings.manage")),
):
    slide = db.query(HeroSlide).filter(HeroSlide.id == slide_id).first()
    if not slide:
        raise HTTPException(status_code=404, detail="Slide no encontrado")
    for field, value in data.model_dump().items():
        setattr(slide, field, value)
    db.commit()
    db.refresh(slide)
    return HeroSlideResponse.model_validate(slide)


@router.delete("/admin/hero-slides/{slide_id}")
def delete_hero_slide(
    slide_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings.manage")),
):
    slide = db.query(HeroSlide).filter(HeroSlide.id == slide_id).first()
    if not slide:
        raise HTTPException(status_code=404, detail="Slide no encontrado")
    db.delete(slide)
    db.commit()
    return {"detail": "Slide eliminado"}