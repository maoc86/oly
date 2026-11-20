from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.site_config import ConfigError, describe_fields, get_config, set_config
from app.utils.auth import require_permission

router = APIRouter(tags=["site-settings"])


@router.get("/site-settings")
def get_site_settings(db: Session = Depends(get_db)):
    """Configuración pública: el home, el navbar y el checkout la necesitan."""
    return {"values": get_config(db)}


@router.get("/admin/site-settings")
def get_admin_site_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings.manage")),
):
    """Configuración completa + metadata de los campos para armar el formulario."""
    return {"values": get_config(db), "fields": describe_fields()}


@router.put("/admin/site-settings")
def update_site_settings(
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings.manage")),
):
    """Actualización parcial: solo se tocan las claves enviadas."""
    try:
        result = {"values": set_config(db, payload)}
        try:
            from app.middleware.maintenance import invalidate_maintenance_cache
            invalidate_maintenance_cache()
        except Exception:
            pass
        return result
    except ConfigError as e:
        raise HTTPException(status_code=422, detail=str(e))