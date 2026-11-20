import uuid
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from PIL import Image

from app.utils.auth import get_current_user, require_admin
from app.models import User

router = APIRouter(tags=["uploads"])

# Ruta física donde se guardan los archivos subidos (imágenes y comprobantes).
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
MAX_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_IMAGE_DIM = 1920
WEBP_QUALITY = 82


# Formatos permitidos y su extensión canónica. La extensión se deriva del formato
# real detectado (magic bytes), no del nombre del archivo, para evitar servir un
# MIME incorrecto o un archivo malicioso con extensión de imagen.
ALLOWED_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
    "GIF": ".gif",
}

# Los comprobantes de pago también pueden ser PDF (capturas de banca suelen venir así).
RECEIPT_FORMATS = {**ALLOWED_FORMATS, "PDF": ".pdf"}


def _detect_ext(content: bytes) -> str | None:
    """Detecta el formato real del archivo y devuelve su extensión canónica."""
    if content[:5] == b"%PDF-":
        return ".pdf"
    try:
        with Image.open(BytesIO(content)) as img:
            fmt = (img.format or "").upper()
            img.verify()
    except Exception:
        return None
    return ALLOWED_FORMATS.get(fmt)


def _optimize_image(content: bytes) -> bytes:
    """Optimiza imágenes a WebP con un tamaño razonable."""
    try:
        with Image.open(BytesIO(content)) as img:
            img = img.convert("RGB") if img.mode in ("RGBA", "P") else img.convert("RGB")
            w, h = img.size
            if max(w, h) > MAX_IMAGE_DIM:
                ratio = MAX_IMAGE_DIM / max(w, h)
                img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)
            out = BytesIO()
            img.save(out, format="WEBP", quality=WEBP_QUALITY, method=6)
            return out.getvalue()
    except Exception:
        return content


def _save_upload(content: bytes, allowed_exts: set[str], request: Request) -> str:
    """Valida y guarda el archivo, devolviendo su URL pública.

    `allowed_exts` limita qué tipos se aceptan (p. ej. los comprobantes admiten
    también `.pdf`, mientras que las imágenes de eventos no).
    """
    if not content:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="El archivo supera los 10 MB.")

    ext = _detect_ext(content)
    if ext is None or ext not in allowed_exts:
        allowed = ", ".join(sorted(e.lstrip(".") for e in allowed_exts))
        raise HTTPException(status_code=400, detail=f"Formato no válido. Usá: {allowed}.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    if ext == ".pdf":
        filename = f"{uuid.uuid4().hex}{ext}"
        (UPLOAD_DIR / filename).write_bytes(content)
    else:
        filename = f"{uuid.uuid4().hex}.webp"
        optimized = _optimize_image(content)
        (UPLOAD_DIR / filename).write_bytes(optimized)

    # URL relativa: se resuelve contra el host del frontend en cada entorno
    # (local, Docker, producción) y se proxee al backend vía el rewrite de Next.
    return f"/uploads/{filename}"


@router.post("/admin/upload")
def upload_image(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(require_admin),
):
    content = file.file.read()
    url = _save_upload(content, set(ALLOWED_FORMATS.values()), request)
    return {"url": url}


@router.post("/orders/receipt")
def upload_receipt(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(get_current_user),
):
    """Sube el comprobante de pago del comprador (imagen o PDF).

    El comprador está autenticado; el archivo se guarda con un nombre aleatorio y
    se sirve desde `/uploads`. La URL resultante se incluye al crear la orden.
    """
    content = file.file.read()
    url = _save_upload(content, set(RECEIPT_FORMATS.values()), request)
    return {"url": url}
