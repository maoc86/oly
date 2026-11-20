"use client";

import { useEffect, useState } from "react";
import { Wallet, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { CashSession } from "@/lib/types";
import { Button, Input } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";

export default function PosCajaPage() {
  const [session, setSession] = useState<CashSession | null>(null);
  const [history, setHistory] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingFloat, setOpeningFloat] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [current, list] = await Promise.all([
        api.get<CashSession | null>("/pos/cash/current"),
        api.get<CashSession[]>("/pos/cash/sessions"),
      ]);
      setSession(current);
      setHistory(list);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function open() {
    setSaving(true);
    try {
      await api.post("/pos/cash/open", { opening_float: Number(openingFloat || 0) });
      toastSuccess("Caja abierta.");
      await load();
    } catch (e) { toastError(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  }

  async function close() {
    setSaving(true);
    try {
      await api.post(`/pos/cash/${session!.id}/close`, { counted_cash: Number(countedCash || 0), notes: notes || undefined });
      toastSuccess("Caja cerrada.");
      await load();
    } catch (e) { toastError(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  }

  if (loading) return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;

  const byCurrency = session?.summary?.by_currency ?? [];
  const usdTotal = Number(byCurrency.find((c) => c.currency === "USD")?.total ?? 0);
  const vesTotal = Number(byCurrency.find((c) => c.currency === "VES")?.total ?? 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Caja</h1>

      {session ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-brand-600" />
            <h2 className="font-semibold text-gray-900">Turno abierto #{session.id}</h2>
          </div>
          {/* Consolidado por moneda */}
          <div className="mt-4 rounded-xl bg-gray-50 border border-gray-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Consolidado por moneda</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Vendido en USD</p>
                <p className="font-semibold text-gray-900">${usdTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-gray-500">Vendido en Bs.</p>
                <p className="font-semibold text-gray-900">Bs. {vesTotal.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm">
              <span className="font-medium text-gray-700">Total consolidado (USD)</span>
              <span className="font-bold text-gray-900">${Number(session.summary?.total_usd ?? 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Caja física (efectivo) */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Fondo inicial (USD)</p>
              <p className="font-semibold text-gray-900">${Number(session.opening_float).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500">Ventas en efectivo (USD)</p>
              <p className="font-semibold text-gray-900">${Number(session.summary?.cash_sales ?? 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500">Esperado en caja (USD)</p>
              <p className="font-semibold text-gray-900">${Number(session.summary?.expected_cash ?? 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-500">Otros métodos (USD)</p>
              <p className="font-semibold text-gray-900">${Number(session.summary?.other_sales ?? 0).toFixed(2)}</p>
            </div>
          </div>

          {/* Desglose por método de pago */}
          {session.summary?.by_method && session.summary.by_method.length > 0 && (
            <div className="mt-4 border-t pt-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Por método de pago</p>
              {session.summary.by_method.map((m, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600">{m.name} × {m.count}</span>
                  <span className="font-medium text-gray-900">
                    {m.currency === "VES" ? `Bs. ${Number(m.total).toLocaleString("es-VE", { minimumFractionDigits: 2 })}` : `$${Number(m.total).toFixed(2)}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            <Input label="Efectivo contado" type="number" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} />
            <Input label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="mt-4"><Button onClick={close} disabled={saving}>{saving ? "Cerrando…" : "Cerrar caja"}</Button></div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900">Abrir caja</h2>
          <p className="text-sm text-gray-500 mt-1">Registrá el fondo inicial para empezar a vender.</p>
          <div className="mt-4 max-w-xs">
            <Input label="Fondo inicial (USD)" type="number" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
          </div>
          <div className="mt-4"><Button onClick={open} disabled={saving}><CheckCircle2 className="w-4 h-4" /> Abrir caja</Button></div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {history.map((s) => (
            <div key={s.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-gray-900">Turno #{s.id}</p>
                <p className="text-xs text-gray-500">{new Date(s.opened_at).toLocaleString("es-VE")}</p>
              </div>
              <div className="text-right">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.status === "open" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                  {s.status === "open" ? "Abierta" : "Cerrada"}
                </span>
                {s.difference != null && (
                  <p className={`text-xs mt-1 ${Number(s.difference) === 0 ? "text-gray-500" : "text-red-600"}`}>
                    Diferencia: ${Number(s.difference).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
