"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { CashSession, Order } from "@/lib/types";
import { EmptyState, Select } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { Receipt, RefreshCw, Ticket, Banknote } from "lucide-react";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function TaquillaVentasPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [sessionFilter, setSessionFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<CashSession[]>("/pos/cash/sessions?limit=100").then(setSessions).catch(() => setSessions([]));
  }, []);

  const load = useCallback((sessionId?: string) => {
    const qs = sessionId ? `?cash_session_id=${sessionId}` : "?limit=200";
    return api
      .get<Order[]>(`/pos/sales${qs}`)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(sessionFilter || undefined);
  }, [sessionFilter, load]);

  function reload() {
    setLoading(true);
    load(sessionFilter || undefined);
  }

  const totals = useMemo(() => {
    const total = orders.reduce((a, o) => a + Number(o.total || 0), 0);
    const tickets = orders.reduce((a, o) => a + o.items.reduce((b, i) => b + (i.quantity || 0), 0), 0);
    return { total, tickets };
  }, [orders]);

  const sessionOptions = sessions.map((s) => ({
    value: s.id,
    label: `${s.event_title || `Evento #${s.event_id}`} · ${formatDateTime(s.opened_at)}${
      s.status === "open" ? " (abierta)" : ""
    }`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis ventas</h1>
          <p className="text-sm text-gray-500 mt-1">Todas las ventas que hiciste en taquilla.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-64">
            <Select
              label="Caja"
              value={sessionFilter}
              onChange={(e) => {
                setLoading(true);
                setSessionFilter(e.target.value);
              }}
              options={sessionOptions}
              placeholder="Todas las cajas"
            />
          </div>
          <button
            onClick={reload}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-brand-100 grid place-items-center">
            <Receipt className="w-5 h-5 text-brand-700" />
          </span>
          <div>
            <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
            <p className="text-xs text-gray-500">Ventas</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-emerald-100 grid place-items-center">
            <Banknote className="w-5 h-5 text-emerald-700" />
          </span>
          <div>
            <p className="text-2xl font-bold text-gray-900">{formatPrice(totals.total)}</p>
            <p className="text-xs text-gray-500">{totals.tickets} boleto(s)</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="h-40 bg-gray-100 animate-pulse" />
        ) : orders.length === 0 ? (
          <EmptyState message="Todavía no registraste ventas." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-4">Orden</th>
                  <th className="text-left p-4">Fecha</th>
                  <th className="text-left p-4">Comprador</th>
                  <th className="text-left p-4">Evento</th>
                  <th className="text-right p-4">Boletos</th>
                  <th className="text-left p-4">Método</th>
                  <th className="text-right p-4">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const tickets = o.items.reduce((a, i) => a + (i.quantity || 0), 0);
                  const eventTitle = o.items[0]?.event_title || "—";
                  const seats = o.items.flatMap((i) => i.seat_ids || []).length;
                  return (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="p-4 font-medium text-gray-900">#{o.id}</td>
                      <td className="p-4 text-gray-500">{formatDateTime(o.created_at)}</td>
                      <td className="p-4 text-gray-700">
                        {o.buyer_display_name || "Consumidor final"}
                        {o.buyer_cedula && (
                          <span className="block text-xs text-gray-400">C.I. {o.buyer_cedula}</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-700">{eventTitle}</td>
                      <td className="p-4 text-right text-gray-700">
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          <Ticket className="w-4 h-4 text-gray-400" />
                          {tickets}
                        </span>
                        {seats > 0 && (
                          <span className="block text-xs text-gray-400">{seats} con silla</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-700">{o.payment_method_name || "—"}</td>
                      <td className="p-4 text-right font-semibold text-gray-900">{formatPrice(o.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
