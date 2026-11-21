"""Zona horaria de la plataforma.

Las fechas (cupones, pedidos, etc.) se guardan como datetime *naive* en hora local
de la plataforma (Maracaibo, Venezuela = America/Caracas, UTC-4, sin horario de verano). Por eso, cualquier comparación contra "ahora" debe usar la hora local
(no ``datetime.utcnow()``), o se bloquea de más la venta en las últimas horas del
día del evento (el bug de timezone).

Ver servicios ``app/services/sales.py`` y ``app/routes/coupons.py``.
"""

from datetime import datetime, timedelta, timezone

# America/Caracas (Venezuela): UTC-4, sin horario de verano.
APP_TZ = timezone(timedelta(hours=-4))


def local_now() -> datetime:
    """Hora local de la plataforma como datetime *naive*.

    Devuelve la hora actual en la zona horaria de la plataforma, sin ``tzinfo``,
    para poder compararla directamente contra las fechas naive almacenadas en la
    base de datos (``starts_at``, ``expires_at``, ``created_at``, etc.).
    """
    return datetime.now(APP_TZ).replace(tzinfo=None)
