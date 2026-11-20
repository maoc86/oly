"""Motor de correos: renderiza plantillas {{variable}} y las envía por SMTP.

Reglas:
- Si el SMTP no está configurado (settings.smtp_configured == False) o la
  plantilla no existe / está inactiva, el envío se registra en el log y se
  ignora: nunca se corta una venta o una confirmación de pago.
- Todo lo que necesita BD se resuelve dentro del request; el hilo de envío
  solo hace I/O de SMTP para no bloquear la respuesta.
"""

import logging
import re
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.models import EmailTemplate, Order
from app.site_config import get_config

logger = logging.getLogger("mailer")

# {{ nombre }} -> value si la clave existe; si no, se deja el token intacto.
_VAR_RE = re.compile(r"{{\s*([A-Za-z0-9_]+)\s*}}")


def render(text: str, context: dict) -> str:
    def _sub(match: re.Match) -> str:
        key = match.group(1)
        if key in context and context[key] is not None:
            return str(context[key])
        return match.group(0)

    return _VAR_RE.sub(_sub, text)


def get_template(db: Session, key: str) -> Optional[EmailTemplate]:
    return (
        db.query(EmailTemplate)
        .filter(EmailTemplate.key == key, EmailTemplate.is_active.is_(True))
        .first()
    )


# ─── Formato de contexto ──────────────────────────────────────────

def fmt_date(dt) -> str:
    if not dt:
        return ""
    return dt.strftime("%d/%m/%Y")


def _money(value) -> str:
    try:
        return "{:,.2f}".format(float(value))
    except (TypeError, ValueError):
        return ""


def build_base_context(db: Session) -> dict:
    """Variables comunes a todos los correos (editables desde Configuración)."""
    config = get_config(db)
    return {
        "plataforma": config.get("company_name") or "Oly Official",
        "soporte": config.get("company_email") or "hola@olyofficial.com",
    }


def _items_table(order: Order) -> str:
    """Mini-tabla HTML con las líneas de la orden."""
    rows = []
    for item in order.items:
        label = item.product_name or "Producto"
        if item.size or item.color:
            extra = " · ".join([p for p in (item.size, item.color) if p])
            label += f" ({extra})"
        rows.append(
            f'<tr><td style="padding:8px 0;border-bottom:1px solid #f0f0f0">{label}'
            f'<span style="color:#9ca3af"> × {item.quantity}</span></td>'
            f'<td style="padding:8px 0;border-bottom:1px solid #f0f0f0;text-align:right">{_money(item.subtotal)}</td></tr>'
        )
    if not rows:
        return ""
    return (
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        'style="margin:16px 0">' + "".join(rows) + "</table>"
    )


def build_order_context(db: Session, order: Order, buyer_name: str = "") -> dict:
    """Contexto para los correos de compra (orden + productos + comprador)."""
    context = build_base_context(db)
    context.update(
        {
            "nombre": buyer_name or (order.user.name if order.user else ""),
            "orden": order.id,
            "cantidad": sum(int(i.quantity or 0) for i in order.items),
            "productos": _items_table(order),
            "subtotal": _money(order.subtotal),
            "descuento": _money(order.discount),
            "impuesto": _money(order.tax),
            "envio": _money(order.shipping),
            "total": _money(order.payment_total if order.payment_total is not None else order.total),
            "moneda": order.payment_currency or "USD",
            "metodo_pago": order.payment_method.name if order.payment_method else "",
            "referencia": order.payment_reference or "",
            "link": f"{settings.APP_URL}/pedidos",
        }
    )
    return context


# ─── Envío ──────────────────────────────────────────────────────────

def _smtp_deliver(
    to_email: str,
    subject: str,
    html_body: str,
    from_name: str,
) -> None:
    sender = settings.SMTP_FROM or settings.SMTP_USER

    msg = MIMEText(html_body, "html", "utf-8")
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, sender))
    msg["To"] = to_email

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        if settings.SMTP_USER:
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        smtp.send_message(msg)


def _smtp_send(
    to_email: str,
    subject: str,
    html_body: str,
    from_name: str,
) -> None:
    try:
        _smtp_deliver(to_email, subject, html_body, from_name)
        logger.info("email enviado a=%s subject=%r", to_email, subject)
    except Exception:
        logger.exception("fallo al enviar email a=%s subject=%r", to_email, subject)


def send_template_email(
    db: Session,
    key: str,
    to_email: str,
    context: Optional[dict] = None,
) -> bool:
    """Renderiza y encola el envío de una plantilla.

    Devuelve True si el envío se encoló, False si fue ignorado (sin SMTP,
    plantilla inactiva/inexistente o sin destinatario).
    """
    if not to_email:
        return False
    if not settings.smtp_configured:
        logger.warning("correo '%s' ignorado a=%s: SMTP no configurado", key, to_email)
        return False

    template = get_template(db, key)
    if not template:
        logger.warning("correo '%s' ignorado a=%s: plantilla inexistente o inactiva", key, to_email)
        return False

    ctx = dict(context or {})
    base = build_base_context(db)
    for k, v in base.items():
        ctx.setdefault(k, v)

    subject = render(template.subject, ctx).strip()
    body = render(template.body, ctx)
    from_name = ctx.get("plataforma") or "Oly Official"

    thread = threading.Thread(target=_smtp_send, kwargs={
        "to_email": to_email,
        "subject": subject,
        "html_body": body,
        "from_name": from_name,
    }, daemon=True)
    thread.start()
    logger.info("correo '%s' encolado a=%s", key, to_email)
    return True


# ─── Prueba desde el panel (envío síncrono) ─────────────────────────

SAMPLE_CONTEXT = {
    "nombre": "Cliente de prueba",
    "cantidad": "2",
    "productos": "<table></table>",
    "subtotal": "20.00",
    "descuento": "0.00",
    "impuesto": "3.20",
    "envio": "5.00",
    "total": "28.20",
    "moneda": "USD",
    "metodo_pago": "Transferencia",
    "referencia": "TEST-0001",
    "orden": "123",
    "expira": "60 minutos",
}


def send_test_email(db: Session, to_email: str, subject: str, body: str) -> None:
    """Envía una prueba real de una plantilla, de forma síncrona.

    Sustituye las variables {{...}} por valores de ejemplo. Lanza excepción si
    el SMTP no está configurado o si el envío falla, para que el panel lo avise.
    """
    if not settings.smtp_configured:
        raise RuntimeError("El envío de correo no está configurado (faltan SMTP_HOST/SMTP_USER).")

    context = build_base_context(db)
    context.update(SAMPLE_CONTEXT)
    context["link"] = f"{settings.APP_URL}/pedidos"

    rendered_subject = render(subject, context).strip() or "Prueba de plantilla"
    rendered_body = render(body, context) or "(cuerpo vacío)"
    from_name = context.get("plataforma") or "Oly Official"

    _smtp_deliver(to_email, rendered_subject, rendered_body, from_name)
    logger.info("email de prueba enviado a=%s subject=%r", to_email, rendered_subject)
