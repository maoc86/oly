"use client";

import { useEffect, useState } from "react";
import { Wallet, ChevronUp, ChevronDown, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { CashSession } from "@/lib/types";
import { Button, Select, EmptyState } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { toastError } from "@/lib/toast";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-VE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminCajasPage() {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const q = status ? `?status=${status}` : "";
    try {
      setSessions(await api.get<CashSession[]>(`/admin/cash-sessions${q}`));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al cargar las cajas");
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cajas (turnos de venta)</h1>
          <p className="text-sm text-gray-500 mt-1">Supervisión de los turnos de caja de los vendedores.</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">Todas</option>
          <option value="open">Abiertas</option>
          <option value="closed">Cerradas</option>
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : sessions.length === 0 ? (
        <EmptyState message="No hay turnos de caja registrados." />
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const isOpen = expanded === s.id;
            const sum = s.summary;
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : s.id)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900">Caja #{s.id} · {s.user_name || `Usuario ${s.user_id}`}</p>
                    <p className="text-sm text-gray-500">
                      {fmtDate(s.opened_at)}{s.closed_at ? ` → ${fmtDate(s.closed_at)}` : " (abierta)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === "open" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                      {s.status === "open" ? "Abierta" : "Cerrada"}
                    </span>
                    <span className="font-bold text-gray-900">${Number(sum?.total_usd ?? 0).toFixed(2)}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {isOpen && sum && (
                  <div className="px-5 pb-4 border-t border-gray-100">
                    <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                      <div><p className="text-gray-500">Fondo inicial</p><p className="font-semibold text-gray-900">${Number(s.opening_float).toFixed(2)}</p></div>
                      <div><p className="text-gray-500">Ventas en efectivo (USD)</p><p className="font-semibold text-gray-900">${Number(sum.cash_sales).toFixed(2)}</p></div>
                      <div><p className="text-gray-500">Otros métodos (USD)</p><p className="font-semibold text-gray-900">${Number(sum.other_sales).toFixed(2)}</p></div>
                      <div><p className="text-gray-500">Esperado (USD)</p><p className="font-semibold text-gray-900">${Number(sum.expected_cash).toFixed(2)}</p></div>
                    </div>

                    {sum.by_currency && sum.by_currency.length > 0 && (
                      <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Consolidado por moneda</p>
                        {sum.by_currency.map((c, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600">{c.currency}</span>
                            <span className="font-medium text-gray-900">
                              {c.currency === "VES"
                                ? `Bs. ${Number(c.total).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`
                                : `$${Number(c.total).toFixed(2)}`}
                            </span>
                          </div>
                        ))}
                        <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-sm font-bold text-gray-900">
                          <span>Total consolidado (USD)</span>
                          <span>${Number(sum.total_usd).toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {sum.by_method && sum.by_method.length > 0 && (
                      <div className="mt-3 border-t pt-3 space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Por método de pago</p>
                        {sum.by_method.map((m, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600">{m.name} × {m.count}</span>
                            <span className="font-medium text-gray-900">
                              {m.currency === "VES" ? `Bs. ${Number(m.total).toLocaleString("es-VE", { minimumFractionDigits: 2 })}` : `$${Number(m.total).toFixed(2)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {s.status === "closed" && s.counted_cash != null && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-600">
                          Efectivo contado: <span className="font-semibold text-gray-900">${Number(s.counted_cash).toFixed(2)}</span>
                          {s.difference != null && (
                            <span className={`ml-3 font-semibold ${Number(s.difference) === 0 ? "text-emerald-600" : "text-red-600"}`}>
                              Diferencia: ${Number(s.difference).toFixed(2)}
                            </span>
                          )}
                        </p>
                        {s.notes && <p className="text-sm text-gray-500 mt-1">Notas: {s.notes}</p>}
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
