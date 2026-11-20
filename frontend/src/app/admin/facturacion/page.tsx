"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Order } from "@/lib/types";
import { Badge, Button, EmptyState, Modal, Input } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { formatAmount, type Currency } from "@/lib/currency";
import { confirmDialog } from "@/lib/confirm";
import {
  CheckCircle, XCircle, Receipt, Ticket, CalendarDays, Search,
  Eye, User, Landmark, Hash, FileText, Paperclip, ExternalLink,
} from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function ticketBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    valid: { label: "Válido", cls: "bg-green-100 text-green-800" },
    used: { label: "Escaneado", cls: "bg-blue-100 text-blue-800" },
    cancelled: { label: "Cancelado", cls: "bg-red-100 text-red-800" },
  };
  const s = map[status] || { label: status, cls: "bg-gray-100 text-gray-800" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>{s.label}</span>
  );
}

// En las ventas de taquilla el `user_*` de la orden es el vendedor; el comprador
// real (de mostrador) viene en los campos `buyer_*`.
function buyerName(o: Order) {
  return o.channel === "taquilla"
    ? o.buyer_display_name || "Consumidor final"
    : o.user_name || `Usuario #${o.user_id}`;
}

function buyerContact(o: Order) {
  if (o.channel === "taquilla") {
    return [o.buyer_cedula, o.buyer_phone, o.buyer_email].filter(Boolean).join(" · ");
  }
  return o.user_email || "";
}

function ChannelBadge({ channel }: { channel?: string }) {
  const isTaquilla = channel === "taquilla";
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
        isTaquilla ? "bg-brand-100 text-brand-800" : "bg-gray-100 text-gray-700"
      }`}
    >
      {isTaquilla ? "Taquilla" : "Online"}
    </span>
  );
}

export default function AdminFacturacionPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");

  async function reload() {
    const data = await api.get<Order[]>("/orders/admin/all");
    setOrders(data);
  }

  useEffect(() => {
    api
      .get<Order[]>("/orders/admin/all")
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleAction(orderId: number, action: "confirm" | "cancel") {
    const label = action === "confirm" ? "confirmar" : "rechazar";
    if (!(await confirmDialog({ message: `¿Seguro que querés ${label} la orden #${orderId}?`, danger: action === "cancel" }))) return;
    setBusyId(orderId);
    setMsg("");
    try {
      await api.post(`/orders/admin/${orderId}/${action}`, {});
      setMsg(`Orden #${orderId} ${action === "confirm" ? "confirmada" : "rechazada"}.`);
      await reload();
      setSelected((cur) => (cur && cur.id === orderId ? null : cur));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Error al actualizar la orden");
    } finally {
      setBusyId(null);
      setTimeout(() => setMsg(""), 4000);
    }
  }

  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending").length;
    const revenue = orders
      .filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + Number(o.total), 0);
    return { total: orders.length, pending, revenue };
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (channelFilter && (o.channel || "online") !== channelFilter) return false;
      if (!q) return true;
      return (
        String(o.id).includes(q) ||
        (o.user_email || "").toLowerCase().includes(q) ||
        (o.user_name || "").toLowerCase().includes(q) ||
        (o.buyer_name || "").toLowerCase().includes(q) ||
        (o.buyer_cedula || "").toLowerCase().includes(q) ||
        (o.payment_reference || "").toLowerCase().includes(q)
      );
    });
  }, [orders, query, statusFilter, channelFilter]);

  if (loading) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Facturación</h1>
          <p className="text-sm text-gray-500 mt-1">Órdenes, ventas y conciliación de pagos.</p>
        </div>
        {msg && <p className="text-sm text-green-700">{msg}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Órdenes</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Pendientes de confirmar</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <p className="text-sm text-gray-500">Recaudado (confirmadas)</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatPrice(stats.revenue)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative sm:max-w-xs flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            placeholder="Buscar por #, email, nombre o referencia…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {[
              { value: "", label: "Todas" },
              { value: "pending", label: "Pendientes" },
              { value: "completed", label: "Completadas" },
              { value: "cancelled", label: "Canceladas" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  statusFilter === f.value
                    ? "bg-brand-500 text-ink-900 border-brand-500"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="hidden sm:block w-px h-6 bg-gray-200" />
          <div className="flex flex-wrap gap-2">
            {[
              { value: "", label: "Todo canal" },
              { value: "online", label: "Online" },
              { value: "taquilla", label: "Taquilla" },
            ].map((f) => (
              <button
                key={f.value}
                onClick={() => setChannelFilter(f.value)}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  channelFilter === f.value
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <EmptyState message="No hay órdenes que coincidan con el filtro." />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-4">Orden</th>
                  <th className="text-left p-4">Comprador</th>
                  <th className="text-left p-4">Evento</th>
                  <th className="text-left p-4">Fecha</th>
                  <th className="text-left p-4">Estado</th>
                  <th className="text-left p-4">Canal</th>
                  <th className="text-left p-4">Entradas</th>
                  <th className="text-right p-4">Total</th>
                  <th className="text-right p-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const totalTickets = o.items.reduce((sum, item) => sum + item.quantity, 0);
                  const currency: Currency = o.payment_currency === "VES" ? "VES" : "USD";
                  const charged = Number(o.payment_total ?? o.total);
                  const eventTitle = o.items[0]?.event_title || "—";
                  return (
                    <tr
                      key={o.id}
                      onClick={() => setSelected(o)}
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="p-4 font-semibold text-gray-900">#{o.id}</td>
                      <td className="p-4">
                        <p className="font-medium text-gray-900">{buyerName(o)}</p>
                        <p className="text-xs text-gray-400">{buyerContact(o)}</p>
                      </td>
                      <td className="p-4 text-gray-600">{eventTitle}</td>
                      <td className="p-4 text-gray-500">
                        {formatDate(o.created_at)}
                        <span className="block text-xs text-gray-400">{formatTime(o.created_at)}</span>
                      </td>
                      <td className="p-4"><Badge status={o.status} /></td>
                      <td className="p-4"><ChannelBadge channel={o.channel} /></td>
                      <td className="p-4 text-gray-600">{totalTickets}</td>
                      <td className="p-4 text-right font-bold text-gray-900">
                        {formatAmount(charged, currency)}
                        {currency === "VES" && (
                          <span className="block text-xs font-normal text-gray-400">
                            {formatPrice(o.total)}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {o.status === "pending" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleAction(o.id, "confirm")}
                              disabled={busyId === o.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Confirmar
                            </button>
                            <button
                              onClick={() => handleAction(o.id, "cancel")}
                              disabled={busyId === o.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" /> Rechazar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setSelected(o)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OrderDetail
        order={selected}
        busy={selected ? busyId === selected.id : false}
        onClose={() => setSelected(null)}
        onAction={handleAction}
      />
    </div>
  );
}

function OrderDetail({
  order,
  busy,
  onClose,
  onAction,
}: {
  order: Order | null;
  busy: boolean;
  onClose: () => void;
  onAction: (id: number, action: "confirm" | "cancel") => void;
}) {
  const isPending = order?.status === "pending";
  const currency: Currency = order?.payment_currency === "VES" ? "VES" : "USD";
  const charged = Number(order?.payment_total ?? order?.total ?? 0);

  return (
    <Modal open={!!order} onClose={onClose} title="" size="3xl">
      {order && (
        <div className="space-y-6 -mt-3">
          {/* Encabezado */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 text-lg font-bold text-gray-900">
                  <Hash className="w-4 h-4 text-gray-400" /> Orden #{order.id}
                </span>
                <Badge status={order.status} />
                <ChannelBadge channel={order.channel} />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {formatDate(order.created_at)} · {formatTime(order.created_at)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total cobrado</p>
              <p className="text-xl font-bold text-brand-700">{formatAmount(charged, currency)}</p>
              {currency === "VES" && (
                <p className="text-xs text-gray-400">
                  {formatPrice(Number(order.total))}
                  {order.payment_rate != null && ` a ${Number(order.payment_rate).toFixed(2)} Bs/USD`}
                </p>
              )}
            </div>
          </div>

          {/* Comprador y evento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <User className="w-4 h-4" /> Comprador
              </p>
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-medium text-gray-900">{buyerName(order)}</p>
                {order.channel === "taquilla" ? (
                  <>
                    {order.buyer_cedula && <p>C.I. {order.buyer_cedula}</p>}
                    {order.buyer_phone && <p>{order.buyer_phone}</p>}
                    {order.buyer_email && <p>{order.buyer_email}</p>}
                    <p className="text-xs text-gray-400 pt-1">
                      Vendido por {order.sold_by_name || "taquilla"}
                    </p>
                  </>
                ) : (
                  <>
                    {order.user_email && <p>{order.user_email}</p>}
                    {order.user_phone && <p>{order.user_phone}</p>}
                  </>
                )}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <CalendarDays className="w-4 h-4" /> Evento
              </p>
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-medium text-gray-900">{order.items[0]?.event_title || "—"}</p>
                {order.items[0]?.event_start && (
                  <p>
                    {formatDate(order.items[0].event_start)} · {formatTime(order.items[0].event_start)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Entradas y boletos */}
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Ticket className="w-4 h-4" /> Entradas
            </p>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-gray-50">
                    <div>
                      <p className="font-medium text-gray-900">{item.ticket_type_name || `Entrada #${item.ticket_type_id}`}</p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} × {formatPrice(item.unit_price)}
                      </p>
                    </div>
                    <span className="font-semibold text-gray-900">{formatPrice(item.subtotal)}</span>
                  </div>
                  {item.tickets.length > 0 && (
                    <div className="divide-y divide-gray-100">
                      {item.tickets.map((t) => (
                        <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <div>
                            <span className="font-medium text-gray-700">Boleto #{t.id}</span>
                            {t.qr_code && (
                              <span className="block text-xs text-gray-400 font-mono">{t.qr_code.slice(0, 13)}…</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {t.scanned_at && (
                              <span className="text-xs text-gray-400">
                                {formatDate(t.scanned_at)} {formatTime(t.scanned_at)}
                              </span>
                            )}
                            {ticketBadge(t.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Pago */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Landmark className="w-4 h-4" /> Pago
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Método</p>
                <p className="font-medium text-gray-900">{order.payment_method_name || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Referencia</p>
                <p className="font-medium text-gray-900">{order.payment_reference || "—"}</p>
              </div>
              <div>
                <p className="text-gray-500">Moneda de cobro</p>
                <p className="font-medium text-gray-900">{currency}</p>
              </div>
              {currency === "VES" && (
                <div>
                  <p className="text-gray-500">Tasa aplicada</p>
                  <p className="font-medium text-gray-900">
                    {order.payment_rate != null ? `${Number(order.payment_rate).toFixed(2)} Bs/USD` : "—"}
                  </p>
                </div>
              )}
            </div>

            {order.payment_receipt_url && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
                  <Paperclip className="w-3.5 h-3.5" /> Comprobante de pago
                </p>
                <ReceiptPreview url={order.payment_receipt_url} />
              </div>
            )}
          </div>

          {/* Desglose */}
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Receipt className="w-4 h-4" /> Desglose
            </p>
            <div className="text-sm space-y-1.5">
              <Row label="Precio base" value={formatPrice(Number(order.subtotal))} />
              {Number(order.service_fee) > 0 && (
                <Row label="Servicio" value={formatPrice(Number(order.service_fee))} />
              )}
              {Number(order.municipal_tax) > 0 && (
                <Row label="Impuesto municipal" value={formatPrice(Number(order.municipal_tax))} />
              )}
              {Number(order.tax) > 0 && <Row label="IVA" value={formatPrice(Number(order.tax))} />}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <Row label="Total (base USD)" value={formatPrice(Number(order.total))} strong />
              </div>
              {Number(order.platform_fee) > 0 && (
                <>
                  <Row label="Comisión plataforma" value={formatPrice(Number(order.platform_fee))} muted />
                  <Row label="Neto organizador" value={formatPrice(Number(order.subtotal))} muted />
                </>
              )}
            </div>
          </div>

          {isPending && (
            <div className="flex items-center gap-2 justify-end border-t border-gray-100 pt-4">
              <Button variant="secondary" onClick={() => onAction(order.id, "cancel")} disabled={busy}>
                <XCircle className="w-4 h-4" /> Rechazar
              </Button>
              <Button onClick={() => onAction(order.id, "confirm")} disabled={busy}>
                <CheckCircle className="w-4 h-4" /> Confirmar pago
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function ReceiptPreview({ url }: { url: string }) {
  const isPdf = /\.pdf($|\?)/i.test(url);
  return (
    <div className="flex items-center gap-3">
      {isPdf ? (
        <div className="grid place-items-center w-16 h-16 rounded-lg border border-gray-200 bg-white">
          <FileText className="w-7 h-7 text-red-500" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Comprobante de pago"
          className="w-16 h-16 rounded-lg border border-gray-200 object-cover bg-white"
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
      >
        <ExternalLink className="w-4 h-4" /> {isPdf ? "Ver PDF" : "Ver comprobante"}
      </a>
    </div>
  );
}

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-gray-400" : "text-gray-500"}>{label}</span>
      <span className={strong ? "font-bold text-gray-900" : muted ? "text-gray-400" : "font-medium text-gray-900"}>
        {value}
      </span>
    </div>
  );
}
