"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Button, EmptyState } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import {
  AlertCircle, Clock, Phone, Mail, ExternalLink, RefreshCw,
  MessageCircle, Ban, Trash2,
} from "lucide-react";

type Attempt = {
  id: number;
  event_name: string | null;
  payment_method_name: string | null;
  payment_method_requires_receipt: boolean | null;
  step: string | null;
  status: string | null;
  error_type: string | null;
  error_detail: string | null;
  estimated_total: number | null;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  order_id: number | null;
  created_at: string | null;
  last_activity_at: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  error: "bg-red-100 text-red-700",
  abandoned: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABEL: Record<string, string> = {
  error: "Con error",
  abandoned: "Abandonado",
  in_progress: "En curso",
  completed: "Completado",
};

const STEP_LABEL: Record<string, string> = {
  select_seats: "Seleccionar asientos",
  details: "Datos del comprador",
  payment: "Elegir método",
  upload_receipt: "Subir comprobante",
};

function timeAgo(iso?: string | null) {
  if (!iso) return "-";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export default function AbandonedCheckoutsPage() {
  const [items, setItems] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upload_failed" | "error" | "abandoned">("all");
  const [hours, setHours] = useState(48);
  const [stats, setStats] = useState<any>(null);
  const [marking, setMarking] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([
        api.get<any>(`/admin/checkout-attempts?only_receipt_fail=${filter === "upload_failed"}&only_with_error=${filter === "error"}&status=${filter === "abandoned" ? "abandoned" : ""}&since_hours=${hours}&limit=200`),
        api.get<any>(`/admin/checkout-attempts/stats/summary?hours=${hours}`),
      ]);
      setItems(list.items || []);
      setStats(summary);
    } catch (e) {
      console.error(e);
      toastError(e instanceof Error ? e.message : "No se pudieron cargar los intentos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, hours]);

  const filtered = useMemo(() => {
    if (filter === "upload_failed") return items.filter(i => i.step === "upload_receipt" && i.error_type === "upload_failed");
    if (filter === "error") return items.filter(i => i.status === "error");
    if (filter === "abandoned") return items.filter(i => i.status === "abandoned");
    return items;
  }, [items, filter]);

  function whatsappLink(a: Attempt) {
    const phone = (a.buyer_phone || a.user_phone || "").replace(/\D/g, "");
    if (!phone) return null;
    const name = a.buyer_name || a.user_name || "";
    const event = a.event_name || "el evento";
    const msg = encodeURIComponent(`Hola ${name}, vimos que intentaste comprar entradas para ${event} pero hubo un problema al subir el comprobante. Si ya realizaste el pago, podés reenviarnos el comprobante por aquí o desde "Mis Órdenes". Gracias.`);
    return `https://wa.me/${phone}?text=${msg}`;
  }

  async function markAbandoned(id: number) {
    if (!(await confirmDialog({ message: "¿Marcar este intento como abandonado?", danger: false }))) return;
    setMarking(id);
    try {
      await api.post(`/admin/checkout-attempts/${id}/mark-abandoned`, {});
      toastSuccess("Intento marcado como abandonado.");
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al actualizar");
    } finally {
      setMarking(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compras abandonadas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Intentos de checkout que no llegaron a crear la orden.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value={24}>Últimas 24h</option>
            <option value={48}>Últimas 48h</option>
            <option value={72}>Últimas 72h</option>
            <option value={168}>Últimos 7 días</option>
          </select>
          <Button variant="secondary" onClick={load}>
            <RefreshCw className="w-4 h-4" /> Actualizar
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Intentos</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Fallo al subir comprobante</p>
            <p className="text-xl font-bold text-red-600 mt-1">{stats.upload_failed_receipt}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Con error</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{stats.errors}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Abandonados</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{stats.abandoned}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Monto potencial (USD)</p>
            <p className="text-xl font-bold text-gray-900 mt-1">${Number(stats.potential_amount_usd || 0).toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <p className="text-xs text-gray-500">Recuperados (7d)</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{stats.recovered_7d} <span className="text-xs font-normal text-gray-400">({stats.recovery_rate_pct}%)</span></p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { key: "all", label: "Todos" },
          { key: "upload_failed", label: "Falló al subir comprobante" },
          { key: "error", label: "Todos con error" },
          { key: "abandoned", label: "Abandonados" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as any)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              filter === f.key
                ? "bg-brand-500 border-brand-500 text-ink-900 font-semibold"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Cliente</th>
                <th className="text-left px-4 py-3 font-medium">Evento / Método</th>
                <th className="text-left px-4 py-3 font-medium">Paso / Estado</th>
                <th className="text-left px-4 py-3 font-medium">Error</th>
                <th className="text-left px-4 py-3 font-medium">Monto</th>
                <th className="text-left px-4 py-3 font-medium">Tiempo</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <>
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 rounded animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-14 bg-gray-200 rounded animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse ml-auto" /></td>
                    </tr>
                  ))}
                </>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">Sin intentos con estos filtros</td></tr>
              ) : filtered.map((a) => {
                const wa = whatsappLink(a);
                const name = a.buyer_name || a.user_name || "Sin nombre";
                const email = a.buyer_email || a.user_email;
                const phone = a.buyer_phone || a.user_phone;
                return (
                  <tr key={a.id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{name}</p>
                      {email && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{email}</p>}
                      {phone && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{phone}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{a.event_name || "-"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{a.payment_method_name || "-"} {a.payment_method_requires_receipt ? "• Requiere comprobante" : ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[a.status || ""] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[a.status || ""] || a.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">{STEP_LABEL[a.step || ""] || a.step}</p>
                    </td>
                    <td className="px-4 py-3">
                      {a.error_type ? (
                        <div>
                          <p className="text-red-600 text-xs font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" />{a.error_type}</p>
                          {a.error_detail && <p className="text-xs text-gray-500 truncate max-w-[220px] mt-0.5" title={a.error_detail}>{a.error_detail}</p>}
                        </div>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 font-medium">{a.estimated_total != null ? `$${Number(a.estimated_total).toFixed(2)}` : "-"}</td>
                    <td className="px-4 py-3 text-gray-500">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(a.last_activity_at || a.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {a.order_id && (
                          <a href="/admin/facturacion" className="p-2 text-gray-500 hover:text-brand-600" title="Ver orden">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        {wa && (
                          <a href={wa} target="_blank" rel="noreferrer" className="p-2 text-green-600 hover:text-green-700" title="Contactar por WhatsApp">
                            <MessageCircle className="w-4 h-4" />
                          </a>
                        )}
                        {a.status !== "abandoned" && a.status !== "completed" && (
                          <button
                            onClick={() => markAbandoned(a.id)}
                            disabled={marking === a.id}
                            className="p-2 text-gray-500 hover:text-amber-600 disabled:opacity-50"
                            title="Marcar como abandonado"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
