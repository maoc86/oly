"""Configuración del sitio.

Todos los ajustes editables desde el admin viven en la tabla `settings`
(key/value). Este módulo es el único lugar donde se declara qué claves existen,
qué valor por defecto tienen y en qué rango se pueden mover, para que el
backend (cálculos de venta) y el frontend (pintar la UI) lean los mismos
defaults.
"""

from datetime import datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.models import Setting

# Claves que no se exponen en el endpoint público (por si alguien las agrega).
PRIVATE_KEYS = {"smtp_password"}


def _d(key: str, label: str, default: Any, group: str, **rules: Any) -> dict:
    return {"key": key, "label": label, "default": default, "group": group, **rules}


# Registro maestro de ajustes. `type` se deduce del default salvo que se fuerce.
FIELDS: list[dict] = [
    # --- Empresa y contacto -------------------------------------------------
    _d("company_name", "Nombre del sitio", "Oly Official", "empresa", max_length=120),
    _d("company_logo", "Logo (URL)", "", "empresa", max_length=500),
    _d("company_email", "Email de contacto", "hola@olyofficial.com", "empresa", max_length=160),
    _d("company_phone", "Teléfono", "", "empresa", max_length=40),
    _d("company_whatsapp", "WhatsApp", "", "empresa", max_length=40),
    _d("company_address", "Dirección", "", "empresa", max_length=300, widget="textarea"),
    _d("footer_text", "Texto del footer", "Ropa deportiva para mujeres que entrenan sin límites.", "empresa", max_length=300, widget="textarea"),
    _d("social_instagram", "Instagram", "", "empresa", max_length=200),
    _d("social_facebook", "Facebook", "", "empresa", max_length=200),
    _d("social_tiktok", "TikTok", "", "empresa", max_length=200),
    _d("social_x", "X (Twitter)", "", "empresa", max_length=200),
    # --- Aviso del navbar ---------------------------------------------------
    _d("announcement_text", "Texto del aviso", "", "aviso", max_length=200, widget="textarea"),
    _d("announcement_link", "Enlace del aviso", "", "aviso", max_length=500),
    _d("announcement_active", "Mostrar aviso", False, "aviso"),
    # --- Hero ---------------------------------------------------------------
    _d("hero_autoplay", "Rotar automáticamente", True, "hero"),
    _d("hero_transition_seconds", "Transición (segundos)", 6, "hero", min_value=1, max_value=60),
    _d(
        "hero_height",
        "Altura del hero (px)",
        560,
        "hero",
        min_value=400,
        max_value=800,
        step=10,
        hint="Se recorta al ancho de la pantalla. Con imágenes panorámicas (1600×900 o más) se ve mejor.",
    ),
    _d(
        "hero_overlay",
        "Opacidad del velo (%)",
        35,
        "hero",
        min_value=0,
        max_value=90,
        hint="Velo negro sobre la foto. Subilo si el texto se lee mal sobre imágenes claras.",
    ),
    # --- Ventas: IVA e impuestos -------------------------------------------
    _d(
        "tax_percent",
        "IVA (%)",
        16.0,
        "ventas",
        min_value=0,
        max_value=100,
        step=0.01,
        hint="Se suma al subtotal en el checkout. Ponele 0 si los precios ya lo incluyen.",
    ),
    _d("show_breakdown", "Mostrar desglose en el checkout", True, "ventas"),
    _d(
        "terms_url",
        "Enlace a Términos y Condiciones",
        "/terminos",
        "ventas",
        hint="Se enlaza desde el checkout y el footer. Por defecto apunta a la página interna /terminos.",
    ),
    # --- Envío --------------------------------------------------------------
    _d(
        "free_shipping_threshold",
        "Envío gratis a partir de (USD, 0 = desactivado)",
        0.0,
        "envio",
        min_value=0,
        max_value=100000,
        step=0.01,
    ),
    # --- Límites de compra --------------------------------------------------
    _d("max_items_per_order", "Máx. artículos por orden (0 = sin límite)", 0, "limites", min_value=0, max_value=1000),
    _d("min_order_total", "Compra mínima (0 = sin mínimo)", 0.0, "limites", min_value=0, max_value=1000000, step=0.01),
    _d("max_order_total", "Compra máxima (0 = sin máximo)", 0.0, "limites", min_value=0, max_value=1000000, step=0.01),
    # --- Sistema / mantenimiento -------------------------------------------
    _d("maintenance_mode", "Modo mantenimiento (desactiva el sitio público)", False, "sistema"),
    _d("maintenance_message", "Mensaje de mantenimiento", "Estamos realizando mejoras. Volvemos pronto.", "sistema", max_length=500),
    _d("maintenance_eta", "Tiempo estimado de regreso (minutos, 0 = sin estimado)", 0, "sistema", min_value=0, max_value=1440),
]

FIELDS_BY_KEY: dict[str, dict] = {f["key"]: f for f in FIELDS}
DEFAULTS: dict[str, Any] = {f["key"]: f["default"] for f in FIELDS}


class ConfigError(ValueError):
    """Clave inexistente o valor fuera del rango permitido."""


def _coerce(field: dict, raw: Any) -> Any:
    default = field["default"]
    is_number = isinstance(default, (int, float)) and not isinstance(default, bool)

    if isinstance(raw, bool):
        return raw
    if isinstance(default, bool):
        if isinstance(raw, str):
            return raw.strip().lower() in ("1", "true", "yes", "si", "sí", "on")
        return bool(raw)
    if is_number:
        try:
            value = float(raw)
        except (TypeError, ValueError):
            raise ConfigError(f"'{field['label']}' debe ser un número")
        value = round(value, 2) if isinstance(default, float) else int(round(value))
    else:
        value = "" if raw is None else str(raw)
        max_length = field.get("max_length")
        if max_length and len(value) > max_length:
            raise ConfigError(f"'{field['label']}' admite máximo {max_length} caracteres")
        return value.strip()

    if "min_value" in field and value < field["min_value"]:
        raise ConfigError(f"'{field['label']}' no puede ser menor que {field['min_value']}")
    if "max_value" in field and value > field["max_value"]:
        raise ConfigError(f"'{field['label']}' no puede ser mayor que {field['max_value']}")
    return value


def get_config(db: Session) -> dict:
    """Configuración completa con defaults aplicados."""
    config = dict(DEFAULTS)
    for row in db.query(Setting).filter(Setting.key.in_(list(DEFAULTS))).all():
        field = FIELDS_BY_KEY.get(row.key)
        if not field or row.value is None:
            continue
        try:
            config[row.key] = _coerce(field, row.value)
        except ConfigError:
            continue  # valor corrupto en BD: se queda el default
    return config


def get_value(db: Session, key: str, default: Optional[Any] = None) -> Any:
    """Valor de una clave concreta, o el default del registro si no existe."""
    if key not in FIELDS_BY_KEY:
        return default
    return get_config(db).get(key, DEFAULTS.get(key, default))


def set_config(db: Session, updates: dict) -> dict:
    """Actualización parcial. Valida todo antes de escribir."""
    if not isinstance(updates, dict) or not updates:
        raise ConfigError("No hay ajustes para guardar")

    clean: dict[str, str] = {}
    for key, raw in updates.items():
        if key in PRIVATE_KEYS or key not in FIELDS_BY_KEY:
            raise ConfigError(f"Ajuste desconocido: '{key}'")
        value = _coerce(FIELDS_BY_KEY[key], raw)
        clean[key] = "" if value is None else str(value)

    now = datetime.utcnow()
    existing = {row.key: row for row in db.query(Setting).filter(Setting.key.in_(list(clean))).all()}
    for key, value in clean.items():
        row = existing.get(key)
        if row:
            row.value = value
            row.updated_at = now
        else:
            db.add(Setting(key=key, value=value))
    db.commit()
    return get_config(db)


def describe_fields() -> list[dict]:
    """Metadata de los ajustes para que el admin los construya sin duplicar la lista."""
    out = []
    for f in FIELDS:
        out.append(
            {
                "key": f["key"],
                "label": f["label"],
                "group": f["group"],
                "default": f["default"],
                "type": (
                    "bool"
                    if isinstance(f["default"], bool)
                    else "number"
                    if isinstance(f["default"], (int, float))
                    else "text"
                ),
                "min": f.get("min_value"),
                "max": f.get("max_value"),
                "max_length": f.get("max_length"),
                "step": f.get("step"),
                "widget": f.get("widget"),
                "hint": f.get("hint"),
            }
        )
    return out
