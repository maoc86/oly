"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Filter, RefreshCw, Receipt, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Order, PaymentMethod, CashSession } from "@/lib/types";
import { EmptyState } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-VE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function PosVentasPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [search, setSearch] = useState("");
  const [pmId, setPmId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const q = new URLSearchParams();
    if (pmId) q.set("payment_method_id", pmId);
    if (sessionId) q.set("cash_session_id", sessionId);
    if (fromDate) q.set("from_date", new Date(fromDate).toISOString());
    if (toDate) {
      const d = new Date(toDate);
      d.setHours(23, 59, 59, 999);
      q.set("to_date", d.toISOString());
    }
    try {
      const data = await api.get<Order[]>(`/pos/sales?${q.toString()}`);
      setOrders(data);
    } catch {
      setOrders([]);
      toastError("No se pudieron cargar las ventas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.get<CashSession[]>("/pos/cash/sessions").then(setSessions).catch(() => {});
    api.get<PaymentMethod[]>("/pos/payment-methods").then(setMethods).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [pmId, sessionId, fromDate, toDate]);

  // Filtro por texto (cliente) sobre los ya cargados
  const filtered = useMemo(() => {
    if (!search.trim()) return orders;
    const t = search.toLowerCase();
    return orders.filter(
      (o) =>
        String(o.id).includes(t) ||
        (o.buyer_display_name || o.buyer_name || "").toLowerCase().includes(t) ||
        o.items.some((i) => i.product_name?.toLowerCase().includes(t))
    );
  }, [orders, search]);

  // Resumen
  const summary = useMemo(() => {
    const count = filtered.length;
    const totalUsd = filtered.reduce((s, o) => s + Number(o.total), 0);
    const byCurrency = filtered.reduce<Record<string, { total: number; count: number }>>((acc, o) => {
      const c = (o.payment_currency || "USD").toUpperCase();
      if (!acc[c]) acc[c] = { total: 0, count: 0 };
      acc[c].total += Number(o.payment_total ?? o.total);
      acc[c].count += 1;
      return acc;
    }, {});
    const byMethod = filtered.reduce<Record<string, { name: string; total: number; count: number }>>((acc, o) => {
      const name = o.payment_method_name || "Sin método";
      if (!acc[name]) acc[name] = { name, total: 0, count: 0 };
      acc[name].total += Number(o.total);
      acc[name].count += 1;
      return acc;
    }, {});
    return { count, totalUsd, byCurrency, byMethod };
  }, [filtered]);

  async function cancelSale(id: number) {
    if (!(await confirmDialog({ message: "¿Anular esta venta? Se devolverá el stock y se revertirá el ingreso en caja.", danger: true }))) return;
    try {
      await api.post(`/pos/sales/${id}/cancel`);
      toastSuccess("Venta anulada.");
      load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al anular");
    }
  }

  function clearFilters() {
    setSearch("");
    setPmId("");
    setSessionId("");
    setFromDate("");
    setToDate("");
  }

  const hasFilters = search || pmId || sessionId || fromDate || toDate;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas del POS</h1>
          <p className="text-sm text-gray-500 mt-1">Historial de ventas presenciales.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Ventas</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{summary.count}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total (USD)</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">${summary.totalUsd.toFixed(2)}</p>
        </div>
        {Object.entries(summary.byCurrency).map(([currency, v]) => (
          <div key={currency} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{currency}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {currency === "VES"
                ? `Bs. ${v.total.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`
                : `$${v.total.toFixed(2)}`}
            </p>
            <p className="text-xs text-gray-400">{v.count} venta{v.count === 1 ? "" : "s"}</p>
          </div>
        ))}
      </div>

      {/* Desglose por método */}
      {Object.keys(summary.byMethod).length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Por método de pago</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.values(summary.byMethod).map((m) => (
              <div key={m.name} className="flex justify-between text-sm">
                <span className="text-gray-600">{m.name} × {m.count}</span>
                <span className="font-medium text-gray-900">${m.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Filtros</span>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto text-xs text-brand-700 hover:underline">Limpiar</button>
          )}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente o producto…" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <select value={pmId} onChange={(e) => setPmId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">Todos los métodos</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">Todas las cajas</option>
            {sessions.map((s) => <option key={s.id} value={s.id}>Caja #{s.id} · {new Date(s.opened_at).toLocaleDateString("es-VE")}</option>)}
          </select>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" title="Desde" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" title="Hasta" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState message={hasFilters ? "No hay ventas con esos filtros." : "Todavía no registraste ventas."} />
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const isOpen = expanded === o.id;
            return (
              <div key={o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : o.id)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">#{o.id} · {o.buyer_name || "Cliente mostrador"}</p>
                    <p className="text-sm text-gray-500">
                      {fmtDate(o.created_at)} · {o.items.reduce((a, i) => a + i.quantity, 0)} artículo(s) · {o.payment_method_name || "Sin método"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-bold text-gray-900">{formatPrice(Number(o.total))}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-4 border-t border-gray-100">
                    <div className="mt-3 space-y-1">
                      {o.items.map((i) => (
                        <div key={i.id} className="flex justify-between text-sm">
                          <span className="text-gray-700">
                            {i.product_name}
                            <span className="text-gray-400"> × {i.quantity}</span>
                            {i.size || i.color ? <span className="text-gray-400"> ({[i.size, i.color].filter(Boolean).join(" / ")})</span> : null}
                          </span>
                          <span className="text-gray-600">{formatPrice(Number(i.subtotal))}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid sm:grid-cols-2 gap-2 text-sm text-gray-600">
                      {o.buyer_cedula && <p>Cédula: {o.buyer_cedula}</p>}
                      {o.buyer_phone && <p>Teléfono: {o.buyer_phone}</p>}
                      {o.buyer_email && <p>Correo: {o.buyer_email}</p>}
                      {o.payment_reference && <p>Referencia: {o.payment_reference}</p>}
                      {o.cash_session_id && <p>Caja: #{o.cash_session_id}</p>}
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span>{formatPrice(Number(o.subtotal))}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">IVA</span>
                      <span>{formatPrice(Number(o.tax))}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-gray-900">
                      <span>Total</span>
                      <span>{formatPrice(Number(o.total))}</span>
                    </div>
                    {o.status === "completed" && (
                      <div className="mt-3 flex justify-end">
                        <button onClick={() => cancelSale(o.id)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100">
                          <Trash2 className="w-4 h-4" /> Anular venta
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
