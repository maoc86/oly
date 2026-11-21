"""Configuración de pytest: base MySQL aislada para tests.

Requiere una base MySQL de test (variable DATABASE_URL). El fixture de sesión
`_migrate` deja la base vacía y aplica las migraciones Alembic desde cero.
"""

import os
import subprocess

# Debe fijarse ANTES de importar app.* (settings es un singleton a nivel módulo).
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("ALGORITHM", "HS256")
os.environ.setdefault(
    "DATABASE_URL",
    "mysql+pymysql://oly:oly_pass@localhost:3307/oly_test_db",
)
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("APP_URL", "http://localhost:3000")

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

import pytest
from sqlalchemy import text


@pytest.fixture(scope="session", autouse=True)
def _migrate():
    from app.database import engine
    from app.config import settings

    # Base limpia: borra todas las tablas para validar el arranque desde cero.
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        tables = [r[0] for r in conn.execute(text("SHOW TABLES")).fetchall()]
        for t in tables:
            conn.execute(text(f"DROP TABLE IF EXISTS `{t}`"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))

    subprocess.run(
        ["alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        check=True,
        env={**os.environ, "DATABASE_URL": settings.DATABASE_URL},
    )


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def db_session_factory():
    from app.database import SessionLocal

    return SessionLocal


@pytest.fixture(scope="session")
def admin_token(client, db_session_factory):
    from app.models import User, UserRole, UserRoleLink

    r = client.post(
        "/auth/register",
        json={"name": "Admin Test", "email": "admin@test.com", "password": "password123"},
    )
    assert r.status_code == 200, r.text
    db = db_session_factory()
    u = db.query(User).filter(User.email == "admin@test.com").first()
    u.role = UserRole.ADMIN
    u.role_links.append(UserRoleLink(role=UserRole.ADMIN.value))
    db.commit()
    db.close()
    # re-login to get a token with admin role
    r = client.post(
        "/auth/login",
        json={"email": "admin@test.com", "password": "password123"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def buyer_token(client):
    r = client.post(
        "/auth/register",
        json={"name": "Comprador Test", "email": "buyer@test.com", "password": "password123"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def category_id(client, admin_token):
    r = client.post(
        "/admin/categories",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"name": "Leggings", "slug": "leggings", "icon": "layers"},
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]


@pytest.fixture(scope="session")
def product_with_variants(client, admin_token, category_id):
    r = client.post(
        "/admin/products",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Legging Test",
            "slug": "legging-test",
            "sku": "LG-TEST",
            "price": 25.0,
            "category_id": category_id,
            "gender": "mujer",
            "variants": [
                {"size": "S", "color": "Negro", "stock": 10, "min_stock": 2},
                {"size": "M", "color": "Negro", "stock": 15, "min_stock": 2},
            ],
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def payment_method_id(client, admin_token):
    r = client.post(
        "/admin/payment-methods",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "name": "Punto de venta (tarjeta)",
            "type": "card",
            "is_active": True,
            "currency": "USD",
            "requires_reference": False,
            "requires_receipt": False,
            "available_at_pos": True,
            "is_cash": False,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()["id"]