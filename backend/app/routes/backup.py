"""Backup de la base de datos (descarga SQL)."""
import os
import subprocess
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.utils.auth import require_permission
from app.models import User

router = APIRouter(prefix="/admin/backup", tags=["admin-backup"])


@router.get("/db")
def download_db_backup(current_user: User = Depends(require_permission("settings.manage"))):
    url = os.getenv("DATABASE_URL", "")
    parsed = urlparse(url)
    user = parsed.username or "ticketing"
    password = parsed.password or ""
    host = parsed.hostname or "db"
    port = str(parsed.port or 3306)
    db_name = (parsed.path or "/ticketing_db").lstrip("/")

    cmd = [
        "mysqldump",
        "-h", host,
        "-P", port,
        "-u", user,
        f"-p{password}",
        "--single-transaction",
        "--routines",
        "--default-character-set=utf8mb4",
        db_name,
    ]

    def stream():
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        for chunk in iter(lambda: proc.stdout.read(65536), b""):
            yield chunk
        proc.wait()

    from datetime import datetime
    filename = f"oly_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    return StreamingResponse(
        stream(),
        media_type="application/sql",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
