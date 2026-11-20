from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Literal, Optional
from decimal import Decimal

# Ubicaciones donde se puede mostrar un carrusel de imágenes.
PLACEMENTS = ["hero", "banner"]


# ─── Auth / Users ────────────────────────────────────
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    cedula: Optional[str] = None


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    cedula: Optional[str] = None
    role: str
    roles: list[str] = []
    permissions: list[str] = []
    grants: list[str] = []
    denies: list[str] = []
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        from app.permissions import effective_permissions, override_codes

        data = cls.model_validate(user)
        data.roles = sorted(user.role_names())
        data.permissions = sorted(effective_permissions(user))
        data.grants = sorted(override_codes(user, "grant"))
        data.denies = sorted(override_codes(user, "deny"))
        return data


# ─── Gestión de usuarios y permisos (admin) ──────────
class AdminUserCreate(BaseModel):
    name: str
    email: str
    password: str
    phone: Optional[str] = None
    is_active: bool = True
    roles: list[str] = []
    grants: list[str] = []
    denies: list[str] = []


class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    roles: Optional[list[str]] = None
    grants: Optional[list[str]] = None
    denies: Optional[list[str]] = None


class UserRolesUpdate(BaseModel):
    roles: list[str] = []


class UserPermissionsUpdate(BaseModel):
    grants: list[str] = []
    denies: list[str] = []


class PermissionInfo(BaseModel):
    code: str
    label: str
    group: str


class PermissionsCatalog(BaseModel):
    permissions: list[PermissionInfo]
    role_defaults: dict[str, list[str]]
    roles: list[str]


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPassword(BaseModel):
    email: str


class ResetPassword(BaseModel):
    token: str
    password: str


# ─── Categories ──────────────────────────────────────
class CategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class CategoryResponse(BaseModel):
    id: int
    name: str
    slug: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Productos y variantes ───────────────────────────
class ProductVariantCreate(BaseModel):
    sku: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    price_override: Optional[Decimal] = None
    stock: int = 0
    min_stock: int = 0
    is_active: bool = True


class ProductVariantUpdate(BaseModel):
    sku: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    price_override: Optional[Decimal] = None
    stock: Optional[int] = None
    min_stock: Optional[int] = None
    is_active: Optional[bool] = None


class ProductVariantResponse(BaseModel):
    id: int
    product_id: int
    sku: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    price_override: Optional[Decimal] = None
    stock: int
    min_stock: int
    is_active: bool

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    price: Decimal = Decimal("0")
    wholesale_price: Optional[Decimal] = None
    offer_price: Optional[Decimal] = None
    offer_active: bool = False
    cost: Optional[Decimal] = None
    category_id: Optional[int] = None
    brand: Optional[str] = None
    gender: Optional[str] = "mujer"
    image_url: Optional[str] = None
    images: Optional[list[str]] = None
    is_active: bool = True
    is_featured: bool = False
    is_new: bool = False
    variants: list[ProductVariantCreate] = []


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    sku: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    wholesale_price: Optional[Decimal] = None
    offer_price: Optional[Decimal] = None
    offer_active: Optional[bool] = None
    cost: Optional[Decimal] = None
    category_id: Optional[int] = None
    brand: Optional[str] = None
    gender: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[list[str]] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    is_new: Optional[bool] = None


class ProductCategoryRef(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    id: int
    sku: Optional[str] = None
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    price: Decimal
    wholesale_price: Optional[Decimal] = None
    offer_price: Optional[Decimal] = None
    offer_active: bool = False
    display_price: Decimal = Decimal("0")
    category_id: Optional[int] = None
    category: Optional[ProductCategoryRef] = None
    brand: Optional[str] = None
    gender: Optional[str] = None
    image_url: Optional[str] = None
    images: Optional[list[str]] = None
    is_featured: bool = False
    is_new: bool = False
    is_active: bool = True
    stock: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProductResponse(ProductListResponse):
    cost: Optional[Decimal] = None
    variants: list[ProductVariantResponse] = []


# ─── Inventario ──────────────────────────────────────
class InventoryMovementCreate(BaseModel):
    product_variant_id: int
    movement_type: str = "adjustment"  # entry | exit | adjustment | return
    quantity: int = Field(gt=0)
    notes: Optional[str] = None
    reference: Optional[str] = None


class InventoryMovementResponse(BaseModel):
    id: int
    product_id: int
    product_variant_id: int
    user_id: Optional[int] = None
    movement_type: str
    quantity: int
    previous_stock: int
    new_stock: int
    notes: Optional[str] = None
    reference: Optional[str] = None
    created_at: Optional[datetime] = None
    product_name: Optional[str] = None
    variant_label: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Favoritos ───────────────────────────────────────
class FavoriteResponse(BaseModel):
    id: int
    product_id: int
    created_at: Optional[datetime] = None
    product: Optional[ProductListResponse] = None

    class Config:
        from_attributes = True


# ─── Clientes ────────────────────────────────────────
class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    cedula: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class CustomerResponse(CustomerCreate):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Métodos de envío ────────────────────────────────
class ShippingMethodCreate(BaseModel):
    name: str
    price: Decimal = Decimal("0")
    currency: str = "USD"
    description: Optional[str] = None
    estimated_days: Optional[str] = None
    is_active: bool = True


class ShippingMethodResponse(ShippingMethodCreate):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Orders ──────────────────────────────────────────
class OrderItemCreate(BaseModel):
    product_variant_id: int
    quantity: int = Field(gt=0)


class OrderCreate(BaseModel):
    items: list[OrderItemCreate] = Field(min_length=1)
    payment_method_id: Optional[int] = None
    reference: Optional[str] = None
    receipt_url: Optional[str] = None
    coupon_code: Optional[str] = None
    terms_accepted: bool = False
    shipping_method_id: Optional[int] = None
    shipping_address: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_zip: Optional[str] = None
    notes: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_variant_id: int
    quantity: int
    unit_price: Decimal
    subtotal: Decimal
    size: Optional[str] = None
    color: Optional[str] = None
    product_name: Optional[str] = None
    product_image: Optional[str] = None

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    user_id: int
    subtotal: Decimal = Decimal("0")
    discount: Decimal = Decimal("0")
    tax: Decimal = Decimal("0")
    shipping: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    status: str
    payment_method_id: Optional[int] = None
    payment_reference: Optional[str] = None
    payment_receipt_url: Optional[str] = None
    coupon_id: Optional[int] = None
    coupon_code: Optional[str] = None
    discount_amount: Decimal = Decimal("0")
    payment_currency: Optional[str] = None
    payment_rate: Optional[Decimal] = None
    payment_total: Optional[Decimal] = None
    payment_method_name: Optional[str] = None
    payment_method_type: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    channel: str = "online"
    sold_by_id: Optional[int] = None
    sold_by_name: Optional[str] = None
    buyer_name: Optional[str] = None
    buyer_cedula: Optional[str] = None
    buyer_phone: Optional[str] = None
    buyer_email: Optional[str] = None
    buyer_display_name: Optional[str] = None
    cash_session_id: Optional[int] = None
    shipping_method_id: Optional[int] = None
    shipping_address: Optional[str] = None
    shipping_city: Optional[str] = None
    shipping_state: Optional[str] = None
    shipping_zip: Optional[str] = None
    notes: Optional[str] = None
    items: list[OrderItemResponse] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Payment Methods ─────────────────────────────────
class PaymentMethodCreate(BaseModel):
    name: str
    type: Optional[str] = None
    is_active: bool = True
    currency: str = "USD"
    requires_reference: bool = True
    requires_receipt: bool = False
    phone: Optional[str] = None
    email: Optional[str] = None
    cedula: Optional[str] = None
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    account_number: Optional[str] = None
    account_note: Optional[str] = None
    config: Optional[dict] = None
    available_at_pos: bool = False
    is_cash: bool = False


class PaymentMethodResponse(BaseModel):
    id: int
    name: str
    type: Optional[str]
    is_active: bool
    currency: str
    requires_reference: bool
    requires_receipt: bool = False
    phone: Optional[str] = None
    email: Optional[str] = None
    cedula: Optional[str] = None
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    account_number: Optional[str] = None
    account_note: Optional[str] = None
    config: Optional[dict]
    available_at_pos: bool = False
    is_cash: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentMethodPublic(BaseModel):
    """DTO expuesto al público (checkout): solo los datos que ve el comprador."""

    id: int
    name: str
    type: Optional[str]
    is_active: bool
    currency: str
    requires_reference: bool
    requires_receipt: bool = False
    phone: Optional[str] = None
    email: Optional[str] = None
    cedula: Optional[str] = None
    bank_name: Optional[str] = None
    account_holder: Optional[str] = None
    account_number: Optional[str] = None
    account_note: Optional[str] = None

    class Config:
        from_attributes = True


# ─── Dashboard ───────────────────────────────────────
class DashboardStats(BaseModel):
    total_products: int
    total_categories: int
    total_users: int
    total_orders: int
    pending_orders: int
    total_revenue: Decimal
    total_items_sold: int
    low_stock: int
    recent_orders: list[OrderResponse] = []


# ─── Hero Slides ─────────────────────────────────────
class HeroSlideCreate(BaseModel):
    title: str = ""
    subtitle: Optional[str] = None
    image_url: str
    mobile_image_url: Optional[str] = None
    cta_text: Optional[str] = None
    cta_link: Optional[str] = None
    link_url: Optional[str] = None
    placement: Literal["hero", "banner"] = PLACEMENTS[0]
    sort_order: int = 0
    is_active: bool = True


class HeroSlideResponse(HeroSlideCreate):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Email Templates ────────────────────────────────
class EmailTemplateCreate(BaseModel):
    key: str
    name: str
    subject: str
    body: str
    description: Optional[str] = None
    is_active: bool = True


class EmailTemplateUpdate(BaseModel):
    key: Optional[str] = None
    name: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class EmailTemplateResponse(BaseModel):
    id: int
    key: str
    name: str
    subject: str
    body: str
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EmailTemplateTest(BaseModel):
    to: EmailStr
    subject: str = ""
    body: str = ""


# ─── Tráfico (panel de administración) ──────────────
class TrafficPoint(BaseModel):
    label: str
    requests: int
    visitors: int


class TrafficCount(BaseModel):
    label: str
    count: int


class TrafficStatusCount(BaseModel):
    status: int
    count: int


class TrafficRecentRequest(BaseModel):
    path: str
    method: str
    status_code: int
    ip: Optional[str]
    user_agent: Optional[str]
    is_bot: bool
    user_id: Optional[int]
    created_at: datetime


class TrafficStats(BaseModel):
    requests_today: int
    visitors_today: int
    requests_total: int
    visitors_total: int
    online_now: int
    logged_in_week: int
    bot_requests: int
    bot_visitors: int
    by_day: list[TrafficPoint] = []
    by_hour: list[TrafficPoint] = []
    top_paths: list[TrafficCount] = []
    top_ips: list[TrafficCount] = []
    top_referers: list[TrafficCount] = []
    user_agents: list[TrafficCount] = []
    top_countries: list[TrafficCount] = []
    top_devices: list[TrafficCount] = []
    top_browsers: list[TrafficCount] = []
    top_utm_sources: list[TrafficCount] = []
    top_utm_campaigns: list[TrafficCount] = []
    statuses: list[TrafficStatusCount] = []
    recent: list[TrafficRecentRequest] = []
    days: int = 14


# ─── POS (venta presencial) ─────────────────────────
class PosSaleItem(BaseModel):
    product_variant_id: int
    quantity: int = Field(gt=0)


class PosBuyer(BaseModel):
    name: Optional[str] = None
    cedula: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class PosSaleCreate(BaseModel):
    items: list[PosSaleItem] = Field(min_length=1)
    payment_method_id: int
    reference: Optional[str] = None
    buyer: PosBuyer = Field(default_factory=PosBuyer)
    send_email: bool = False


class PosProductResponse(BaseModel):
    id: int
    name: str
    sku: Optional[str] = None
    image_url: Optional[str] = None
    display_price: Decimal = Decimal("0")
    variants: list[ProductVariantResponse] = []


class PosCatalogResponse(BaseModel):
    products: list[PosProductResponse] = []


class CashSessionOpen(BaseModel):
    opening_float: Decimal = Decimal("0")


class CashSessionClose(BaseModel):
    counted_cash: Decimal = Decimal("0")
    notes: Optional[str] = None


class CashMethodTotal(BaseModel):
    payment_method_id: Optional[int] = None
    name: str
    currency: str
    is_cash: bool
    total: Decimal
    count: int


class CashCurrencyTotal(BaseModel):
    currency: str
    total: Decimal
    count: int


class CashSessionSummary(BaseModel):
    expected_cash: Decimal = Decimal("0")
    cash_sales: Decimal = Decimal("0")
    other_sales: Decimal = Decimal("0")
    orders: int = 0
    items: int = 0
    by_method: list[CashMethodTotal] = []
    # Consolidado por moneda (lo vendido en USD y en Bs., cada uno en su moneda).
    by_currency: list[CashCurrencyTotal] = []
    # Total consolidado de la caja convertido a USD.
    total_usd: Decimal = Decimal("0")


class CashSessionResponse(BaseModel):
    id: int
    user_id: int
    user_name: Optional[str] = None
    status: str
    opening_float: Decimal = Decimal("0")
    counted_cash: Optional[Decimal] = None
    difference: Optional[Decimal] = None
    notes: Optional[str] = None
    opened_at: datetime
    closed_at: Optional[datetime] = None
    summary: Optional[CashSessionSummary] = None


# ─── Cupones ─────────────────────────────────────────
class CouponBase(BaseModel):
    code: str
    type: str = "percentage"
    value: float
    min_amount: float = 0
    max_discount: Optional[float] = None
    usage_limit: Optional[int] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    product_id: Optional[int] = None
    category_id: Optional[int] = None
    is_active: bool = True


class CouponCreate(CouponBase):
    pass


class CouponUpdate(BaseModel):
    code: Optional[str] = None
    type: Optional[str] = None
    value: Optional[float] = None
    min_amount: Optional[float] = None
    max_discount: Optional[float] = None
    usage_limit: Optional[int] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    product_id: Optional[int] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None


class CouponResponse(BaseModel):
    id: int
    code: str
    type: str
    value: float
    min_amount: float
    max_discount: Optional[float] = None
    usage_limit: Optional[int] = None
    used_count: int
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    product_id: Optional[int] = None
    category_id: Optional[int] = None
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CouponValidateItem(BaseModel):
    product_variant_id: int
    subtotal: float


class CouponValidate(BaseModel):
    code: str
    product_id: Optional[int] = None
    items: Optional[list[CouponValidateItem]] = None
    subtotal: Optional[float] = None


class CouponValidateResponse(BaseModel):
    valid: bool
    code: Optional[str] = None
    type: Optional[str] = None
    value: Optional[float] = None
    discount: Optional[float] = None
    message: Optional[str] = None


class CouponUsageResponse(BaseModel):
    id: int
    coupon_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    order_id: Optional[int] = None
    discount_amount: float
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
