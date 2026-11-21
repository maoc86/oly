"""Tests del POS (venta presencial + caja)."""

import pytest


def test_pos_requires_open_cash_session(client, admin_token, product_with_variants, payment_method_id):
    variant = product_with_variants["variants"][0]
    # Sin caja abierta, la venta falla.
    r = client.post(
        "/pos/sales",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "items": [{"product_variant_id": variant["id"], "quantity": 1}],
            "payment_method_id": payment_method_id,
            "buyer": {"name": "Cliente POS"},
            "send_email": False,
        },
    )
    assert r.status_code == 400
    assert "caja" in r.json()["detail"].lower()


def test_pos_sale_completes_and_decrements_stock(client, admin_token, product_with_variants, payment_method_id):
    # Abrir caja
    r = client.post(
        "/pos/cash/open",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"opening_float": 100},
    )
    assert r.status_code == 200, r.text

    variant = product_with_variants["variants"][0]
    # Stock actual (el fixture puede estar desactualizado por otras pruebas)
    prod = client.get(
        f"/admin/products/{product_with_variants['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()
    current_variant = next(v for v in prod["variants"] if v["id"] == variant["id"])
    initial_stock = current_variant["stock"]

    r = client.post(
        "/pos/sales",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "items": [{"product_variant_id": variant["id"], "quantity": 2}],
            "payment_method_id": payment_method_id,
            "buyer": {"name": "Cliente POS", "cedula": "V-123", "phone": "0412", "email": "pos@test.com"},
            "send_email": False,
        },
    )
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["status"] == "completed"
    assert order["channel"] == "pos"

    # Stock decrementado
    prod = client.get(
        f"/admin/products/{product_with_variants['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()
    updated_variant = next(v for v in prod["variants"] if v["id"] == variant["id"])
    assert updated_variant["stock"] == initial_stock - 2

    # Ingreso registrado
    fin = client.get("/admin/finance/summary", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert fin["total_sales"] > 0

    # Cerrar caja
    session_id = order["cash_session_id"]
    r = client.post(
        f"/pos/cash/{session_id}/close",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"counted_cash": 100, "notes": "test"},
    )
    assert r.status_code == 200, r.text