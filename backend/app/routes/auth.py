from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db
from app.mailer import build_base_context, send_template_email
from app.models import User, UserRole, UserRoleLink
from app.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
    ChangePassword,
    Token,
    ForgotPassword,
    ResetPassword,
    RefreshRequest,
)
from app.utils.auth import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from app.utils.rate_limit import login_rate_limit, register_rate_limit

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=Token)
def register(
    data: UserCreate,
    db: Session = Depends(get_db),
    _: None = Depends(register_rate_limit),
):
    email = data.email.strip().lower()
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    user = User(
        name=data.name,
        email=email,
        password_hash=hash_password(data.password),
        phone=data.phone,
        role=UserRole.USER,
    )
    user.role_links.append(UserRoleLink(role=UserRole.USER.value))
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token(user.id)
    if user.role == UserRole.USER:
        context = build_base_context(db)
        context.update({"nombre": user.name, "link": f"{settings.APP_URL}/login"})
        send_template_email(db, "welcome", user.email, context)
    return Token(
        access_token=token,
        refresh_token=refresh_token,
        user=UserResponse.from_user(user),
    )


@router.post("/login", response_model=Token)
def login(
    data: UserLogin,
    db: Session = Depends(get_db),
    _: None = Depends(login_rate_limit),
):
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Usuario desactivado")
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    refresh_token = create_refresh_token(user.id)
    return Token(
        access_token=token,
        refresh_token=refresh_token,
        user=UserResponse.from_user(user),
    )


@router.post("/refresh", response_model=Token)
def refresh(
    data: RefreshRequest,
    db: Session = Depends(get_db),
):
    """Renueva el token de acceso a partir de un refresh token válido.

    Devuelve un par nuevo (access + refresh) y los datos actualizados del usuario,
    de modo que el frontend también refresque roles y permisos sin re-login. Si el
    refresh token es inválido, expirado o el usuario ya no está activo, responde 401
    y el cliente cierra la sesión.
    """
    payload = decode_token(data.refresh_token)
    if payload.get("scope") != "refresh":
        raise HTTPException(status_code=401, detail="Token de refresco inválido")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token de refresco inválido")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado o inactivo")
    return Token(
        access_token=create_access_token(data={"sub": str(user.id), "role": user.role.value}),
        refresh_token=create_refresh_token(user.id),
        user=UserResponse.from_user(user),
    )


@router.post("/forgot-password")
def forgot_password(
    data: ForgotPassword,
    db: Session = Depends(get_db),
    _: None = Depends(login_rate_limit),
):
    """Envía un correo con enlace para restablecer la contraseña.

    Responde siempre 200 para no revelar qué emails están registrados.
    """
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user and user.is_active:
        minutes = 60
        reset_token = create_access_token(
            data={"sub": str(user.id), "scope": "reset"},
            expires_delta=timedelta(minutes=minutes),
        )
        context = build_base_context(db)
        context.update(
            {
                "nombre": user.name,
                "link": f"{settings.APP_URL}/reset-password?token={reset_token}",
                "expira": f"{minutes} minutos",
            }
        )
        send_template_email(db, "reset_password", user.email, context)
    return {"message": "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña."}


@router.post("/reset-password")
def reset_password(
    data: ResetPassword,
    db: Session = Depends(get_db),
):
    if len(data.password) < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    payload = decode_token(data.token)
    if payload.get("scope") != "reset":
        raise HTTPException(status_code=400, detail="Token inválido")
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=400, detail="Token inválido")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Token inválido")
    user.password_hash = hash_password(data.password)
    db.commit()
    return {"message": "Contraseña actualizada correctamente."}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return UserResponse.from_user(current_user)


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """El propio usuario edita sus datos de perfil (nombre, teléfono y cédula)."""
    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío.")
        current_user.name = name
    if data.phone is not None:
        current_user.phone = data.phone.strip() or None
    if data.cedula is not None:
        current_user.cedula = data.cedula.strip() or None
    db.commit()
    db.refresh(current_user)
    return UserResponse.from_user(current_user)


@router.post("/change-password")
def change_password(
    data: ChangePassword,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cambio de contraseña desde el perfil, validando la contraseña actual."""
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="La contraseña actual no es correcta.")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 8 caracteres")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Contraseña actualizada correctamente."}
