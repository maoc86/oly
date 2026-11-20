"""Motor de venta compartido por el checkout online y el POS.

Acá vive la lógica de reserva/descuento de stock, el desglose de importes y el
snapshot de cobro, para que la compra online (``POST /orders``) y la venta
presencial (``POST /pos/sales``) se comporten igual y no se dupliquen reglas.
"""

from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    InventoryMovement,
    Order,
    OrderItem,
    PaymentMethod,
    ProductVariant,
    ShippingMethod,
)
from app.routes.settings_exchange import get_active_usd_rate


def _money(value) -> float:
    """Redondeo a 2 decimales para que las sumas cuadren exactamente."""
    return round(float(value) + 1e-9, 2)


SUPPORTED_PAYMENT_CURRENCIES = ("USD", "VES")


def validate_limits(items: int, subtotal: float, config: dict) -> None:
    """Límites de compra configurables. 0 = sin límite."""
    max_items = int(config.get("max_items_per_order", 0) or 0)
    if max_items and items > max_items:
        raise HTTPException(
            status_code=400,
            detail=f"Solo se permiten {max_items} artículo(s) por orden.",
        )
    min_total = float(config.get("min_order_total", 0) or 0)
    if min_total and subtotal < min_total:
        raise HTTPException(
            status_code=400,
            detail=f"La compra mínima es {_money(min_total)}.",
        )
    max_total = float(config.get("max_order_total", 0) or 0)
    if max_total and subtotal > max_total:
        raise HTTPException(
            status_code=400,
            detail=f"La compra máxima es {_money(max_total)}.",
        )


def snapshot_payment_amount(order: Order, pm: Optional[PaymentMethod], db: Session) -> None:
    """Fija en la orden la moneda de cobro, la tasa aplicada y el importe a pagar.

    Los totales de la orden se calculan en USD. Si el método cobra en Bs. guardamos
    el importe convertido y la tasa usada en ese momento, para poder conciliar
    aunque la tasa cambie después.
    """
    currency = ((pm.currency if pm else None) or "USD").strip().upper()
    if currency not in SUPPORTED_PAYMENT_CURRENCIES:
        raise HTTPException(
            status_code=400,
            detail=f"{currency} todavía no se puede cobrar. Configurá el método en USD o Bs.",
        )

    order.payment_currency = currency

    if currency == "USD":
        order.payment_rate = Decimal("1")
        order.payment_total = order.total
        return

    rate = get_active_usd_rate(db)
    if rate is None or rate <= 0:
        raise HTTPException(
            status_code=400,
            detail="No hay tasa de cambio disponible para cobrar en bolívares.",
        )
    order.payment_rate = Decimal(str(round(float(rate), 4)))
    order.payment_total = Decimal(str(_money(float(order.total) * float(rate))))


def compute_shipping_cost(
    shipping_method: Optional[ShippingMethod],
    subtotal: float,
    config: dict,
) -> float:
    """Costo de envío: 0 si no hay método, o gratis si supera el umbral."""
    if shipping_method is None:
        return 0.0
    threshold = float(config.get("free_shipping_threshold", 0) or 0)
    if threshold > 0 and subtotal >= threshold:
        return 0.0
    return _money(float(shipping_method.price or 0))


def reserve_order(
    db: Session,
    order: Order,
    *,
    items,
    config: dict,
    payment_method: Optional[PaymentMethod] = None,
    shipping_method: Optional[ShippingMethod] = None,
    discount: float = 0.0,
    enforce_limits: bool = True,
    is_pos: bool = False,
) -> Order:
    """Descuenta stock, crea los items y completa los importes de una orden.

    ``order`` debe venir ya agregada a la sesión (``db.flush()``). Crea los
    ``OrderItem``, descuenta el stock de cada variante, registra el movimiento de
    inventario correspondiente, valida los límites de compra y calcula
    ``subtotal/discount/tax/shipping/total`` + el snapshot de cobro. No hace commit:
    el llamador decide cuándo confirmar la transacción.
    """
    variant_ids = [item.product_variant_id for item in items]
    locked = (
        db.query(ProductVariant)
        .filter(ProductVariant.id.in_(variant_ids))
        .with_for_update()
        .all()
    )
    v_by_id = {v.id: v for v in locked}
    if len(v_by_id) != len(set(variant_ids)):
        missing = sorted(set(variant_ids) - set(v_by_id))
        raise HTTPException(status_code=404, detail=f"Variante no encontrada: {missing}")

    subtotal = 0.0
    total_items = 0
    for item_data in items:
        v = v_by_id[item_data.product_variant_id]
        if not v.is_active or (v.product and not v.product.is_active):
            raise HTTPException(status_code=400, detail="Uno de los productos ya no está disponible.")
        if v.stock < item_data.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Stock insuficiente para {v.product.name} ({v.size} / {v.color}). Disponibles: {v.stock}",
            )

        unit_price = Decimal(str(v.get_price()))
        line_subtotal = _money(float(unit_price) * item_data.quantity)
        subtotal = _money(subtotal + line_subtotal)
        total_items += item_data.quantity

        order_item = OrderItem(
            order_id=order.id,
            product_id=v.product_id,
            product_variant_id=v.id,
            quantity=item_data.quantity,
            unit_price=unit_price,
            subtotal=Decimal(str(line_subtotal)),
            size=v.size,
            color=v.color,
        )
        db.add(order_item)
        db.flush()

        # Descuento de stock + movimiento de inventario.
        previous_stock = v.stock
        v.stock -= item_data.quantity
        db.add(
            InventoryMovement(
                product_id=v.product_id,
                product_variant_id=v.id,
                user_id=order.sold_by_id if is_pos else order.user_id,
                movement_type="sale_pos" if is_pos else "sale_web",
                quantity=-item_data.quantity,
                previous_stock=previous_stock,
                new_stock=v.stock,
                reference=f"Orden #{order.id}",
            )
        )

    if enforce_limits:
        validate_limits(total_items, subtotal, config)

    order.subtotal = Decimal(str(subtotal))
    finalize_totals(
        order,
        config=config,
        payment_method=payment_method,
        shipping_method=shipping_method,
        discount=discount,
        db=db,
    )
    return order


def finalize_totals(
    order: Order,
    *,
    config: dict,
    payment_method: Optional[PaymentMethod] = None,
    shipping_method: Optional[ShippingMethod] = None,
    discount: float = 0.0,
    db: Session,
) -> Order:
    """Calcula descuento/impuesto/envío/total y fija el snapshot de cobro.

    Útil para re-calcular los totales después de aplicar un cupón: la orden ya
    tiene ``subtotal`` (reservada) y acá se completan el resto de importes.
    """
    subtotal = float(order.subtotal or 0)
    discount = _money(max(0.0, float(discount)))
    if discount > subtotal:
        discount = subtotal
    taxable = _money(subtotal - discount)

    tax_pct = float(config.get("tax_percent", 0) or 0)
    tax = _money(taxable * tax_pct / 100)

    shipping = compute_shipping_cost(shipping_method, subtotal, config)
    total = _money(taxable + tax + shipping)

    order.discount = Decimal(str(discount))
    order.tax = Decimal(str(tax))
    order.shipping = Decimal(str(shipping))
    order.total = Decimal(str(total))

    snapshot_payment_amount(order, payment_method, db)
    return order
