export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  cedula?: string;
  role: "admin" | "organizer" | "user" | "taquilla";
  // Multi-rol y permisos efectivos (los devuelve la API en login/me).
  roles?: string[];
  permissions?: string[];
  // Excepciones por usuario (para la matriz de permisos del admin).
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

/** Vendedor de taquilla (rol `taquilla`) con sus eventos asignados y sus ventas. */
export interface StaffMember {
  id: number;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  created_at?: string;
  event_ids: number[];
  event_titles: string[];
  sales_count: number;
  sales_total: number;
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
  icon?: string;
}

export interface Venue {
  id: number;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  total_capacity: number;
  created_at: string;
}

export interface TicketType {
  id: number;
  event_id: number;
  name: string;
  price: number;
  individual_price?: number | null;
  total_stock: number;
  sold_stock: number;
  guest_stock?: number;
  group_size?: number;
  has_seat_map?: boolean;
  map_rows?: number;
  map_cols?: number;
  color?: string;
  sale_start?: string;
  sale_end?: string;
  box_layout?: { top: number; right: number; bottom: number; left: number } | null;
}

export interface Event {
  id: number;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  venue_id?: number;
  category_id?: number;
  image_url?: string;
  mobile_image_url?: string;
  map_config?: Record<string, unknown> | null;
  status: "draft" | "published" | "finished" | "cancelled";
  created_by?: number;
  organizer_id?: number;
  // Personalización del evento (null/undefined = usa el global). El IVA es global.
  platform_fee_percent?: number | null;
  municipal_tax_percent?: number | null;
  // Diseño del boleto digital asignado al evento (null = plantilla por defecto).
  ticket_template_id?: number | null;
  venue?: Venue;
  category?: Category;
  ticket_types: TicketType[];
  created_at: string;
}

export interface Ticket {
  id: number;
  qr_code?: string;
  status: "valid" | "used" | "cancelled";
  scanned_at?: string;
  created_at: string;
  // Área y asiento del boleto (solo en áreas con mapa de asientos).
  area_name?: string | null;
  seat_label?: string | null;
  seat_row?: number | null;
  seat_number?: number | null;
}

export interface OrderItem {
  id: number;
  ticket_type_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  seat_ids?: number[] | null;
  tickets: Ticket[];
  ticket_type_name?: string;
  event_id?: number;
  event_title?: string;
  event_start?: string;
  event_image?: string;
}

export interface Order {
  id: number;
  user_id: number;
  total: number;
  subtotal: number;
  service_fee: number;
  tax: number;
  municipal_tax: number;
  platform_fee: number;
  status: "pending" | "completed" | "cancelled";
  payment_method_id?: number;
  payment_reference?: string;
  payment_receipt_url?: string;
  // Snapshot del cobro: moneda, tasa aplicada e importe a pagar.
  payment_currency?: string;
  payment_rate?: number;
  payment_total?: number;
  payment_method_name?: string;
  payment_method_type?: string;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
  // Canal de venta: online (checkout) o taquilla (venta presencial).
  channel: "online" | "taquilla";
  sold_by_id?: number;
  sold_by_name?: string;
  buyer_name?: string;
  buyer_cedula?: string;
  buyer_phone?: string;
  buyer_email?: string;
  buyer_display_name?: string;
  cash_session_id?: number;
  items: OrderItem[];
  created_at: string;
}

export interface Seat {
  id: number;
  row: number;
  number: number;
  seat_index: number;
  status: "free" | "reserved" | "occupied" | "blocked";
  reserved_by?: number;
  reserved_until?: string;
}

export interface TicketSeats {
  ticket_type: TicketType;
  rows: number;
  cols: number;
  free_count: number;
  occupied_count: number;
  seats: Seat[];
}

export interface EventSeats {
  event_id: number;
  ticket_types: TicketSeats[];
}

export interface MapCell {
  row: number;
  col: number;
  has_seat: boolean;
  seat_id?: number | null;
  status?: string | null;
  reserved_by?: number | null;
  reserved_until?: string | null;
}

export interface TicketMap {
  ticket_type_id: number;
  name: string;
  rows: number;
  cols: number;
  cells: MapCell[];
}

/** Mapa de ventas del organizador: asiento sin datos del comprador. */
export interface OrganizerSeat {
  id: number;
  row: number;
  number: number;
  seat_index: number;
  status: "free" | "reserved" | "occupied" | "blocked";
}

export interface OrganizerAreaSeats {
  ticket_type: TicketType;
  rows: number;
  cols: number;
  has_seat_map: boolean;
  free_count: number;
  occupied_count: number;
  reserved_count: number;
  seats: OrganizerSeat[];
  boxes?: any[];
  total_seats?: number;
  available_boxes?: number;
  reserved_boxes?: number;
  sold_boxes?: number;
}

export interface OrganizerSeats {
  event_id: number;
  areas: OrganizerAreaSeats[];
}

export interface GuestTicket {
  id: number;
  event_id: number;
  ticket_type_id: number;
  guest_name: string;
  guest_email?: string | null;
  guest_phone?: string | null;
  quantity: number;
  seat_ids?: number[] | null;
  qr_code: string;
  status: string;
  created_by?: number | null;
  sent_at?: string | null;
  created_at?: string | null;
}

export interface PaymentMethod {
  id: number;
  name: string;
  type?: string;
  is_active: boolean;
  currency: string;
  requires_reference: boolean;
  requires_receipt: boolean;
  phone?: string;
  email?: string;
  cedula?: string;
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  account_note?: string;
  config?: Record<string, unknown>;
  // Taquilla: disponible para vender presencialmente y si es efectivo (cuadre de caja).
  available_at_taquilla: boolean;
  is_cash: boolean;
  created_at: string;
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
  total_events: number;
  total_venues: number;
  total_users: number;
  total_organizers: number;
  total_orders: number;
  pending_orders: number;
  total_revenue: number;
  total_tickets_sold: number;
  recent_orders: Order[];
}

export interface FinanceEntry {
  id: number;
  type: "income" | "expense";
  amount: number;
  currency: string;
  rate?: number;
  amount_usd: number;
  category?: string;
  description?: string;
  date: string;
  related_order_id?: number;
  payment_method_id?: number;
  created_at: string;
}

export interface FinanceSummary {
  income: number;
  expense: number;
  balance: number;
  by_category: { category: string; type: string; total: number }[];
  platform_commission?: number;
  organizer_payout?: number;
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

export interface OrganizerEvent {
  id: number;
  title: string;
  status: string;
  start_date: string;
  subtotal: number;
  platform_fee: number;
  municipal_tax: number;
  tax: number;
  net: number;
  tickets_sold: number;
  orders: number;
}

export interface OrganizerSummary {
  id: number;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  events: number;
  subtotal: number;
  platform_fee: number;
  municipal_tax: number;
  tax: number;
  net: number;
  tickets_sold: number;
  orders: number;
  events_detail?: OrganizerEvent[];
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

// ─── Plantillas de boleto (diseños) ──────────────────
export interface TicketTemplate {
  id: number;
  name: string;
  description?: string;
  brand_color: string;
  accent_color: string;
  text_color: string;
  background_image_url?: string;
  logo_url?: string;
  footer_text?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/** Diseño del boleto resuelto para un evento (vista previa del comprador). */
export interface TicketDesign {
  brand_color: string;
  accent_color: string;
  text_color: string;
  background_image_url?: string | null;
  logo_url?: string | null;
  footer_text?: string | null;
  venue_name?: string | null;
}

// ─── Tráfico (panel de administración) ───────────────
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

// ─── Taquilla (venta presencial) ─────────────────────
export interface PosEvent {
  id: number;
  title: string;
  status: string;
  start_date: string;
  end_date: string;
  venue_name?: string | null;
  image_url?: string | null;
}

export interface PosCatalog {
  event: PosEvent;
  ticket_types: TicketType[];
}

export interface PosSaleItem {
  ticket_type_id: number;
  quantity: number;
  seat_ids: number[];
  mode?: "box" | "seat";
}

export interface PosBuyer {
  name?: string;
  cedula?: string;
  phone?: string;
  email?: string;
}

export interface PosSalePayload {
  event_id: number;
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

export interface CashSessionSummary {
  expected_cash: number;
  cash_sales: number;
  other_sales: number;
  orders: number;
  tickets: number;
  by_method: CashMethodTotal[];
}

export interface CashSession {
  id: number;
  event_id: number;
  event_title?: string | null;
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
