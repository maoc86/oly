from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import EmailTemplate, User
from app.schemas import (
    EmailTemplateCreate,
    EmailTemplateTest,
    EmailTemplateUpdate,
    EmailTemplateResponse,
)
from app.mailer import send_test_email
from app.utils.auth import require_permission

router = APIRouter(prefix="/admin/email-templates", tags=["admin-email-templates"])


def _ensure_unique_key(db: Session, key: str, exclude_id: int | None = None):
    query = db.query(EmailTemplate).filter(EmailTemplate.key == key)
    if exclude_id is not None:
        query = query.filter(EmailTemplate.id != exclude_id)
    if query.first():
        raise HTTPException(status_code=409, detail="Ya existe una plantilla con ese identificador")


def _get_or_404(db: Session, template_id: int):
    template = db.query(EmailTemplate).filter(EmailTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Plantilla de correo no encontrada")
    return template


@router.get("", response_model=list[EmailTemplateResponse])
def list_email_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("templates.manage")),
):
    templates = db.query(EmailTemplate).order_by(EmailTemplate.key.asc()).all()
    return [EmailTemplateResponse.model_validate(t) for t in templates]


@router.post("/test")
def send_test_email_template(
    data: EmailTemplateTest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("templates.manage")),
):
    """Envía una prueba real del asunto/cuerpo indicados a un correo puntual.

    Reemplaza las variables {{...}} por valores de ejemplo. Devuelve un error
    claro si el SMTP no está configurado o si la entrega falla.
    """
    try:
        send_test_email(db, str(data.to), data.subject, data.body)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # SMTP caído, credenciales inválidas, etc.
        raise HTTPException(status_code=502, detail=f"No se pudo enviar el correo: {exc}")
    return {"detail": f"Correo de prueba enviado a {data.to}"}


@router.get("/{template_id}", response_model=EmailTemplateResponse)
def get_email_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("templates.manage")),
):
    return EmailTemplateResponse.model_validate(_get_or_404(db, template_id))


@router.post("", response_model=EmailTemplateResponse)
def create_email_template(
    data: EmailTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("templates.manage")),
):
    _ensure_unique_key(db, data.key)
    template = EmailTemplate(**data.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return EmailTemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=EmailTemplateResponse)
def update_email_template(
    template_id: int,
    data: EmailTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("templates.manage")),
):
    template = _get_or_404(db, template_id)
    payload = data.model_dump(exclude_unset=True)
    if "key" in payload and payload["key"] != template.key:
        _ensure_unique_key(db, payload["key"], exclude_id=template_id)
    for field, value in payload.items():
        setattr(template, field, value)
    db.commit()
    db.refresh(template)
    return EmailTemplateResponse.model_validate(template)


@router.delete("/{template_id}")
def delete_email_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("templates.manage")),
):
    template = _get_or_404(db, template_id)
    db.delete(template)
    db.commit()
    return {"detail": "Plantilla de correo eliminada"}