"""Middleware de modo mantenimiento.

Cuando `maintenance_mode` está activo en la configuración del sitio, las
peticiones públicas (sin token de admin) reciben 503 con un mensaje. El panel
admin, la API de admin y /health siguen funcionando.
"""
import time
from typing import Optional

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.database import SessionLocal
from app.site_config import get_config

_CACHE: dict = {"value": False, "message": "", "eta": 0, "expires": 0.0}
_CACHE_TTL = 5.0

INTERNAL_PREFIXES = ("/admin", "/health", "/auth", "/uploads", "/docs", "/openapi", "/site-settings")


def _is_internal(path: str) -> bool:
    return any(path.startswith(p) for p in INTERNAL_PREFIXES)


def _maintenance_state() -> tuple[bool, str, int]:
    now = time.time()
    if now < _CACHE["expires"]:
        return _CACHE["value"], _CACHE["message"], _CACHE["eta"]
    try:
        db = SessionLocal()
        try:
            cfg = get_config(db)
            val = bool(cfg.get("maintenance_mode", False))
            msg = str(cfg.get("maintenance_message", "") or "Estamos realizando mejoras. Volvemos pronto.")
            eta = int(cfg.get("maintenance_eta", 0) or 0)
        finally:
            db.close()
    except Exception:
        val, msg, eta = False, "", 0
    _CACHE["value"] = val
    _CACHE["message"] = msg
    _CACHE["eta"] = eta
    _CACHE["expires"] = now + _CACHE_TTL
    return val, msg, eta


class MaintenanceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if _is_internal(path):
            return await call_next(request)

        # Permitir a los admins seguir navegando (token válido).
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            try:
                from app.utils.auth import decode_token
                from app.database import SessionLocal as _SL
                from app.models import User
                db = _SL()
                try:
                    payload = decode_token(auth.split(" ", 1)[1])
                    uid = payload.get("sub")
                    if uid is not None:
                        u = db.query(User).filter(User.id == int(uid)).first()
                        if u and u.is_active:
                            from app.permissions import has_permission
                            if has_permission(u, "admin.access"):
                                return await call_next(request)
                finally:
                    db.close()
            except Exception:
                pass

        active, msg, eta = _maintenance_state()
        if active:
            return JSONResponse(
                status_code=503,
                content={
                    "maintenance": True,
                    "message": msg,
                    "eta_minutes": eta,
                },
                headers={"Retry-After": "300"},
            )
        return await call_next(request)


def invalidate_maintenance_cache():
    _CACHE["expires"] = 0.0
