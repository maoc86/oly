"""Tests de órdenes (checkout + confirmación)."""

import pytest


def test_create_order(client, buyer_token, product_with_variants, admin_token, payment_method_id):
    variant = product_with_variants["variants"][0]
    prod = client.get(
        f"/admin/products/{product_with_variants['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()
    initial_stock = next(v for v in prod["variants"] if v["id"] == variant["id"])["stock"]

    r = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"product_variant_id": variant["id"], "quantity": 2}],
            "payment_method_id": payment_method_id,
            "terms_accepted": True,
        },
    )
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["status"] == "pending"
    assert order["total"] == "58.00"  # 2 * 25 + 16% IVA = 50 + 8

    # Stock se decrementó en 2.
    prod = client.get(
        f"/admin/products/{product_with_variants['id']}",
        headers={"Authorization": f"Bearer {admin_token}"},
    ).json()
    updated_variant = next(v for v in prod["variants"] if v["id"] == variant["id"])
    assert updated_variant["stock"] == initial_stock - 2


def test_order_requires_terms(client, buyer_token, product_with_variants, payment_method_id):
    variant = product_with_variants["variants"][0]
    r = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"product_variant_id": variant["id"], "quantity": 1}],
            "payment_method_id": payment_method_id,
            "terms_accepted": False,
        },
    )
    assert r.status_code == 400


def test_order_requires_valid_payment_method(client, buyer_token, product_with_variants, payment_method_id):
    variant = product_with_variants["variants"][0]
    r = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"product_variant_id": variant["id"], "quantity": 1}],
            "payment_method_id": 9999,
            "terms_accepted": True,
        },
    )
    assert r.status_code == 400


def test_confirm_order_completes_and_records_income(client, buyer_token, product_with_variants, admin_token, payment_method_id):
    variant = product_with_variants["variants"][1]
    r = client.post(
        "/orders",
        headers={"Authorization": f"Bearer {buyer_token}"},
        json={
            "items": [{"product_variant_id": variant["id"], "quantity": 1}],
            "payment_method_id": payment_method_id,
            "terms_accepted": True,
        },
    )
    assert r.status_code == 200, r.text
    order_id = r.json()["id"]

    # Confirmar
    r = client.post(
        f"/orders/admin/{order_id}/confirm",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "completed"

    # Ingreso registrado en finanzas
    fin = client.get("/admin/finance/summary", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert fin["total_sales"] > 0