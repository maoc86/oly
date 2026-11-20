"""Gestión de usuarios del panel admin (CRUD, multi-rol y permisos por acción).

Un usuario puede tener **varios roles** (``user_roles``) y, además, permisos
puntuales concedidos o denegados por encima de lo que dan sus roles
(``user_permissions``). Acá se administran ambos.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserPermission, UserRoleLink
from app.permissions import (
    PERMISSION_CODE_SET,
    PERMISSIONS,
    ROLE_DEFAULTS,
    VALID_ROLES,
    effective_permissions,
    normalize_roles,
    primary_role,
)
from app.schemas import (
    AdminUserCreate,
    AdminUserUpdate,
    PermissionInfo,
    PermissionsCatalog,
    UserPermissionsUpdate,
    UserResponse,
    UserRolesUpdate,
)
from app.utils.auth import hash_password, require_permission

router = APIRouter(prefix="/admin/users", tags=["admin-users"])
# Catálogo de permisos (ruta propia, para no colgar de /admin/users).
catalog_router = APIRouter(prefix="/admin/permissions", tags=["admin-users"])

require_users_manage = require_permission("users.manage")


# ─── Helpers ─────────────────────────────────────────────────────────
def _get_user(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


def _validate_codes(codes) -> list[str]:
    out: list[str] = []
    for code in codes or []:
        if code not in PERMISSION_CODE_SET:
            raise HTTPException(status_code=400, detail=f"Permiso inválido: {code}")
        if code not in out:
            out.append(code)
    return out


def _set_roles(db: Session, user: User, roles) -> list[str]:
    try:
        wanted = normalize_roles(roles)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    if not wanted:
        raise HTTPException(status_code=400, detail="El usuario debe tener al menos un rol")

    db.query(UserRoleLink).filter(UserRoleLink.user_id == user.id).delete(synchronize_session=False)
    for role in wanted:
        db.add(UserRoleLink(user_id=user.id, role=role))
    user.role = primary_role(wanted)
    return wanted


def _set_overrides(db: Session, user: User, grants, denies) -> tuple[list[str], list[str]]:
    grant_list = _validate_codes(grants)
    deny_list = _validate_codes(denies)
    # Un permiso no puede concederse y denegarse a la vez: gana el "deny".
    grant_list = [c for c in grant_list if c not in deny_list]

    db.query(UserPermission).filter(UserPermission.user_id == user.id).delete(synchronize_session=False)
    for code in grant_list:
        db.add(UserPermission(user_id=user.id, code=code, effect="grant"))
    for code in deny_list:
        db.add(UserPermission(user_id=user.id, code=code, effect="deny"))
    return grant_list, deny_list


def _future_permissions(roles, grants, denies) -> set[str]:
    codes: set[str] = set()
    for role in roles:
        codes |= ROLE_DEFAULTS.get(role, set())
    codes |= set(grants or [])
    codes -= set(denies or [])
    return codes


def _assert_admin_remains(
    db: Session,
    target: User,
    *,
    new_roles=None,
    new_grants=None,
    new_denies=None,
    new_active: Optional[bool] = None,
) -> None:
    """Impide dejar el sistema sin un administrador que pueda gestionarlo.

    Debe quedar al menos un usuario activo con ``admin.access`` **y**
    ``users.manage``; de lo contrario nadie podría volver a entrar al panel ni
    reparar los permisos.
    """
    def _can_manage(user: User) -> bool:
        perms = effective_permissions(user)
        return "admin.access" in perms and "users.manage" in perms

    others = (
        db.query(User)
        .filter(User.id != target.id, User.is_active == True)  # noqa: E712
        .all()
    )
    if any(_can_manage(u) for u in others):
        return

    # El usuario objetivo debe seguir siendo un admin activo y capaz de gestionar.
    active = target.is_active if new_active is None else new_active
    if not active:
        raise HTTPException(
            status_code=400,
            detail="No podés desactivar al único administrador activo.",
        )
    roles = target.role_names() if new_roles is None else set(new_roles)
    grants = (
        {o.code for o in target.permission_overrides if o.effect == "grant"}
        if new_grants is None
        else set(new_grants)
    )
    denies = (
        {o.code for o in target.permission_overrides if o.effect == "deny"}
        if new_denies is None
        else set(new_denies)
    )
    if "admin.access" not in _future_permissions(roles, grants, denies):
        raise HTTPException(
            status_code=400,
            detail="Debe quedar al menos un administrador con acceso al panel.",
        )
    if "users.manage" not in _future_permissions(roles, grants, denies):
        raise HTTPException(
            status_code=400,
            detail="Debe quedar al menos un usuario con permiso para gestionar usuarios.",
        )


# ─── Catálogo de permisos ────────────────────────────────────────────
@catalog_router.get("", response_model=PermissionsCatalog)
def permissions_catalog(current_user: User = Depends(require_users_manage)):
    """Catálogo de permisos + qué otorga cada rol por defecto (para la matriz)."""
    return PermissionsCatalog(
        permissions=[PermissionInfo(code=p.code, label=p.label, group=p.group) for p in PERMISSIONS],
        role_defaults={role: sorted(codes) for role, codes in ROLE_DEFAULTS.items()},
        roles=VALID_ROLES,
    )


# ─── Listado / detalle ───────────────────────────────────────────────
@router.get("", response_model=list[UserResponse])
def list_users(
    role: str = None,
    search: str = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_users_manage),
):
    query = db.query(User)
    if role:
        try:
            wanted = normalize_roles([role])[0]
        except ValueError:
            raise HTTPException(status_code=400, detail="Rol inválido")
        query = query.join(UserRoleLink, UserRoleLink.user_id == User.id).filter(
            UserRoleLink.role == wanted
        )
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(or_(User.name.like(term), User.email.like(term)))
    users = query.order_by(User.name).offset(skip).limit(limit).all()
    return [UserResponse.from_user(u) for u in users]


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_users_manage),
):
    return UserResponse.from_user(_get_user(db, user_id))


# ─── Alta ────────────────────────────────────────────────────────────
@router.post("", response_model=UserResponse)
def create_user(
    data: AdminUserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_users_manage),
):
    name = (data.name or "").strip()
    email = (data.email or "").strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")
    if len(data.password or "") < 8:
        raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    roles = normalize_roles(data.roles or ["user"])
    if not roles:
        raise HTTPException(status_code=400, detail="El usuario debe tener al menos un rol")

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(data.password),
        phone=(data.phone or None),
        is_active=data.is_active,
        role=primary_role(roles),
    )
    db.add(user)
    db.flush()

    _set_roles(db, user, roles)
    _set_overrides(db, user, data.grants, data.denies)

    db.commit()
    db.refresh(user)
    return UserResponse.from_user(user)


# ─── Edición ─────────────────────────────────────────────────────────
@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_users_manage),
):
    user = _get_user(db, user_id)

    new_active = data.is_active if data.is_active is not None else user.is_active
    future_roles = normalize_roles(data.roles) if data.roles is not None else user.role_names()
    if data.roles is not None and not future_roles:
        raise HTTPException(status_code=400, detail="El usuario debe tener al menos un rol")

    _assert_admin_remains(
        db,
        user,
        new_roles=future_roles,
        new_grants=data.grants,
        new_denies=data.denies,
        new_active=new_active,
    )

    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="El nombre no puede estar vacío")
        user.name = name
    if data.email is not None:
        email = data.email.strip().lower()
        if db.query(User).filter(User.email == email, User.id != user.id).first():
            raise HTTPException(status_code=400, detail="El email ya está registrado")
        user.email = email
    if data.phone is not None:
        user.phone = data.phone.strip() or None
    if data.password:
        if len(data.password) < 8:
            raise HTTPException(status_code=400, detail="La contraseña debe tener al menos 8 caracteres")
        user.password_hash = hash_password(data.password)
    user.is_active = new_active

    if data.roles is not None:
        _set_roles(db, user, data.roles)
    if data.grants is not None or data.denies is not None:
        _set_overrides(db, user, data.grants or [], data.denies or [])

    db.commit()
    db.refresh(user)
    return UserResponse.from_user(user)


@router.put("/{user_id}/roles", response_model=UserResponse)
def set_user_roles(
    user_id: int,
    data: UserRolesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_users_manage),
):
    user = _get_user(db, user_id)
    roles = normalize_roles(data.roles)
    if not roles:
        raise HTTPException(status_code=400, detail="El usuario debe tener al menos un rol")
    _assert_admin_remains(db, user, new_roles=roles)
    _set_roles(db, user, roles)
    db.commit()
    db.refresh(user)
    return UserResponse.from_user(user)


@router.put("/{user_id}/permissions", response_model=UserResponse)
def set_user_permissions(
    user_id: int,
    data: UserPermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_users_manage),
):
    user = _get_user(db, user_id)
    deny_list = _validate_codes(data.denies)
    _assert_admin_remains(db, user, new_grants=data.grants, new_denies=deny_list)
    _set_overrides(db, user, data.grants, deny_list)
    db.commit()
    db.refresh(user)
    return UserResponse.from_user(user)


@router.put("/{user_id}/toggle-active")
def toggle_user_active(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_users_manage),
):
    user = _get_user(db, user_id)
    _assert_admin_remains(db, user, new_active=not user.is_active)
    user.is_active = not user.is_active
    db.commit()
    return {"detail": f"Usuario {'activado' if user.is_active else 'desactivado'}"}


@router.put("/{user_id}/role")
def change_user_role(
    user_id: int,
    role: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_users_manage),
):
    """Compatibilidad: reemplaza todos los roles por uno solo."""
    user = _get_user(db, user_id)
    try:
        roles = normalize_roles([role])
    except ValueError:
        raise HTTPException(status_code=400, detail="Rol inválido")
    _assert_admin_remains(db, user, new_roles=roles)
    _set_roles(db, user, [role])
    db.commit()
    return {"detail": f"Rol cambiado a {role}"}
