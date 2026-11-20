"""Limitador de peticiones en memoria.

Pensado para un despliegue de un único proceso (uvicorn sin `--workers`), como el
Dockerfile actual. En multi-worker haría falta un almacenamiento compartido
(Redis) para que el límite sea global.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

from app.config import settings


class SlidingWindow:
    """Cuenta accesos por clave en una ventana de tiempo deslizante."""

    def __init__(self, limit: int, window_seconds: int):
        self.limit = limit
        self.window_seconds = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] >= self.window_seconds:
                q.popleft()
            if len(q) >= self.limit:
                raise HTTPException(
                    status_code=429,
                    detail="Demasiados intentos. Esperá un minuto y volvé a intentarlo.",
                    headers={"Retry-After": str(self.window_seconds)},
                )
            q.append(now)


_login = SlidingWindow(settings.RATE_LIMIT_LOGIN_MAX, settings.RATE_LIMIT_WINDOW_SECONDS)
_register = SlidingWindow(settings.RATE_LIMIT_REGISTER_MAX, settings.RATE_LIMIT_WINDOW_SECONDS)


def _client_ip(request: Request) -> str:
    if request.client:
        return request.client.host
    return "unknown"


def login_rate_limit(request: Request) -> None:
    _login.hit(_client_ip(request))


def register_rate_limit(request: Request) -> None:
    _register.hit(_client_ip(request))
