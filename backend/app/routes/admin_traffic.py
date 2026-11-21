"""Panel de tráfico del administrador.

Agrega la tabla `request_logs` (que llena `app/traffic.py`) en métricas útiles:
visitantes y peticiones por día/hora, páginas más vistas, de dónde llegan
(referers), dispositivos, códigos de respuesta y actividad en vivo.

Los bots se contabilizan aparte para no inflar las cifras de visitantes.
"""

import re
from datetime import datetime, timedelta
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import RequestLog, User as UserModel
from app.schemas import (
    TrafficCount,
    TrafficPoint,
    TrafficRecentRequest,
    TrafficStats,
    TrafficStatusCount,
)
from app.utils.auth import require_permission

router = APIRouter(prefix="/admin/traffic", tags=["admin-traffic"])

# Zona horaria por defecto (Venezuela, UTC-4) para agrupar días/horas.
DEFAULT_TZ_OFFSET = -4
# Minutos sin actividad para considerar a un visitante "en línea".
ONLINE_WINDOW_MINUTES = 5
# Máximo de elementos en los rankings.
TOP_LIMIT = 12
# Prefijos de los paneles internos (admin/pos). Su actividad no es
# "tráfico" del sitio: si no se excluye, el propio admin dominaría las cifras.
INTERNAL_PREFIXES = ("/admin", "/pos")

_ID_SEGMENT = re.compile(r"/\d+(?=/|$)")


def _shifted_ts(tz_offset: int):
    """`created_at` (UTC naive) desplazado a la zona horaria pedida."""
    return func.timestampadd(text("HOUR"), tz_offset, RequestLog.created_at)


def _normalize_path(path: str) -> str:
    """`/eventos/12` -> `/eventos/{id}` para agrupar rutas dinámicas."""
    return _ID_SEGMENT.sub("/{id}", path)


def _device_from_ua(ua: str | None) -> str:
    if not ua:
        return "Desconocido"
    low = ua.lower()
    if "iphone" in low:
        return "iPhone"
    if "ipad" in low:
        return "iPad"
    if "android" in low:
        return "Android"
    if "windows" in low:
        return "Windows"
    if "macintosh" in low or "mac os" in low:
        return "Mac"
    if "linux" in low:
        return "Linux"
    return ua[:60]


def _referer_host(url: str | None) -> str | None:
    if not url:
        return None
    try:
        host = urlparse(url).netloc.lower()
        return host or None
    except Exception:
        return None


@router.get("", response_model=TrafficStats)
def get_traffic(
    days: int = Query(14, ge=1, le=90, description="Días de historial en las series"),
    tz_offset: int = Query(DEFAULT_TZ_OFFSET, ge=-12, le=14, description="Offset horario"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(require_permission("traffic.view")),
):
    import time
    _t0 = time.perf_counter()
    real = func.coalesce(RequestLog.is_bot, False) == False  # noqa: E712
    # Filtro base de "tráfico público": ni bots ni paneles internos.
    public = [
        real,
        *[~RequestLog.path.like(f"{prefix}%") for prefix in INTERNAL_PREFIXES],
    ]

    now_utc = datetime.utcnow()
    now_local = now_utc + timedelta(hours=tz_offset)
    today_start_utc = now_local.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(
        hours=tz_offset
    )
    week_ago = now_utc - timedelta(days=7)
    online_since = now_utc - timedelta(minutes=ONLINE_WINDOW_MINUTES)
    days_cutoff = now_local.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(
        days=days - 1
    )
    days_cutoff_utc = days_cutoff - timedelta(hours=tz_offset)

    # ── Resumen ──────────────────────────────────────────────
    requests_today = (
        db.query(func.count(RequestLog.id))
        .filter(RequestLog.created_at >= today_start_utc, *public)
        .scalar()
        or 0
    )
    visitors_today = (
        db.query(func.count(func.distinct(RequestLog.ip)))
        .filter(RequestLog.created_at >= today_start_utc, *public, RequestLog.ip.isnot(None))
        .scalar()
        or 0
    )
    # Acotar a 90 días para no escanear toda la tabla.
    cutoff_90 = now_utc - timedelta(days=90)
    requests_total = db.query(func.count(RequestLog.id)).filter(*public, RequestLog.created_at >= cutoff_90).scalar() or 0
    visitors_total = (
        db.query(func.count(func.distinct(RequestLog.ip)))
        .filter(*public, RequestLog.ip.isnot(None), RequestLog.created_at >= cutoff_90)
        .scalar()
        or 0
    )
    online_now = (
        db.query(func.count(func.distinct(RequestLog.ip)))
        .filter(RequestLog.created_at >= online_since, *public, RequestLog.ip.isnot(None))
        .scalar()
        or 0
    )
    logged_in_week = (
        db.query(func.count(func.distinct(RequestLog.user_id)))
        .filter(RequestLog.created_at >= week_ago, RequestLog.user_id.isnot(None), *public)
        .scalar()
        or 0
    )
    bot_requests = (
        db.query(func.count(RequestLog.id))
        .filter(func.coalesce(RequestLog.is_bot, False) == True)  # noqa: E712
        .scalar()
        or 0
    )
    bot_visitors = (
        db.query(func.count(func.distinct(RequestLog.ip)))
        .filter(
            func.coalesce(RequestLog.is_bot, False) == True,  # noqa: E712
            RequestLog.ip.isnot(None),
        )
        .scalar()
        or 0
    )

    # ── Serie por día ────────────────────────────────────────
    day_col = func.date(_shifted_ts(tz_offset)).label("day")
    day_rows = (
        db.query(
            day_col,
            func.count(RequestLog.id).label("requests"),
            func.count(func.distinct(RequestLog.ip)).label("visitors"),
        )
        .filter(RequestLog.created_at >= days_cutoff_utc, *public)
        .group_by(day_col)
        .order_by(day_col)
        .all()
    )
    day_map = {
        str(row.day): (int(row.requests), int(row.visitors)) for row in day_rows
    }
    by_day: list[TrafficPoint] = []
    for i in range(days):
        d = (days_cutoff + timedelta(days=i)).date()
        key = d.isoformat()
        requests, visitors = day_map.get(key, (0, 0))
        by_day.append(TrafficPoint(label=key, requests=requests, visitors=visitors))

    # ── Serie por hora (últimas 24 h) ────────────────────────
    hour_col = func.date_format(_shifted_ts(tz_offset), "%Y-%m-%d %H:00").label("hour")
    hour_rows = (
        db.query(
            hour_col,
            func.count(RequestLog.id).label("requests"),
            func.count(func.distinct(RequestLog.ip)).label("visitors"),
        )
        .filter(RequestLog.created_at >= now_utc - timedelta(hours=24), *public)
        .group_by(hour_col)
        .order_by(hour_col)
        .all()
    )
    by_hour = [
        TrafficPoint(
            label=str(row.hour), requests=int(row.requests), visitors=int(row.visitors)
        )
        for row in hour_rows
    ]

    # ── Rankings ─────────────────────────────────────────────
    path_rows = (
        db.query(RequestLog.path, func.count(RequestLog.id).label("count"))
        .filter(*public)
        .group_by(RequestLog.path)
        .order_by(func.count(RequestLog.id).desc())
        .limit(TOP_LIMIT * 4)
        .all()
    )
    path_totals: dict[str, int] = {}
    for row in path_rows:
        key = _normalize_path(row.path or "/")
        path_totals[key] = path_totals.get(key, 0) + int(row.count)
    top_paths = [
        TrafficCount(label=label, count=count)
        for label, count in sorted(path_totals.items(), key=lambda kv: kv[1], reverse=True)[
            :TOP_LIMIT
        ]
    ]

    ip_rows = (
        db.query(RequestLog.ip, func.count(RequestLog.id).label("count"))
        .filter(*public, RequestLog.ip.isnot(None))
        .group_by(RequestLog.ip)
        .order_by(func.count(RequestLog.id).desc())
        .limit(TOP_LIMIT)
        .all()
    )
    top_ips = [TrafficCount(label=row.ip, count=int(row.count)) for row in ip_rows]

    referer_rows = (
        db.query(RequestLog.referer, func.count(RequestLog.id).label("count"))
        .filter(*public, RequestLog.referer.isnot(None))
        .group_by(RequestLog.referer)
        .order_by(func.count(RequestLog.id).desc())
        .limit(TOP_LIMIT * 3)
        .all()
    )
    referer_totals: dict[str, int] = {}
    for row in referer_rows:
        host = _referer_host(row.referer)
        if host:
            referer_totals[host] = referer_totals.get(host, 0) + int(row.count)
    top_referers = [
        TrafficCount(label=label, count=count)
        for label, count in sorted(referer_totals.items(), key=lambda kv: kv[1], reverse=True)[
            :TOP_LIMIT
        ]
    ]

    ua_rows = (
        db.query(RequestLog.user_agent, func.count(RequestLog.id).label("count"))
        .filter(*public)
        .group_by(RequestLog.user_agent)
        .order_by(func.count(RequestLog.id).desc())
        .limit(200)
        .all()
    )
    device_totals: dict[str, int] = {}
    for row in ua_rows:
        device = _device_from_ua(row.user_agent)
        device_totals[device] = device_totals.get(device, 0) + int(row.count)
    user_agents = [
        TrafficCount(label=label, count=count)
        for label, count in sorted(device_totals.items(), key=lambda kv: kv[1], reverse=True)[
            :TOP_LIMIT
        ]
    ]

    # ── Nuevos rankings (Fase B) ─────────────────────────────
    country_rows = (
        db.query(RequestLog.country, func.count(RequestLog.id).label("count"))
        .filter(*public, RequestLog.country.isnot(None))
        .group_by(RequestLog.country)
        .order_by(func.count(RequestLog.id).desc())
        .limit(TOP_LIMIT)
        .all()
    )
    top_countries = [TrafficCount(label=row.country, count=int(row.count)) for row in country_rows]

    device_rows = (
        db.query(RequestLog.device_type, func.count(RequestLog.id).label("count"))
        .filter(*public, RequestLog.device_type.isnot(None))
        .group_by(RequestLog.device_type)
        .order_by(func.count(RequestLog.id).desc())
        .all()
    )
    top_devices = [TrafficCount(label=row.device_type, count=int(row.count)) for row in device_rows]

    browser_rows = (
        db.query(RequestLog.browser, func.count(RequestLog.id).label("count"))
        .filter(*public, RequestLog.browser.isnot(None))
        .group_by(RequestLog.browser)
        .order_by(func.count(RequestLog.id).desc())
        .limit(TOP_LIMIT)
        .all()
    )
    top_browsers = [TrafficCount(label=row.browser, count=int(row.count)) for row in browser_rows]

    utm_source_rows = (
        db.query(RequestLog.utm_source, func.count(RequestLog.id).label("count"))
        .filter(*public, RequestLog.utm_source.isnot(None))
        .group_by(RequestLog.utm_source)
        .order_by(func.count(RequestLog.id).desc())
        .limit(TOP_LIMIT)
        .all()
    )
    top_utm_sources = [TrafficCount(label=row.utm_source, count=int(row.count)) for row in utm_source_rows]

    utm_campaign_rows = (
        db.query(RequestLog.utm_campaign, func.count(RequestLog.id).label("count"))
        .filter(*public, RequestLog.utm_campaign.isnot(None))
        .group_by(RequestLog.utm_campaign)
        .order_by(func.count(RequestLog.id).desc())
        .limit(TOP_LIMIT)
        .all()
    )
    top_utm_campaigns = [TrafficCount(label=row.utm_campaign, count=int(row.count)) for row in utm_campaign_rows]

    status_rows = (
        db.query(RequestLog.status_code, func.count(RequestLog.id).label("count"))
        .filter(*public)
        .group_by(RequestLog.status_code)
        .order_by(func.count(RequestLog.id).desc())
        .all()
    )
    statuses = [
        TrafficStatusCount(status=int(row.status_code), count=int(row.count))
        for row in status_rows
    ]

    # ── Actividad en vivo ────────────────────────────────────
    recent_rows = (
        db.query(RequestLog)
        .order_by(RequestLog.created_at.desc(), RequestLog.id.desc())
        .limit(20)
        .all()
    )
    recent = [
        TrafficRecentRequest(
            path=r.path,
            method=r.method,
            status_code=r.status_code,
            ip=r.ip,
            user_agent=r.user_agent,
            is_bot=bool(r.is_bot),
            user_id=r.user_id,
            created_at=r.created_at,
        )
        for r in recent_rows
    ]

    print("[traffic] total=%.3fs days=%d" % (time.perf_counter() - _t0, days), flush=True)
    return TrafficStats(
        requests_today=requests_today,
        visitors_today=visitors_today,
        requests_total=requests_total,
        visitors_total=visitors_total,
        online_now=online_now,
        logged_in_week=logged_in_week,
        bot_requests=bot_requests,
        bot_visitors=bot_visitors,
        by_day=by_day,
        by_hour=by_hour,
        top_paths=top_paths,
        top_ips=top_ips,
        top_referers=top_referers,
        user_agents=user_agents,
        top_countries=top_countries,
        top_devices=top_devices,
        top_browsers=top_browsers,
        top_utm_sources=top_utm_sources,
        top_utm_campaigns=top_utm_campaigns,
        statuses=statuses,
        recent=recent,
        days=days,
        timezone_offset=tz_offset,
    )
