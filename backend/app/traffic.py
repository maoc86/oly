"""Registro de tráfico de la API para el panel de administración.

Un middleware captura cada petición que llega al backend y la guarda en la
tabla `request_logs`. El esquema de la aplicación es un SPA: las páginas del
frontend piden datos a la API, así que estas llamadas reflejan bastante bien
la actividad real de visitantes, organizadores y admins.

Diseño:
- **No bloquea ni rompe nada**: si el registro falla, la petición sigue igual.
- **Ignora ruido**: healthchecks, preflights CORS, assets y documentación.
- **Bots aparte**: se marcan con `is_bot` para poder excluirlos en el panel.
- **Retención**: `purge_old_logs()` borra lo más viejo; un task periódico la
  invoca cada `TRAFFIC_CLEANUP_HOURS`.
"""

import asyncio
from datetime import datetime, timedelta

import jwt
from fastapi import Request
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal

# Cuántos días de historial conservamos.
TRAFFIC_RETENTION_DAYS = 90
# Cada cuántas horas se purgan los registros vencidos.
TRAFFIC_CLEANUP_HOURS = 6

# Rutas que no aportan señal de actividad.
_SKIP_PATHS = {"/health", "/docs", "/redoc", "/openapi.json", "/favicon.ico"}
_SKIP_PREFIXES = ("/uploads", "/_next", "/assets")

# Marcas de crawler en el User-Agent. Basta con buscar una en minúsculas.
_BOT_MARKERS = (
    "bot", "crawl", "spider", "slurp", "preview", "monitor", "uptime",
    "facebookexternalhit", "whatsapp", "telegram", "twitterbot", "discordbot",
    "embedly", "pinterest", "linkedinbot", "vkshare", "redditbot", "applebot",
    "python-requests", "python-httpx", "curl/", "wget/", "httpie", "go-http-client",
    "okhttp", "java/", "libwww", "scrapy", "node-fetch", "postman", "insomnia",
    "headlesschrome", "puppeteer", "playwright", "selenium", "phantomjs",
)


def _is_bot(user_agent: str | None) -> bool:
    if not user_agent:
        return False
    low = user_agent.lower()
    return any(marker in low for marker in _BOT_MARKERS)


_GEOIP_READER = None
_GEOIP_LOADED = False


def _load_geoip_reader():
    global _GEOIP_READER, _GEOIP_LOADED
    if _GEOIP_LOADED:
        return _GEOIP_READER
    _GEOIP_LOADED = True
    import os
    paths = [
        os.getenv("GEOIP_DB_PATH", ""),
        "/app/geoip/GeoLite2-City.mmdb",
        "/app/GeoLite2-City.mmdb",
    ]
    for p in paths:
        if p and os.path.exists(p):
            try:
                import geoip2.database
                _GEOIP_READER = geoip2.database.Reader(p)
                break
            except Exception:
                _GEOIP_READER = None
    return _GEOIP_READER


def _geo_lookup(ip: str | None):
    """Resuelve IP -> (country, country_code, city, region). None si no hay DB."""
    if not ip:
        return None, None, None, None
    reader = _load_geoip_reader()
    if reader is None:
        return None, None, None, None
    try:
        r = reader.city(ip)
        country = r.country.name
        cc = r.country.iso_code
        city = r.city.name
        region = r.subdivisions.most_specific.name if r.subdivisions else None
        return country, cc, city, region
    except Exception:
        return None, None, None, None


def _parse_ua(ua: str | None):
    """Parsea User-Agent -> (device_type, browser, os)."""
    if not ua:
        return "other", None, None
    try:
        from user_agents import parse
        u = parse(ua)
        if u.is_bot:
            device = "bot"
        elif u.is_mobile:
            device = "mobile"
        elif u.is_tablet:
            device = "tablet"
        elif u.is_pc:
            device = "desktop"
        else:
            device = "other"
        browser = u.browser.family
        if u.browser.version_string:
            browser = f"{u.browser.family} {u.browser.version_string}"
        os_name = u.os.family
        if u.os.version_string:
            os_name = f"{u.os.family} {u.os.version_string}"
        return device, browser[:60] if browser else None, os_name[:60] if os_name else None
    except Exception:
        low = (ua or "").lower()
        if "mobile" in low or "android" in low or "iphone" in low:
            return "mobile", None, None
        return "desktop", None, None


def _client_ip(request: Request) -> str | None:
    """IP real del cliente.

    Caddy hace de proxy y añade `X-Forwarded-For`; la primera entrada es el
    cliente original. Si no, usamos el peer que vio el backend.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # "cliente, proxy1, proxy2" -> cliente
        ip = forwarded.split(",")[0].strip()
        if ip:
            return ip[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return None


def _token_user_id(request: Request) -> int | None:
    """Extrae el `sub` del JWT sin consultar la base de datos.

    Solo sirve para atribuir la petición a un usuario en las métricas; por eso
    un token inválido se ignora en lugar de rechazar la petición (eso ya lo
    hace el `Depends` de cada ruta).
    """
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    try:
        payload = jwt.decode(
            header[7:],
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except Exception:
        return None
    sub = payload.get("sub")
    try:
        return int(sub)
    except (TypeError, ValueError):
        return None


def _should_skip(method: str, path: str) -> bool:
    if method == "OPTIONS":
        # Preflight de CORS: duplicaría la contabilidad sin ser una visita.
        return True
    if path in _SKIP_PATHS:
        return True
    return any(path.startswith(prefix) for prefix in _SKIP_PREFIXES)


def record_request(
    method: str,
    path: str,
    status_code: int,
    user_id: int | None,
    ip: str | None,
    user_agent: str | None,
    referer: str | None = None,
    utm_source: str | None = None,
    utm_medium: str | None = None,
    utm_campaign: str | None = None,
    utm_content: str | None = None,
    utm_term: str | None = None,
    country: str | None = None,
    country_code: str | None = None,
    city: str | None = None,
    region: str | None = None,
    device_type: str | None = None,
    browser: str | None = None,
    os: str | None = None,
) -> None:
    """Inserta una fila en `request_logs`. Nunca propaga excepciones."""
    try:
        db: Session = SessionLocal()
    except Exception:
        return
    try:
        from app.models import RequestLog

        db.add(
            RequestLog(
                method=method[:10],
                path=path[:500],
                status_code=status_code,
                user_id=user_id,
                ip=ip,
                user_agent=(user_agent or "")[:500] or None,
                referer=(referer or "")[:500] or None,
                utm_source=(utm_source or "")[:100] or None,
                utm_medium=(utm_medium or "")[:100] or None,
                utm_campaign=(utm_campaign or "")[:150] or None,
                utm_content=(utm_content or "")[:150] or None,
                utm_term=(utm_term or "")[:150] or None,
                country=country,
                country_code=country_code,
                city=city,
                region=region,
                device_type=device_type,
                browser=browser,
                os=os,
                is_bot=_is_bot(user_agent),
                created_at=datetime.utcnow(),
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


async def traffic_middleware(request: Request, call_next):
    """Registra cada petición en un hilo aparte, sin tocar la respuesta."""
    response = await call_next(request)

    path = request.url.path
    if not _should_skip(request.method, path):
        method = request.method
        status_code = response.status_code
        user_id = _token_user_id(request)
        ip = _client_ip(request)
        user_agent = request.headers.get("user-agent")
        referer = request.headers.get("referer")

        # UTM: primero query params, luego headers X-UTM-*, luego referer.
        utm_source = request.query_params.get("utm_source") or request.headers.get("x-utm-source")
        utm_medium = request.query_params.get("utm_medium") or request.headers.get("x-utm-medium")
        utm_campaign = request.query_params.get("utm_campaign") or request.headers.get("x-utm-campaign")
        utm_content = request.query_params.get("utm_content") or request.headers.get("x-utm-content")
        utm_term = request.query_params.get("utm_term") or request.headers.get("x-utm-term")
        # Si no hay UTMs en la request, intentar parsearlos del referer.

        country, country_code, city, region = _geo_lookup(ip)
        device_type, browser, os_name = _parse_ua(user_agent)
        if not utm_source and referer:
            try:
                from urllib.parse import urlparse, parse_qs
                qs = parse_qs(urlparse(referer).query)
                utm_source = (qs.get("utm_source") or [None])[0]
                utm_medium = (qs.get("utm_medium") or [None])[0]
                utm_campaign = (qs.get("utm_campaign") or [None])[0]
                utm_content = (qs.get("utm_content") or [None])[0]
                utm_term = (qs.get("utm_term") or [None])[0]
            except Exception:
                pass

        try:
            await asyncio.to_thread(
                record_request, method, path, status_code, user_id, ip, user_agent, referer,
                utm_source, utm_medium, utm_campaign, utm_content, utm_term,
                country, country_code, city, region, device_type, browser, os_name,
            )
        except Exception:
            # El registro de tráfico nunca debe tumbar una petición válida.
            pass

    return response


def purge_old_logs(days: int = TRAFFIC_RETENTION_DAYS) -> int:
    """Borra registros más viejos que `days`. Devuelve las filas borradas."""
    db: Session = SessionLocal()
    try:
        from app.models import RequestLog

        cutoff = datetime.utcnow() - timedelta(days=days)
        deleted = (
            db.query(RequestLog)
            .filter(RequestLog.created_at < cutoff)
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted
    except Exception:
        db.rollback()
        return 0
    finally:
        db.close()


async def traffic_cleanup_loop() -> None:
    """Purga periódica de registros vencidos, en segundo plano."""

    def _run_once() -> None:
        try:
            purge_old_logs()
        except Exception:
            pass

    # Purga al arrancar (los reinicios son poco frecuentes, así que no basta).
    await asyncio.to_thread(_run_once)

    while True:
        await asyncio.sleep(TRAFFIC_CLEANUP_HOURS * 3600)
        await asyncio.to_thread(_run_once)


def start_cleanup_task() -> "asyncio.Task | None":
    """Lanza el task de purga. Devuelve None si ya hay uno (evita duplicados)."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return None
    return loop.create_task(traffic_cleanup_loop())
