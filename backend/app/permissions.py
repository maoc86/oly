"""Permisos por acción y roles como paquetes por defecto.

El catálogo de permisos vive en código (no en base de datos) para que siempre esté
sincronizado con lo que la aplicación realmente chequea. En la base solo se guardan:

- ``user_roles``: qué roles tiene cada usuario (multi-rol).
- ``user_permissions``: excepciones por usuario (``grant``/``deny``).

Los permisos efectivos de un usuario son: (permisos que otorgan sus roles) + los
``grant`` - los ``deny``.
"""

from dataclasses import dataclass

from app.models import User, UserRole


@dataclass(frozen=True)
class Permission:
    code: str
    label: str
    group: str


# Catálogo completo. El orden define cómo se agrupa en la UI de gestión de usuarios.
PERMISSIONS: list[Permission] = [
    # Acceso
    Permission("admin.access", "Acceder al panel de administración", "Acceso"),
    Permission("traffic.view", "Ver el panel de tráfico", "Acceso"),
    # Configuración
    Permission("settings.manage", "Editar la configuración del sitio", "Configuración"),
    Permission("templates.manage", "Editar las plantillas de correo", "Configuración"),
    # Usuarios
    Permission("users.manage", "Gestionar usuarios, roles y permisos", "Usuarios"),
    # Catálogo
    Permission("products.manage", "Gestionar productos e inventario", "Catálogo"),
    Permission("categories.manage", "Gestionar categorías", "Catálogo"),
    Permission("shipping.manage", "Gestionar métodos de envío", "Catálogo"),
    # Ventas
    Permission("orders.view_all", "Ver todas las ventas", "Ventas"),
    Permission("orders.manage", "Confirmar, cancelar o reembolsar ventas", "Ventas"),
    Permission("coupons.manage", "Gestionar cupones y descuentos", "Ventas"),
    # POS
    Permission("pos.access", "Ver el panel de punto de venta", "POS"),
    Permission("pos.sell", "Vender productos en el POS", "POS"),
    Permission("pos.cash.manage", "Abrir y cerrar la caja del POS", "POS"),
    # Cajas
    Permission("cash.view_all", "Supervisar las cajas de todos los vendedores", "POS"),
    # Pagos
    Permission("payments.manage", "Gestionar los métodos de pago", "Pagos"),
    # Finanzas
    Permission("finance.view_all", "Ver las finanzas globales", "Finanzas"),
    Permission("finance.manage", "Operar finanzas (ingresos, egresos, proveedores)", "Finanzas"),
]

PERMISSION_BY_CODE: dict[str, Permission] = {p.code: p for p in PERMISSIONS}
PERMISSION_CODES: list[str] = [p.code for p in PERMISSIONS]
PERMISSION_CODE_SET: set[str] = set(PERMISSION_CODES)

# Roles válidos (deben coincidir con los valores de ``UserRole``).
# Nota: el rol "user" representa al cliente comprador (rol interno). En la UI se
# muestra como "Cliente". El rol "admin" es el administrador de la tienda y
# "vendedor" es el vendedor de mostrador (POS).
VALID_ROLES: list[str] = [r.value for r in UserRole]

# Permisos que otorga cada rol por defecto. El admin recibe todos.
ROLE_DEFAULTS: dict[str, set[str]] = {
    "admin": set(PERMISSION_CODES),
    "vendedor": {
        "pos.access",
        "pos.sell",
        "pos.cash.manage",
    },
    "user": set(),
}


def normalize_role(role: str) -> str:
    """Normaliza y valida un rol. Lanza ``ValueError`` si no existe."""
    value = (role or "").strip().lower()
    if value not in ROLE_DEFAULTS:
        raise ValueError(f"Rol inválido: {role}")
    return value


def normalize_roles(roles) -> list[str]:
    """Normaliza una lista de roles preservando el orden y quitando repetidos."""
    if isinstance(roles, str):
        roles = [roles]
    seen: set[str] = set()
    out: list[str] = []
    for role in roles or []:
        value = normalize_role(role)
        if value not in seen:
            seen.add(value)
            out.append(value)
    return out


def primary_role(roles) -> UserRole:
    """Rol principal (el que se guarda en ``users.role``), por prioridad."""
    names = set(normalize_roles(roles)) or {"user"}
    for candidate in (UserRole.ADMIN, UserRole.VENDEDOR, UserRole.USER):
        if candidate.value in names:
            return candidate
    return UserRole.USER


def override_codes(user: User, effect: str) -> set[str]:
    return {o.code for o in user.permission_overrides if o.effect == effect}


def effective_permissions(user: User) -> set[str]:
    """Permisos efectivos: roles + grants - denies."""
    codes: set[str] = set()
    for role in user.role_names():
        codes |= ROLE_DEFAULTS.get(role, set())
    codes |= override_codes(user, "grant")
    codes -= override_codes(user, "deny")
    return codes


def has_permission(user: User, code: str) -> bool:
    return code in effective_permissions(user)


def is_admin(user: User) -> bool:
    """Admin de plataforma: entra al panel y ve/administra todo."""
    return has_permission(user, "admin.access")
