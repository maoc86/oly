"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Event } from "@/lib/types";
import { Button, EmptyState, Input, Modal, Select } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { BadgePercent, Pencil, Plus, Power, Trash2, CalendarClock } from "lucide-react";

interface Coupon {
  id: number;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  min_amount: number;
  max_discount: number | null;
  usage_limit: number | null;
  used_count: number;
  starts_at: string | null;
  expires_at: string | null;
  event_id: number | null;
  event_title: string | null;
  ticket_type_id: number | null;
  ticket_type_name: string | null;
  is_active: boolean;
  created_at: string | null;
}

interface CouponListResponse {
  total: number;
  items: Coupon[];
}

interface CouponForm {
  id?: number;
  code: string;
  type: "percentage" | "fixed";
  value: string;
  min_amount: string;
  max_discount: string;
  usage_limit: string;
  starts_at: string;
  expires_at: string;
  event_id: string;
  ticket_type_id: string;
  is_active: boolean;
}

const emptyForm: CouponForm = {
  code: "",
  type: "percentage",
  value: "",
  min_amount: "",
  max_discount: "",
  usage_limit: "",
  starts_at: "",
  expires_at: "",
  event_id: "",
  ticket_type_id: "",
  is_active: true,
};

function toLocalInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function dateLabel(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

function couponValueLabel(coupon: Coupon) {
  return coupon.type === "percentage" ? `${coupon.value}%` : money(coupon.value);
}

function couponState(coupon: Coupon): { label: string; className: string } {
  if (!coupon.is_active) return { label: "Inactivo", className: "bg-gray-100 text-gray-700" };
  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    return { label: "Programado", className: "bg-blue-100 text-blue-800" };
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
    return { label: "Vencido", className: "bg-red-100 text-red-700" };
  }
  if (coupon.usage_limit != null && coupon.used_count >= coupon.usage_limit) {
    return { label: "Agotado", className: "bg-amber-100 text-amber-800" };
  }
  return { label: "Activo", className: "bg-emerald-100 text-emerald-800" };
}

export default function AdminCuponesPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<CouponListResponse>("/admin/coupons?limit=500");
      setCoupons(data.items || []);
    } catch (e) {
      setCoupons([]);
      toastError(e instanceof Error ? e.message : "No se pudieron cargar los cupones");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api
      .get<Event[]>("/admin/events")
      .then((data) => setEvents(data))
      .catch(() => setEvents([]));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return coupons.filter((c) => {
      if (statusFilter === "active" && !c.is_active) return false;
      if (statusFilter === "inactive" && c.is_active) return false;
      if (!term) return true;
      return (
        c.code.toLowerCase().includes(term) ||
        (c.event_title || "").toLowerCase().includes(term) ||
        (c.ticket_type_name || "").toLowerCase().includes(term)
      );
    });
  }, [coupons, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: coupons.length,
      active: coupons.filter((c) => couponState(c).label === "Activo").length,
      uses: coupons.reduce((sum, c) => sum + (c.used_count || 0), 0),
    }),
    [coupons]
  );

  const selectedEvent = events.find((e) => String(e.id) === form.event_id) || null;
  const ticketTypeOptions = (selectedEvent?.ticket_types || []).map((tt) => ({
    value: tt.id,
    label: tt.name,
  }));

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(coupon: Coupon) {
    setForm({
      id: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: String(coupon.value),
      min_amount: coupon.min_amount ? String(coupon.min_amount) : "",
      max_discount: coupon.max_discount != null ? String(coupon.max_discount) : "",
      usage_limit: coupon.usage_limit != null ? String(coupon.usage_limit) : "",
      starts_at: toLocalInput(coupon.starts_at),
      expires_at: toLocalInput(coupon.expires_at),
      event_id: coupon.event_id ? String(coupon.event_id) : "",
      ticket_type_id: coupon.ticket_type_id ? String(coupon.ticket_type_id) : "",
      is_active: coupon.is_active,
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!form.code.trim()) {
      toastError("Ingresá un código de cupón.");
      return;
    }
    if (!form.value || Number(form.value) <= 0) {
      toastError("Ingresá un valor mayor que cero.");
      return;
    }
    if (form.type === "percentage" && Number(form.value) > 100) {
      toastError("El porcentaje no puede superar 100.");
      return;
    }

    setSaving(true);
    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      value: Number(form.value),
      min_amount: form.min_amount ? Number(form.min_amount) : 0,
      max_discount: form.max_discount ? Number(form.max_discount) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      starts_at: fromLocalInput(form.starts_at),
      expires_at: fromLocalInput(form.expires_at),
      event_id: form.event_id ? Number(form.event_id) : null,
      ticket_type_id: form.ticket_type_id ? Number(form.ticket_type_id) : null,
      is_active: form.is_active,
    };
    try {
      if (form.id) {
        await api.put(`/admin/coupons/${form.id}`, payload);
      } else {
        await api.post("/admin/coupons", payload);
      }
      setModalOpen(false);
      await load();
      toastSuccess(form.id ? "Cupón actualizado." : "Cupón creado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar el cupón");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    try {
      await api.put(`/admin/coupons/${coupon.id}`, { is_active: !coupon.is_active });
      await load();
      toastSuccess(coupon.is_active ? "Cupón desactivado." : "Cupón activado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al actualizar el cupón");
    }
  }

  async function handleDelete(coupon: Coupon) {
    if (
      !(await confirmDialog({
        message: `¿Eliminar el cupón "${coupon.code}"? Si ya tiene usos, solo se desactivará.`,
        danger: true,
      }))
    )
      return;
    try {
      await api.delete(`/admin/coupons/${coupon.id}`);
      await load();
      toastSuccess("Cupón actualizado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al eliminar el cupón");
    }
  }

  if (loading && coupons.length === 0) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cupones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Códigos de descuento por porcentaje o monto fijo, con vigencia y límite de usos.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nuevo cupón
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Cupones creados</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Activos ahora</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm text-gray-500">Usos registrados</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.uses}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-4 flex flex-col sm:flex-row gap-3 border-b border-gray-100">
          <div className="flex-1">
            <Input
              placeholder="Buscar por código, evento o área…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sm:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              placeholder={null}
              options={[
                { value: "all", label: "Todos los estados" },
                { value: "active", label: "Solo activos" },
                { value: "inactive", label: "Solo inactivos" },
              ]}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState message={coupons.length === 0 ? "Todavía no hay cupones. Creá el primero." : "No hay cupones que coincidan con el filtro."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Código</th>
                  <th className="text-left px-4 py-3 font-medium">Descuento</th>
                  <th className="text-left px-4 py-3 font-medium">Aplica a</th>
                  <th className="text-left px-4 py-3 font-medium">Usos</th>
                  <th className="text-left px-4 py-3 font-medium">Vigencia</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-right px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((coupon) => {
                  const state = couponState(coupon);
                  return (
                    <tr key={coupon.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-700">
                            <BadgePercent className="w-4 h-4" />
                          </span>
                          <div>
                            <p className="font-semibold text-gray-900 tracking-wide">{coupon.code}</p>
                            {coupon.min_amount > 0 && (
                              <p className="text-xs text-gray-500">Mínimo {money(coupon.min_amount)}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">{couponValueLabel(coupon)}</span>
                        {coupon.type === "percentage" && coupon.max_discount != null && (
                          <p className="text-xs text-gray-500">Tope {money(coupon.max_discount)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {coupon.ticket_type_name || coupon.event_title || "Todos los eventos"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {coupon.used_count}
                        {coupon.usage_limit != null ? ` / ${coupon.usage_limit}` : ""}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock className="w-3.5 h-3.5 text-gray-400" />
                          {coupon.starts_at || coupon.expires_at
                            ? `${dateLabel(coupon.starts_at)} → ${dateLabel(coupon.expires_at)}`
                            : "Sin límite"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${state.className}`}>
                          {state.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(coupon)}
                            className="p-2 text-gray-500 hover:text-brand-600"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleActive(coupon)}
                            className="p-2 text-gray-500 hover:text-emerald-600"
                            title={coupon.is_active ? "Desactivar" : "Activar"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(coupon)}
                            className="p-2 text-gray-500 hover:text-red-600"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? "Editar cupón" : "Nuevo cupón"}
        size="2xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Código"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="PREVENTA20"
              maxLength={50}
            />
            <Select
              label="Tipo de descuento"
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, type: e.target.value as "percentage" | "fixed" }))
              }
              placeholder={null}
              options={[
                { value: "percentage", label: "Porcentaje (%)" },
                { value: "fixed", label: "Monto fijo (USD)" },
              ]}
            />
            <Input
              label={form.type === "percentage" ? "Porcentaje" : "Monto fijo (USD)"}
              type="number"
              min="0"
              step="0.01"
              value={form.value}
              onChange={(e) => setForm((prev) => ({ ...prev, value: e.target.value }))}
              placeholder={form.type === "percentage" ? "20" : "5.00"}
            />
            <Input
              label="Compra mínima (USD)"
              type="number"
              min="0"
              step="0.01"
              value={form.min_amount}
              onChange={(e) => setForm((prev) => ({ ...prev, min_amount: e.target.value }))}
              placeholder="0"
            />
            {form.type === "percentage" && (
              <Input
                label="Tope del descuento (USD, opcional)"
                type="number"
                min="0"
                step="0.01"
                value={form.max_discount}
                onChange={(e) => setForm((prev) => ({ ...prev, max_discount: e.target.value }))}
                placeholder="Sin tope"
              />
            )}
            <Input
              label="Límite de usos (opcional)"
              type="number"
              min="1"
              step="1"
              value={form.usage_limit}
              onChange={(e) => setForm((prev) => ({ ...prev, usage_limit: e.target.value }))}
              placeholder="Ilimitado"
            />
            <Input
              label="Vigente desde (opcional)"
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm((prev) => ({ ...prev, starts_at: e.target.value }))}
            />
            <Input
              label="Vence el (opcional)"
              type="datetime-local"
              value={form.expires_at}
              onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
            />
            <Select
              label="Evento (opcional)"
              value={form.event_id}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, event_id: e.target.value, ticket_type_id: "" }))
              }
              options={events.map((ev) => ({ value: ev.id, label: ev.title }))}
              placeholder="Todos los eventos"
            />
            <Select
              label="Tipo de entrada (opcional)"
              value={form.ticket_type_id}
              onChange={(e) => setForm((prev) => ({ ...prev, ticket_type_id: e.target.value }))}
              options={ticketTypeOptions}
              placeholder={form.event_id ? "Todas las áreas" : "Elegí un evento primero"}
              disabled={!form.event_id}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="w-4 h-4"
            />
            Cupón activo (disponible para usar)
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear cupón"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
