import asyncio
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime
import httpx

from app.database import get_db
from app.models import Setting
from app.models import User
from app.utils.auth import get_current_user, require_permission

router = APIRouter(prefix="/settings", tags=["settings"])

# Clave en la tabla settings donde se guarda la configuración de la tasa activa.
ACTIVE_RATE_KEY = "active_exchange_rate"

# Fuentes disponibles de la API (para resolución de la tasa activa).
API_SOURCES = [
    {"moneda": "USD", "fuente": "oficial", "nombre": "Dólar Oficial"},
    {"moneda": "USD", "fuente": "paralelo", "nombre": "Dólar Paralelo"},
    {"moneda": "EUR", "fuente": "oficial", "nombre": "Euro Oficial"},
    {"moneda": "EUR", "fuente": "paralelo", "nombre": "Euro Paralelo"},
]

DOLLARAPI_URL = "https://ve.dolarapi.com"
RESOLUTION_CACHE_SECS = 60


def get_setting(db: Session, key: str) -> Optional[str]:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else None


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.query(Setting).filter(Setting.key == key).first()
    if row:
        row.value = value
        row.updated_at = datetime.utcnow()
    else:
        db.add(Setting(key=key, value=value))
    db.commit()


async def fetch_api_rates() -> dict:
    async with httpx.AsyncClient(timeout=10.0) as client:
        dolares = (await client.get(f"{DOLLARAPI_URL}/v1/dolares")).json()
        euros = (await client.get(f"{DOLLARAPI_URL}/v1/euros")).json()
    return {"dolares": dolares, "euros": euros}


async def resolve_active_value(config: dict) -> Optional[float]:
    """Devuelve el valor (Bs. por unidad) de la tasa activa configurada."""
    kind = config.get("kind")
    if kind == "manual":
        try:
            value = float(config.get("value"))
        except (TypeError, ValueError):
            return None
        return value

    if kind == "api":
        moneda = config.get("moneda")
        fuente = config.get("fuente")
        try:
            rates = await fetch_api_rates()
        except Exception:
            return None
        pool = rates["dolares"] if moneda == "USD" else rates["euros"]
        for r in pool:
            if r.get("fuente") == fuente:
                v = r.get("promedio")
                return float(v) if v is not None else None
        return None
    return None


_rate_cache: Optional[tuple] = None
RATE_CACHE_SECS = 60


def get_active_usd_rate(db: Session) -> Optional[float]:
    """Tasa activa en Bs. por 1 USD, o None si no hay una tasa utilizable.

    Solo se usa la tasa configurada si está basada en USD o es manual: con una
    tasa en EUR no hay un cruce confiable con la API actual. Se cachea 60s para no
    llamar a la API externa en cada orden creada.
    """
    global _rate_cache
    now = time.monotonic()
    if _rate_cache and now - _rate_cache[0] < RATE_CACHE_SECS:
        return _rate_cache[1]

    raw = get_setting(db, ACTIVE_RATE_KEY)
    config = {}
    if raw:
        try:
            config = _parse_json(raw)
        except Exception:
            config = {}

    rate = None
    if config.get("moneda") in (None, "", "USD"):
        # Los endpoints que la usan corren como sync en un hilo sin event loop.
        rate = asyncio.run(resolve_active_value(config))
    _rate_cache = (now, rate)
    return rate


class ExchangeConfigIn(BaseModel):
    kind: str  # "api" | "manual"
    moneda: Optional[str] = None
    fuente: Optional[str] = None
    value: Optional[float] = None


class ExchangeConfigOut(BaseModel):
    kind: str
    moneda: Optional[str] = None
    fuente: Optional[str] = None
    nombre: Optional[str] = None
    value: Optional[float] = None
    rate: Optional[float] = None
    updated_at: Optional[datetime] = None


def _to_out(config: dict) -> ExchangeConfigOut:
    nombre = None
    if config.get("kind") == "api":
        for s in API_SOURCES:
            if s["moneda"] == config.get("moneda") and s["fuente"] == config.get("fuente"):
                nombre = s["nombre"]
                break
    return ExchangeConfigOut(
        kind=config.get("kind", "api"),
        moneda=config.get("moneda"),
        fuente=config.get("fuente"),
        nombre=nombre,
        value=config.get("value"),
        rate=config.get("_resolved_rate"),
        updated_at=config.get("updated_at"),
    )


@router.get("/exchange")
async def get_active_exchange(db: Session = Depends(get_db)):
    """Devuelve la tasa activa configurada + las cotizaciones actuales de la API."""
    raw = get_setting(db, ACTIVE_RATE_KEY)
    config = {}
    if raw:
        try:
            config = _parse_json(raw)
        except Exception:
            config = {}

    rates = {}
    try:
        api_rates = await fetch_api_rates()
        rates = api_rates
    except Exception:
        rates = {"dolares": [], "euros": []}

    # Resuelve el valor en Bs. de la tasa activa (con cache corto).
    resolved = await resolve_active_value(config)
    config["_resolved_rate"] = resolved

    sources = [
        {"moneda": s["moneda"], "fuente": s["fuente"], "nombre": s["nombre"]}
        for s in API_SOURCES
    ]

    return {
        "active": _to_out(config),
        "rates": rates,
        "sources": sources,
    }


@router.post("/exchange")
async def set_active_exchange(
    payload: ExchangeConfigIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings.manage")),
):
    """Guarda la tasa activa (por API o manual) elegida por el admin."""
    data = {"kind": payload.kind}
    if payload.kind == "api":
        if not payload.moneda or not payload.fuente:
            raise HTTPException(status_code=400, detail="Se necesitan moneda y fuente para una tasa de API")
        data["moneda"] = payload.moneda
        data["fuente"] = payload.fuente
    elif payload.kind == "manual":
        if payload.value is None:
            raise HTTPException(status_code=400, detail="Se necesita un valor para la tasa manual")
        data["value"] = float(payload.value)
    else:
        raise HTTPException(status_code=400, detail="Tipo de tasa inválido")

    raw = _dump_json(data)
    set_setting(db, ACTIVE_RATE_KEY, raw)
    # La tasa cambió: el cache de get_active_usd_rate ya no aplica.
    global _rate_cache
    _rate_cache = None

    config = {**data, "updated_at": datetime.utcnow()}
    config["_resolved_rate"] = await resolve_active_value(data)
    return _to_out(config)


def _parse_json(s: str) -> dict:
    import json
    return json.loads(s)


def _dump_json(d: dict) -> str:
    import json
    return json.dumps(d)
