"""Seed: crea un usuario administrador, categorías y métodos de pago por defecto.

Uso:
    SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... python -m app.seed

No hay credenciales por defecto: SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son
obligatorias (SEED_ADMIN_NAME y SEED_ADMIN_PHONE son opcionales).
"""
import os
import unicodedata
import re

from app.database import SessionLocal
from app.models import User, UserRole, UserRoleLink, Category, PaymentMethod
from app.utils.auth import hash_password


def slugify(name: str) -> str:
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = name.lower().strip()
    name = re.sub(r"[^a-z0-9]+", "-", name)
    return name.strip("-")


DEFAULT_CATEGORIES = [
    {"name": "Tops y Brasiers", "icon": "shirt"},
    {"name": "Leggings", "icon": "layers"},
    {"name": "Shorts", "icon": "scissors"},
    {"name": "Conjuntos", "icon": "sparkles"},
    {"name": "Sudaderas y Hoodies", "icon": "hoodie"},
    {"name": "Chaquetas", "icon": "wind"},
    {"name": "Accesorios", "icon": "watch"},
    {"name": "Calzado", "icon": "footprints"},
]

DEFAULT_PAYMENT_METHODS = [
    {"name": "Pago móvil", "type": "wallet", "currency": "VES", "requires_reference": True, "requires_receipt": True, "available_at_pos": True, "is_cash": False},
    {"name": "Transferencia bancaria", "type": "transfer", "currency": "USD", "requires_reference": True, "requires_receipt": True, "available_at_pos": False, "is_cash": False},
    {"name": "Zelle", "type": "transfer", "currency": "USD", "requires_reference": True, "requires_receipt": True, "available_at_pos": False, "is_cash": False},
    {"name": "Binance / USDT", "type": "crypto", "currency": "USD", "requires_reference": True, "requires_receipt": True, "available_at_pos": False, "is_cash": False},
    {"name": "Efectivo", "type": "cash", "currency": "USD", "requires_reference": False, "requires_receipt": False, "available_at_pos": True, "is_cash": True},
    {"name": "Punto de venta (tarjeta)", "type": "card", "currency": "USD", "requires_reference": False, "requires_receipt": False, "available_at_pos": True, "is_cash": False},
]


def get_admin_credentials():
    """Credenciales del admin solo por variables de entorno (sin defaults inseguros)."""
    email = os.getenv("SEED_ADMIN_EMAIL")
    password = os.getenv("SEED_ADMIN_PASSWORD")
    if not email or not password:
        raise RuntimeError(
            "SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son obligatorias para crear el administrador. "
            "Definilas como variables de entorno al ejecutar `python -m app.seed`."
        )
    if len(password) < 8:
        raise RuntimeError("SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres.")
    return {
        "name": os.getenv("SEED_ADMIN_NAME", "Administradora"),
        "email": email.strip().lower(),
        "password": password,
        "phone": os.getenv("SEED_ADMIN_PHONE"),
    }


def seed_admin(db):
    existing_admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
    if existing_admin:
        print(f"Ya existe un administrador: {existing_admin.email} (id={existing_admin.id}). No se creó nada nuevo.")
        return

    creds = get_admin_credentials()
    if db.query(User).filter(User.email == creds["email"]).first():
        print(f"Ya existe un usuario con el email {creds['email']} pero su rol no es admin. Nada que hacer.")
        return

    user = User(
        name=creds["name"],
        email=creds["email"],
        password_hash=hash_password(creds["password"]),
        phone=creds["phone"],
        role=UserRole.ADMIN,
        is_active=True,
    )
    user.role_links.append(UserRoleLink(role=UserRole.ADMIN.value))
    db.add(user)
    db.commit()
    db.refresh(user)
    print(f"Administrador creado: {user.email} (id={user.id})")


def seed_categories(db):
    existing = {c.name for c in db.query(Category).all()}
    added = 0
    for cat in DEFAULT_CATEGORIES:
        if cat["name"] not in existing:
            db.add(Category(name=cat["name"], slug=slugify(cat["name"]), icon=cat["icon"]))
            added += 1
    if added:
        db.commit()
        print(f"{added} categorías creadas.")
    else:
        print("No se crearon categorías nuevas (ya existían todas).")


def seed_payment_methods(db):
    existing = {pm.name for pm in db.query(PaymentMethod).all()}
    added = 0
    for pm in DEFAULT_PAYMENT_METHODS:
        if pm["name"] not in existing:
            db.add(PaymentMethod(
                name=pm["name"],
                type=pm["type"],
                is_active=True,
                config=None,
                currency=pm.get("currency", "USD"),
                requires_reference=pm.get("requires_reference", True),
                requires_receipt=pm.get("requires_receipt", False),
                available_at_pos=pm.get("available_at_pos", False),
                is_cash=pm.get("is_cash", False),
            ))
            added += 1
    if added:
        db.commit()
        print(f"{added} métodos de pago creados.")
    else:
        print("No se crearon métodos de pago nuevos (ya existían todos).")


def seed():
    # El esquema se crea con `alembic upgrade head` (no aquí).
    db = SessionLocal()
    try:
        seed_admin(db)
        seed_categories(db)
        seed_payment_methods(db)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
