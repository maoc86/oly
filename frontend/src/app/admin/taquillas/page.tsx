"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Event, StaffMember } from "@/lib/types";
import { Button, EmptyState, Modal, Input } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import {
  Store, Plus, Pencil, CalendarDays, Wallet, RefreshCw, CheckCircle2,
} from "lucide-react";

interface FormState {
  id: number | null;
  name: string;
  email: string;
  phone: string;
  password: string;
}

const EMPTY_FORM: FormState = { id: null, name: "", email: "", phone: "", password: "" };

interface CashSessionRow {
  id: number;
  event_id: number;
  event_title: string | null;
  staff_id: number;
  staff_name: string | null;
  status: string;
  opening_float: number;
  expected_cash: number;
  counted_cash: number | null;
  difference: number | null;
  notes: string | null;
  opened_at: string;
  closed_at: string | null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminTaquillasPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [assignFor, setAssignFor] = useState<StaffMember | null>(null);
  const [assignIds, setAssignIds] = useState<number[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [sessions, setSessions] = useState<CashSessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  function loadStaff() {
    return api
      .get<StaffMember[]>("/admin/staff")
      .then(setStaff)
      .catch(() => setStaff([]));
  }

  function loadSessions() {
    return api
      .get<CashSessionRow[]>("/admin/staff/sessions")
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  }

  function reloadSessions() {
    setSessionsLoading(true);
    loadSessions();
  }

  useEffect(() => {
    Promise.all([
      loadStaff(),
      api.get<Event[]>("/admin/events").then(setEvents).catch(() => setEvents([])),
      loadSessions(),
    ]).finally(() => setLoading(false));
  }, []);

  const eventTitleById = useMemo(() => {
    const map = new Map<number, string>();
    events.forEach((e) => map.set(e.id, e.title));
    return map;
  }, [events]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(s: StaffMember) {
    setForm({ id: s.id, name: s.name, email: s.email, phone: s.phone || "", password: "" });
    setFormOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.email.trim()) {
      toastError("Nombre y email son obligatorios.");
      return;
    }
    if (!form.id && form.password.length < 8) {
      toastError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        await api.put(`/admin/staff/${form.id}`, {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await api.post("/admin/staff", {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
        });
      }
      setFormOpen(false);
      await loadStaff();
      toastSuccess(form.id ? "Vendedor actualizado." : "Vendedor creado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function openAssign(s: StaffMember) {
    setAssignFor(s);
    setAssignIds([...s.event_ids]);
  }

  async function saveAssign() {
    if (!assignFor) return;
    setAssignSaving(true);
    try {
      await api.put(`/admin/staff/${assignFor.id}/events`, { event_ids: assignIds });
      setAssignFor(null);
      await loadStaff();
      toastSuccess("Eventos asignados.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al asignar eventos");
    } finally {
      setAssignSaving(false);
    }
  }

  function toggleAssign(id: number) {
    setAssignIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function toggleActive(s: StaffMember) {
    if (!(await confirmDialog({ message: `¿${s.is_active ? "Desactivar" : "Activar"} a ${s.name}?` }))) return;
    try {
      await api.put(`/admin/users/${s.id}/toggle-active`);
      await loadStaff();
      toastSuccess(s.is_active ? "Vendedor desactivado." : "Vendedor activado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    }
  }

  if (loading) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Taquillas</h1>
          <p className="text-sm text-gray-500 mt-1">
            Vendedores de venta presencial. Asigná a qué eventos puede vender cada uno.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nuevo vendedor
        </Button>
      </div>

      {staff.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <EmptyState message="No hay vendedores de taquilla. Creá el primero." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {staff.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <Store className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500 truncate">{s.email}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    s.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {s.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900">{s.event_ids.length}</p>
                  <p className="text-xs text-gray-500">Eventos asignados</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-brand-700">{formatPrice(s.sales_total)}</p>
                  <p className="text-xs text-gray-500">{s.sales_count} ventas</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => openAssign(s)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
                >
                  <CalendarDays className="w-4 h-4" /> Eventos
                </button>
                <button
                  onClick={() => openEdit(s)}
                  className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(s)}
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  {s.is_active ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cuadres de caja */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-gray-400" />
            <div>
              <h2 className="font-semibold text-gray-900">Cuadres de caja</h2>
              <p className="text-xs text-gray-500">
                Aperturas y cierres de los vendedores (el efectivo contado vs. lo esperado).
              </p>
            </div>
          </div>
          <button
            onClick={reloadSessions}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>

        {sessionsLoading ? (
          <div className="h-24 bg-gray-100 animate-pulse" />
        ) : sessions.length === 0 ? (
          <EmptyState message="Todavía no hay turnos de caja." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-4">Apertura</th>
                  <th className="text-left p-4">Evento</th>
                  <th className="text-left p-4">Vendedor</th>
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
                    <td className="p-4 text-gray-700">
                      {s.event_title || eventTitleById.get(s.event_id) || `Evento #${s.event_id}`}
                    </td>
                    <td className="p-4 text-gray-700">{s.staff_name || `#${s.staff_id}`}</td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          s.status === "open"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {s.status === "open" ? "Abierta" : "Cerrada"}
                      </span>
                    </td>
                    <td className="p-4 text-right text-gray-700">{formatPrice(s.opening_float)}</td>
                    <td className="p-4 text-right text-gray-700">{formatPrice(s.expected_cash)}</td>
                    <td className="p-4 text-right text-gray-700">
                      {s.counted_cash != null ? formatPrice(s.counted_cash) : "—"}
                    </td>
                    <td
                      className={`p-4 text-right font-semibold ${
                        s.difference == null
                          ? "text-gray-400"
                          : Math.abs(s.difference) < 0.01
                            ? "text-gray-700"
                            : s.difference > 0
                              ? "text-amber-600"
                              : "text-red-600"
                      }`}
                    >
                      {s.difference != null ? formatPrice(s.difference) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Alta / edición */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Editar vendedor" : "Nuevo vendedor de taquilla"}
        size="lg"
      >
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input
            label={form.id ? "Nueva contraseña (opcional)" : "Contraseña"}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={form.id ? "Dejar vacío para no cambiar" : "Mínimo 8 caracteres"}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Asignar eventos */}
      <Modal
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        title={assignFor ? `Eventos de ${assignFor.name}` : ""}
        size="2xl"
      >
        {assignFor && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              El vendedor solo podrá vender y validar boletos en los eventos marcados.
            </p>
            {events.length === 0 ? (
              <p className="text-sm text-gray-400">No hay eventos creados.</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {events.map((e) => {
                  const checked = assignIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleAssign(e.id)}
                      className={`w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-xl border transition-colors ${
                        checked
                          ? "border-brand-400 bg-brand-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{e.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(e.start_date).toLocaleDateString("es-ES", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                          {" · "}
                          {e.status}
                        </p>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          checked ? "bg-brand-500 border-brand-500 text-ink-900" : "border-gray-300"
                        }`}
                      >
                        {checked && <CheckCircle2 className="w-4 h-4" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setAssignFor(null)}>
                Cancelar
              </Button>
              <Button onClick={saveAssign} disabled={assignSaving}>
                {assignSaving ? "Guardando..." : "Guardar eventos"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
