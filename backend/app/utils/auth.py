from datetime import datetime, timedelta
from typing import Optional
import bcrypt
import jwt
from jwt.exceptions import InvalidTokenError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.models import User, UserRole
from app.permissions import effective_permissions, has_permission

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    """Token de vida larga para renovar el acceso sin volver a iniciar sesión."""
    return create_access_token(
        data={"sub": str(user_id), "scope": "refresh"},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Token inválido")
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token inválido")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")
    return user


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    if credentials is None or not credentials.credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        if user_id is None:
            return None
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user or not user.is_active:
            return None
        return user
    except Exception:
        return None



def require_permission(code: str):
    """Dependencia de FastAPI: exige un permiso por acción concreto."""

    def _dependency(current_user: User = Depends(get_current_user)) -> User:
        if not has_permission(current_user, code):
            raise HTTPException(status_code=403, detail="No tenés permiso para esta acción")
        return current_user

    return _dependency


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not has_permission(current_user, "admin.access"):
        raise HTTPException(status_code=403, detail="Se requieren permisos de administrador")
    return current_user


def require_vendedor(current_user: User = Depends(get_current_user)) -> User:
    """Panel de POS: vendedores y administradores (soporte/pruebas)."""
    if not has_permission(current_user, "pos.sell"):
        raise HTTPException(status_code=403, detail="Se requieren permisos de vendedor")
    return current_user

