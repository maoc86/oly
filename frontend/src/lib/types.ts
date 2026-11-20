// ─── Tipos del frontend de Oly Official (tienda) ────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  cedula?: string;
  role: "admin" | "vendedor" | "user";
  roles?: string[];
  permissions?: string[];
  grants?: string[];
  denies?: string[];
  is_active: boolean;
  created_at: string;
}

export interface PermissionInfo {
  code: string;
  label: string;
  group: string;
}

export interface PermissionsCatalog {
  permissions: PermissionInfo[];
  role_defaults: Record<string, string[]>;
  roles: string[];
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Category {
  id: number;
  name: string;
  slug?: string | null;
  icon?: string | null;
  description?: string | null;
  image_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface ProductVariant {
  id: number;
  product_id: number;
  sku?: string | null;
  size?: string | null;
  color?: string | null;
  price_override?: number | null;
  stock: number;
  min_stock: number;
  is_active: boolean;
}

export interface Product {
  id: number;
  sku?: string | null;
  name: string;
  slug?: string | null;
  description?: string | null;
  price: number;
  wholesale_price?: number | null;
  offer_price?: number | null;
  offer_active?: boolean;
  display_price: number;
  cost?: number | null;
  category_id?: number | null;
  category?: { id: number; name: string } | null;
  brand?: string | null;
  gender?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  is_featured?: boolean;
  is_new?: boolean;
  is_active?: boolean;
  stock?: number;
  created_at?: string;
  variants?: ProductVariant[];
}

export interface FavoriteResponse {
  id: number;
  product_id: number;
  created_at?: string;
  product?: Product | null;
}

export interface InventoryMovement {
  id: number;
  product_id: number;
  product_variant_id: number;
  user_id?: number | null;
  movement_type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  notes?: string | null;
  reference?: string | null;
  created_at?: string;
  product_name?: string | null;
  variant_label?: string | null;
  user_name?: string | null;
}

export interface OrderItem {
  id: number;
  product_id: number;
  product_variant_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  size?: string | null;
  color?: string | null;
  product_name?: string | null;
  product_image?: string | null;
}

export interface Order {
  id: number;
  user_id: number;
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  status: "pending" | "completed" | "cancelled";
  payment_method_id?: number | null;
  payment_reference?: string | null;
  payment_receipt_url?: string | null;
  coupon_id?: number | null;
  coupon_code?: string | null;
  discount_amount: number;
  payment_currency?: string | null;
  payment_rate?: number | null;
  payment_total?: number | null;
  payment_method_name?: string | null;
  payment_method_type?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  channel: "online" | "pos";
  sold_by_id?: number | null;
  sold_by_name?: string | null;
  buyer_name?: string | null;
  buyer_cedula?: string | null;
  buyer_phone?: string | null;
  buyer_email?: string | null;
  buyer_display_name?: string | null;
  cash_session_id?: number | null;
  shipping_method_id?: number | null;
  shipping_address?: string | null;
  shipping_city?: string | null;
  shipping_state?: string | null;
  shipping_zip?: string | null;
  notes?: string | null;
  items: OrderItem[];
  created_at?: string;
}

export interface PaymentMethod {
  id: number;
  name: string;
  type?: string;
  is_active: boolean;
  currency: string;
  requires_reference: boolean;
  requires_receipt: boolean;
  phone?: string | null;
  email?: string | null;
  cedula?: string | null;
  bank_name?: string | null;
  account_holder?: string | null;
  account_number?: string | null;
  account_note?: string | null;
  config?: Record<string, unknown> | null;
  available_at_pos: boolean;
  is_cash: boolean;
  created_at: string;
}

export interface ShippingMethod {
  id: number;
  name: string;
  price: number;
  currency: string;
  description?: string | null;
  estimated_days?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface Coupon {
  id: number;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  min_amount: number;
  max_discount?: number | null;
  usage_limit?: number | null;
  used_count: number;
  starts_at?: string | null;
  expires_at?: string | null;
  product_id?: number | null;
  category_id?: number | null;
  is_active: boolean;
  created_at?: string;
}

export interface Customer {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  cedula?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at?: string;
}

export interface HeroSlide {
  id: number;
  title: string;
  subtitle?: string;
  image_url: string;
  mobile_image_url?: string;
  cta_text?: string;
  cta_link?: string;
  link_url?: string;
  placement?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  total_products: number;
  total_categories: number;
  total_users: number;
  total_orders: number;
  pending_orders: number;
  total_revenue: number;
  total_items_sold: number;
  low_stock: number;
  recent_orders: Order[];
}

export interface FinanceEntry {
  id: number;
  type: "income" | "expense";
  amount: number;
  currency: string;
  rate?: number | null;
  amount_usd: number;
  category?: string | null;
  description?: string | null;
  date: string;
  related_order_id?: number | null;
  payment_method_id?: number | null;
  created_at: string;
}

export interface FinanceSummary {
  income: number;
  expense: number;
  balance: number;
  by_category: { category: string; type: string; total: number }[];
  total_sales?: number;
  pending_payables?: number;
}

export interface FinanceAccountBalance {
  payment_method_id: number;
  name: string;
  type?: string;
  currency: string;
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  income: number;
  expense: number;
  balance: number;
  income_usd: number;
  expense_usd: number;
  balance_usd: number;
}

export interface FinanceBalances {
  accounts: FinanceAccountBalance[];
  general: { income_usd: number; expense_usd: number; balance_usd: number };
}

export interface Vendor {
  id: number;
  name: string;
  category?: string | null;
  phone?: string | null;
  email?: string | null;
  rif?: string | null;
  notes?: string | null;
  is_active: boolean;
}

export interface Payable {
  id: number;
  vendor_id: number;
  vendor_name?: string | null;
  description?: string | null;
  amount: number;
  currency: string;
  rate?: number | null;
  amount_usd: number;
  due_date?: string | null;
  status: "pending" | "paid" | "cancelled";
  created_at?: string;
}

export interface Payout {
  id: number;
  vendor_id: number;
  vendor_name?: string | null;
  amount: number;
  currency: string;
  rate?: number | null;
  amount_usd: number;
  date: string;
  payment_method_id?: number | null;
  reference?: string | null;
  note?: string | null;
  finance_entry_id?: number | null;
}

export interface EmailTemplate {
  id: number;
  key: string;
  name: string;
  subject: string;
  body: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Tráfico ─────────────────────────────────────────
export interface TrafficPoint {
  label: string;
  requests: number;
  visitors: number;
}

export interface TrafficCount {
  label: string;
  count: number;
}

export interface TrafficStatusCount {
  status: number;
  count: number;
}

export interface TrafficRecentRequest {
  path: string;
  method: string;
  status_code: number;
  ip: string | null;
  user_agent: string | null;
  is_bot: boolean;
  user_id: number | null;
  created_at: string;
}

export interface TrafficStats {
  requests_today: number;
  visitors_today: number;
  requests_total: number;
  visitors_total: number;
  online_now: number;
  logged_in_week: number;
  bot_requests: number;
  bot_visitors: number;
  by_day: TrafficPoint[];
  by_hour: TrafficPoint[];
  top_paths: TrafficCount[];
  top_ips: TrafficCount[];
  top_referers: TrafficCount[];
  user_agents: TrafficCount[];
  top_countries: TrafficCount[];
  top_devices: TrafficCount[];
  top_browsers: TrafficCount[];
  top_utm_sources: TrafficCount[];
  top_utm_campaigns: TrafficCount[];
  statuses: TrafficStatusCount[];
  recent: TrafficRecentRequest[];
  days: number;
  timezone_offset: number;
}

// ─── POS ─────────────────────────────────────────────
export interface PosProduct {
  id: number;
  name: string;
  sku?: string | null;
  image_url?: string | null;
  display_price: number;
  variants: ProductVariant[];
}

export interface PosCatalog {
  products: PosProduct[];
}

export interface PosSaleItem {
  product_variant_id: number;
  quantity: number;
}

export interface PosBuyer {
  name?: string;
  cedula?: string;
  phone?: string;
  email?: string;
}

export interface PosSalePayload {
  items: PosSaleItem[];
  payment_method_id: number;
  reference?: string;
  buyer: PosBuyer;
  send_email: boolean;
}

export interface CashMethodTotal {
  payment_method_id?: number | null;
  name: string;
  currency: string;
  is_cash: boolean;
  total: number;
  count: number;
}

export interface CashCurrencyTotal {
  currency: string;
  total: number;
  count: number;
}

export interface CashSessionSummary {
  expected_cash: number;
  cash_sales: number;
  other_sales: number;
  orders: number;
  items: number;
  by_method: CashMethodTotal[];
  by_currency: CashCurrencyTotal[];
  total_usd: number;
}

export interface CashSession {
  id: number;
  user_id: number;
  user_name?: string | null;
  status: "open" | "closed";
  opening_float: number;
  counted_cash?: number | null;
  difference?: number | null;
  notes?: string | null;
  opened_at: string;
  closed_at?: string | null;
  summary?: CashSessionSummary | null;
}
