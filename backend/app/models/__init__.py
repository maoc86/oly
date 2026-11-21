from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, Boolean,
    ForeignKey, Enum, JSON, Numeric, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.database import Base
import enum


# ─── Enumerados ────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    # Vendedor de tienda: usa el POS para vender presencialmente.
    VENDEDOR = "vendedor"
    USER = "user"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"       # esperando confirmación de pago
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class FinanceEntryType(str, enum.Enum):
    INCOME = "income"
    EXPENSE = "expense"


class CouponType(str, enum.Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class CashSessionStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class PayableStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    CANCELLED = "cancelled"


# ─── Usuarios y permisos ───────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    phone = Column(String(50))
    # Cédula/RIF del comprador. Opcional al registrarse, obligatoria en el checkout.
    cedula = Column(String(40))
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    orders = relationship("Order", back_populates="user", foreign_keys="Order.user_id")
    favorites = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
    inventory_movements = relationship("InventoryMovement", back_populates="user")
    role_links = relationship(
        "UserRoleLink",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    permission_overrides = relationship(
        "UserPermission",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def role_names(self) -> set[str]:
        """Roles del usuario (multi-rol), incluyendo el rol principal por back-compat."""
        names = {link.role for link in self.role_links}
        if self.role is not None:
            names.add(self.role.value if isinstance(self.role, UserRole) else str(self.role))
        return names


class UserRoleLink(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="role_links")

    __table_args__ = (UniqueConstraint("user_id", "role", name="uq_user_role"),)


class UserPermission(Base):
    __tablename__ = "user_permissions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    code = Column(String(80), nullable=False)
    effect = Column(String(10), nullable=False)  # grant | deny
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="permission_overrides")

    __table_args__ = (UniqueConstraint("user_id", "code", name="uq_user_permission"),)


# ─── Catálogo ──────────────────────────────────────────────────────────

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, index=True)
    icon = Column(String(100))
    description = Column(Text)
    image_url = Column(String(500))
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    products = relationship("Product", back_populates="category")


class Product(Base):
    """Prenda / artículo a la venta. Las combinaciones de talla + color son
    ``ProductVariant`` (cada una con su propio SKU, precio y stock)."""

    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(80), unique=True, nullable=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    slug = Column(String(200), unique=True, index=True)
    description = Column(Text)

    # Precios base (los que se muestran; cada variante puede sobreescribirlos).
    price = Column(Numeric(10, 2), nullable=False)           # precio detal
    wholesale_price = Column(Numeric(10, 2), nullable=True)  # precio mayor (opcional)
    offer_price = Column(Numeric(10, 2), nullable=True)      # precio oferta (opcional)
    offer_active = Column(Boolean, default=False, nullable=False)
    cost = Column(Numeric(10, 2), nullable=True)             # costo de compra (márgenes)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    brand = Column(String(120))
    gender = Column(String(20), default="mujer")             # mujer | hombre | unisex

    # Imagen principal + galería (JSON de URLs relativas a /uploads).
    image_url = Column(String(500))
    images = Column(JSON)

    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    is_new = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    category = relationship("Category", back_populates="products")
    variants = relationship(
        "ProductVariant",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductVariant.id",
    )
    favorites = relationship("Favorite", back_populates="product", cascade="all, delete-orphan")
    inventory_movements = relationship("InventoryMovement", back_populates="product")

    def get_display_price(self):
        if self.offer_active and self.offer_price is not None:
            return float(self.offer_price)
        return float(self.price)


class ProductVariant(Base):
    """Combinación talla + color de un producto, con stock propio."""

    __tablename__ = "product_variants"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    sku = Column(String(80), unique=True, nullable=True, index=True)
    size = Column(String(30))          # S, M, L, XL, 36, 38... o "Único"
    color = Column(String(60))         # Negro, Blanco, Rojo...
    # Imagen específica de esta variante (útil para cambiar la foto al elegir color).
    image_url = Column(String(500))
    price_override = Column(Numeric(10, 2), nullable=True)
    stock = Column(Integer, default=0, nullable=False)
    min_stock = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product", back_populates="variants")
    order_items = relationship("OrderItem", back_populates="variant")
    inventory_movements = relationship("InventoryMovement", back_populates="variant")

    __table_args__ = (
        UniqueConstraint("product_id", "size", "color", name="uq_variant_size_color"),
    )

    def get_price(self):
        """Precio efectivo de la variante: override, o el precio del producto."""
        if self.price_override is not None:
            return float(self.price_override)
        return self.product.get_display_price() if self.product else 0.0


# ─── Inventario ────────────────────────────────────────────────────────

class InventoryMovement(Base):
    """Historial de movimientos de stock de una variante.

    ``movement_type``: entry (entrada), exit (salida manual), adjustment (ajuste),
    sale_web (venta online), sale_pos (venta física), return (devolución).
    """

    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    product_variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    movement_type = Column(String(30), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)  # puede ser negativo (salidas/ajustes)
    previous_stock = Column(Integer, nullable=False)
    new_stock = Column(Integer, nullable=False)

    notes = Column(Text)
    reference = Column(String(120))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    product = relationship("Product", back_populates="inventory_movements")
    variant = relationship("ProductVariant", back_populates="inventory_movements")
    user = relationship("User", back_populates="inventory_movements")


# ─── Ventas ────────────────────────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    subtotal = Column(Numeric(12, 2), nullable=False, default=0)
    discount = Column(Numeric(12, 2), nullable=False, default=0)
    tax = Column(Numeric(12, 2), nullable=False, default=0)
    shipping = Column(Numeric(12, 2), nullable=False, default=0)
    total = Column(Numeric(12, 2), nullable=False, default=0)

    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    payment_method_id = Column(Integer, ForeignKey("payment_methods.id"))

    # Cupón aplicado (snapshot del código y monto descontado).
    coupon_id = Column(Integer, ForeignKey("coupons.id"), nullable=True)
    coupon_code = Column(String(50))
    discount_amount = Column(Numeric(10, 2), nullable=False, default=0, server_default="0")

    payment_reference = Column(String(120))
    payment_receipt_url = Column(String(500))
    terms_accepted_at = Column(DateTime)

    # Snapshot de moneda de cobro (método en Bs. → tasa e importe final).
    payment_currency = Column(String(10))
    payment_rate = Column(Numeric(14, 4))
    payment_total = Column(Numeric(14, 2))

    # Canal de venta: "online" (web) o "pos" (venta presencial en tienda).
    channel = Column(String(20), nullable=False, default="online", server_default="online")
    sold_by_id = Column(Integer, ForeignKey("users.id"))
    cash_session_id = Column(Integer, ForeignKey("cash_sessions.id"))

    # Comprador de mostrador sin cuenta (POS).
    buyer_name = Column(String(255))
    buyer_cedula = Column(String(40))
    buyer_phone = Column(String(50))
    buyer_email = Column(String(255))

    # Envío / entrega (online).
    shipping_method_id = Column(Integer, ForeignKey("shipping_methods.id"))
    shipping_address = Column(Text)
    shipping_city = Column(String(120))
    shipping_state = Column(String(120))
    shipping_zip = Column(String(20))

    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="orders", foreign_keys=[user_id])
    payment_method = relationship("PaymentMethod")
    sold_by = relationship("User", foreign_keys=[sold_by_id])
    cash_session = relationship("CashSession")
    coupon = relationship("Coupon")
    shipping_method = relationship("ShippingMethod")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

    @property
    def payment_method_name(self):
        return self.payment_method.name if self.payment_method else None

    @property
    def payment_method_type(self):
        return self.payment_method.type if self.payment_method else None

    @property
    def user_name(self):
        return self.user.name if self.user else None

    @property
    def user_email(self):
        return self.user.email if self.user else None

    @property
    def buyer_display_name(self):
        return self.buyer_name or (self.user.name if self.user else None)

    @property
    def sold_by_name(self):
        return self.sold_by.name if self.sold_by else None


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    product_variant_id = Column(Integer, ForeignKey("product_variants.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    subtotal = Column(Numeric(10, 2), nullable=False)
    # Snapshot de talla/color para que el detalle no dependa de cambios futuros.
    size = Column(String(30))
    color = Column(String(60))

    order = relationship("Order", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant", back_populates="order_items")

    @property
    def product_name(self):
        return self.product.name if self.product else None

    @property
    def product_image(self):
        return self.product.image_url if self.product else None


class Customer(Base):
    """Cliente de mostrador / base de datos de clientes (no requiere cuenta)."""

    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    cedula = Column(String(40))
    address = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="favorites")
    product = relationship("Product", back_populates="favorites")

    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_favorite"),)


class ShippingMethod(Base):
    __tablename__ = "shipping_methods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    price = Column(Numeric(10, 2), nullable=False, default=0)
    currency = Column(String(10), default="USD", nullable=False)
    description = Column(String(300))
    estimated_days = Column(String(50))
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ─── Pagos, finanzas y proveedores ─────────────────────────────────────

class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(100))
    is_active = Column(Boolean, default=True)
    currency = Column(String(10), default="USD", nullable=False)
    requires_reference = Column(Boolean, default=True, nullable=False)
    requires_receipt = Column(Boolean, default=False, nullable=False)
    phone = Column(String(40))
    email = Column(String(160))
    cedula = Column(String(40))
    bank_name = Column(String(120))
    account_holder = Column(String(120))
    account_number = Column(String(60))
    account_note = Column(String(300))
    config = Column(JSON)
    available_at_pos = Column(Boolean, default=False, nullable=False, server_default="0")
    is_cash = Column(Boolean, default=False, nullable=False, server_default="0")
    created_at = Column(DateTime, default=datetime.utcnow)


class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    type = Column(String(20), default=CouponType.PERCENTAGE.value, nullable=False)
    value = Column(Numeric(10, 2), nullable=False)
    min_amount = Column(Numeric(10, 2), nullable=False, default=0)
    max_discount = Column(Numeric(10, 2), nullable=True)
    usage_limit = Column(Integer, nullable=True)
    used_count = Column(Integer, nullable=False, default=0)
    starts_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    # Restricciones opcionales por producto o categoría.
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product")
    category = relationship("Category")
    usages = relationship("CouponUsage", back_populates="coupon")


class CouponUsage(Base):
    __tablename__ = "coupon_usages"

    id = Column(Integer, primary_key=True, index=True)
    coupon_id = Column(Integer, ForeignKey("coupons.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    discount_amount = Column(Numeric(10, 2), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    coupon = relationship("Coupon", back_populates="usages")
    user = relationship("User")
    order = relationship("Order")


class CashSession(Base):
    """Turno de caja de un vendedor (POS). Apertura con fondo inicial; las ventas
    POS se cuelgan de la sesión; al cerrar se ingresa el efectivo contado."""

    __tablename__ = "cash_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(Enum(CashSessionStatus), default=CashSessionStatus.OPEN, nullable=False)
    opening_float = Column(Numeric(14, 2), nullable=False, default=0)
    counted_cash = Column(Numeric(14, 2))
    notes = Column(Text)
    opened_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")


class FinanceEntry(Base):
    """Libro de caja: ingresos y egresos, normalizados a USD para el balance."""

    __tablename__ = "finance_entries"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(FinanceEntryType), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    rate = Column(Numeric(14, 4))
    amount_usd = Column(Numeric(14, 2), nullable=False)
    category = Column(String(60))
    description = Column(String(255))
    date = Column(DateTime, default=datetime.utcnow, nullable=False)
    related_order_id = Column(Integer, ForeignKey("orders.id"))
    payment_method_id = Column(Integer, ForeignKey("payment_methods.id"))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(60))
    phone = Column(String(50))
    email = Column(String(255))
    rif = Column(String(40))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Payable(Base):
    __tablename__ = "payables"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"), nullable=False)
    description = Column(String(255))
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    rate = Column(Numeric(14, 4))
    amount_usd = Column(Numeric(14, 2), nullable=False)
    due_date = Column(Date)
    status = Column(String(20), default=PayableStatus.PENDING.value, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor")


class Payout(Base):
    __tablename__ = "payouts"

    id = Column(Integer, primary_key=True, index=True)
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(10), default="USD", nullable=False)
    rate = Column(Numeric(14, 4))
    amount_usd = Column(Numeric(14, 2), nullable=False)
    date = Column(DateTime, default=datetime.utcnow, nullable=False)
    payment_method_id = Column(Integer, ForeignKey("payment_methods.id"))
    reference = Column(String(100))
    note = Column(String(255))
    finance_entry_id = Column(Integer, ForeignKey("finance_entries.id"))
    # IDs de las cuentas por pagar que este pago saldó (para revertir al borrar).
    payable_ids = Column(JSON)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    vendor = relationship("Vendor")


# ─── Configuración y contenido ─────────────────────────────────────────

class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(255), primary_key=True)
    value = Column(Text, default=None)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HeroSlide(Base):
    __tablename__ = "hero_slides"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    subtitle = Column(String(500))
    image_url = Column(String(500), nullable=False)
    mobile_image_url = Column(String(500))
    cta_text = Column(String(100))
    cta_link = Column(String(500))
    link_url = Column(String(500))
    placement = Column(String(20), default="hero", index=True)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    description = Column(String(500))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RequestLog(Base):
    """Registro de peticiones para el panel de tráfico del admin."""

    __tablename__ = "request_logs"

    id = Column(Integer, primary_key=True, index=True)
    method = Column(String(10), nullable=False)
    path = Column(String(500), nullable=False, index=True)
    status_code = Column(Integer, nullable=False)
    user_id = Column(Integer, index=True)
    ip = Column(String(64), index=True)
    user_agent = Column(String(500))
    referer = Column(String(500))
    utm_source = Column(String(100), index=True)
    utm_medium = Column(String(100))
    utm_campaign = Column(String(150), index=True)
    utm_content = Column(String(150))
    utm_term = Column(String(150))
    country = Column(String(100), index=True)
    country_code = Column(String(8))
    city = Column(String(100))
    region = Column(String(100))
    device_type = Column(String(20), index=True)
    browser = Column(String(60))
    os = Column(String(60))
    is_bot = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
