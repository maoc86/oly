"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { usePosEvents } from "@/lib/pos";
import { CashSession } from "@/lib/types";
import { Button, EmptyState, Input, Select, TextArea } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import {
  Wallet, Lock, Unlock, RefreshCw, Banknote, CreditCard, CheckCircle2, AlertTriangle, Loader2,
} from "lucide-react";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function TaquillaCajaPage() {
  const { events, selectedId, select, loading: loadingEvents } = usePosEvents();
  const [session, setSession] = useState<CashSession | null>(null);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingFloat, setOpeningFloat] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback((eventId: number) => {
    return Promise.all([
      api.get<CashSession | null>(`/pos/cash/current?event_id=${eventId}`),
      api.get<CashSession[]>(`/pos/cash/sessions?event_id=${eventId}&limit=50`),
    ])
      .then(([current, history]) => {
        setSession(current);
        setSessions(history);
        setCountedCash("");
        setNotes("");
      })
      .catch(() => {
        setSession(null);
        setSessions([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    refresh(selectedId);
  }, [selectedId, refresh]);

  function reload() {
    if (selectedId == null) return;
    setLoading(true);
    refresh(selectedId);
  }

  function changeEvent(id: number | null) {
    setLoading(true);
    setSession(null);
    setSessions([]);
    select(id);
  }

  async function openCash() {
    if (selectedId == null) return;
    const value = openingFloat.trim() === "" ? 0 : Number(openingFloat);
    if (Number.isNaN(value) || value < 0) {
      toastError("El fondo inicial no puede ser negativo.");
      return;
    }
    setBusy(true);
    try {
      await api.post<CashSession>("/pos/cash/open", { event_id: selectedId, opening_float: value });
      setOpeningFloat("");
      toastSuccess("Caja abierta. Ya podés vender.");
      await refresh(selectedId);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "No se pudo abrir la caja.");
    } finally {
      setBusy(false);
    }
  }

  async function closeCash() {
    if (!session) return;
    const value = countedCash.trim() === "" ? 0 : Number(countedCash);
    if (Number.isNaN(value) || value < 0) {
      toastError("El efectivo contado no puede ser negativo.");
      return;
    }
    if (!(await confirmDialog({ message: "¿Cerrar la caja? No vas a poder vender más en este turno." }))) return;
    setBusy(true);
    try {
      const closed = await api.post<CashSession>(`/pos/cash/${session.id}/close`, {
        counted_cash: value,
        notes: notes.trim() || undefined,
      });
      setSession(closed);
      toastSuccess("Caja cerrada.");
      if (selectedId != null) await refresh(selectedId);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "No se pudo cerrar la caja.");
    } finally {
      setBusy(false);
    }
  }

  if (loadingEvents) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  const summary = session?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caja</h1>
          <p className="text-sm text-gray-500 mt-1">Abrí la caja al empezar el turno y cerrala al terminar.</p>
        </div>
        <div className="flex items-end gap-3">
          <div className="w-72">
            <Select
              label="Evento"
              value={selectedId ?? ""}
              onChange={(e) => changeEvent(e.target.value ? Number(e.target.value) : null)}
              options={events.map((e) => ({ value: e.id, label: e.title }))}
              placeholder={events.length ? "Elegí un evento" : "Sin eventos asignados"}
              disabled={events.length === 0}
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

      {selectedId == null ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <EmptyState message="Elegí un evento para gestionar su caja." />
        </div>
      ) : loading ? (
        <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
      ) : session && session.status === "open" ? (
        <>
          {/* Resumen del turno abierto */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-full bg-green-100 grid place-items-center">
                  <Unlock className="w-4 h-4 text-green-700" />
                </span>
                <div>
                  <p className="font-semibold text-gray-900">Caja abierta</p>
                  <p className="text-xs text-gray-500">
                    {session.event_title} · desde {formatDateTime(session.opened_at)}
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800">Abierta</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Fondo inicial</p>
                <p className="text-lg font-bold text-gray-900">{formatPrice(session.opening_float)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-3">
                <p className="text-xs text-emerald-700">Efectivo esperado</p>
                <p className="text-lg font-bold text-emerald-800">{formatPrice(summary?.expected_cash)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Ventas en efectivo</p>
                <p className="text-lg font-bold text-gray-900">{formatPrice(summary?.cash_sales)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Ventas otros métodos</p>
                <p className="text-lg font-bold text-gray-900">{formatPrice(summary?.other_sales)}</p>
              </div>
            </div>

            <div className="mt-3 text-sm text-gray-500">
              {summary?.orders ?? 0} venta(s) · {summary?.tickets ?? 0} boleto(s)
            </div>

            {summary && summary.by_method.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">Por método de pago</p>
                <div className="space-y-1.5">
                  {summary.by_method.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-600">
                        {m.is_cash ? (
                          <Banknote className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <CreditCard className="w-4 h-4 text-gray-400" />
                        )}
                        {m.name}
                        <span className="text-xs text-gray-400">({m.currency})</span>
                      </span>
                      <span className="text-gray-700">
                        {m.count} · {formatPrice(m.total)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cierre */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Lock className="w-5 h-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Cerrar caja</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Efectivo contado (USD)"
                type="number"
                min={0}
                step="0.01"
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                placeholder={String(summary?.expected_cash ?? 0)}
              />
              <TextArea
                label="Notas (opcional)"
                rows={1}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones del turno"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="danger" onClick={closeCash} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Cerrar caja
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Última caja cerrada */}
          {session && session.status === "closed" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <p className="font-semibold text-gray-900">Última caja cerrada</p>
                <span className="text-xs text-gray-500">{formatDateTime(session.closed_at || session.opened_at)}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Esperado</p>
                  <p className="text-lg font-bold text-gray-900">{formatPrice(session.summary?.expected_cash)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Contado</p>
                  <p className="text-lg font-bold text-gray-900">{formatPrice(session.counted_cash)}</p>
                </div>
                <div
                  className={`rounded-xl p-3 ${
                    Math.abs(Number(session.difference || 0)) < 0.01 ? "bg-gray-50" : "bg-amber-50"
                  }`}
                >
                  <p className="text-xs text-gray-500">Diferencia</p>
                  <p
                    className={`text-lg font-bold ${
                      Math.abs(Number(session.difference || 0)) < 0.01 ? "text-gray-900" : "text-amber-700"
                    }`}
                  >
                    {formatPrice(session.difference)}
                  </p>
                </div>
                <div className="rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Ventas</p>
                  <p className="text-lg font-bold text-gray-900">{session.summary?.orders ?? 0}</p>
                </div>
              </div>
              {session.notes && <p className="text-sm text-gray-500 mt-3">Nota: {session.notes}</p>}
            </div>
          )}

          {/* Abrir caja */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <Unlock className="w-5 h-5 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Abrir caja</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Ingresá el fondo inicial en efectivo con el que arrancás el turno (podés dejarlo en 0).
            </p>
            <div className="max-w-xs">
              <Input
                label="Fondo inicial (USD)"
                type="number"
                min={0}
                step="0.01"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="mt-4">
              <Button onClick={openCash} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                Abrir caja
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Historial */}
      {selectedId != null && sessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-gray-100">
            <Wallet className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Historial de cajas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-4">Apertura</th>
                  <th className="text-left p-4">Cierre</th>
                  <th className="text-left p-4">Estado</th>
                  <th className="text-right p-4">Fondo</th>
                  <th className="text-right p-4">Esperado</th>
                  <th className="text-right p-4">Contado</th>
                  <th className="text-right p-4">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="p-4 text-gray-500">{formatDateTime(s.opened_at)}</td>
                    <td className="p-4 text-gray-500">{s.closed_at ? formatDateTime(s.closed_at) : "—"}</td>
                    <td className="p-4">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          s.status === "open" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {s.status === "open" ? "Abierta" : "Cerrada"}
                      </span>
                    </td>
                    <td className="p-4 text-right text-gray-700">{formatPrice(s.opening_float)}</td>
                    <td className="p-4 text-right text-gray-700">{formatPrice(s.summary?.expected_cash)}</td>
                    <td className="p-4 text-right text-gray-700">
                      {s.counted_cash != null ? formatPrice(s.counted_cash) : "—"}
                    </td>
                    <td
                      className={`p-4 text-right font-semibold ${
                        s.difference == null
                          ? "text-gray-400"
                          : Math.abs(Number(s.difference)) < 0.01
                            ? "text-gray-700"
                            : "text-amber-600"
                      }`}
                    >
                      {s.difference != null ? formatPrice(s.difference) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedId != null && !loading && session == null && sessions.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <AlertTriangle className="w-4 h-4" /> Aún no hay turnos de caja para este evento.
        </div>
      )}
    </div>
  );
}
