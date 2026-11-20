"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { OrganizerSummary } from "@/lib/types";
import { Button, EmptyState, Modal, Input } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { Users, Plus, Pencil, CalendarDays, LayoutDashboard } from "lucide-react";

interface FormState {
  id: number | null;
  name: string;
  email: string;
  phone: string;
  password: string;
}

const EMPTY_FORM: FormState = { id: null, name: "", email: "", phone: "", password: "" };

export default function AdminOrganizadoresPage() {
  const [organizers, setOrganizers] = useState<OrganizerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrganizerSummary | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function reload() {
    return api
      .get<OrganizerSummary[]>("/admin/organizers")
      .then(setOrganizers)
      .catch(() => setOrganizers([]));
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  async function openDetail(o: OrganizerSummary) {
    try {
      const detail = await api.get<OrganizerSummary>(`/admin/organizers/${o.id}`);
      setSelected(detail);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al cargar el organizador");
    }
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(o: OrganizerSummary) {
    setForm({ id: o.id, name: o.name, email: o.email, phone: o.phone || "", password: "" });
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
        await api.put(`/admin/organizers/${form.id}`, {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await api.post("/admin/organizers", {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
        });
      }
      setFormOpen(false);
      await reload();
      toastSuccess(form.id ? "Organizador actualizado." : "Organizador creado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(o: OrganizerSummary) {
    if (!(await confirmDialog({ message: `¿${o.is_active ? "Desactivar" : "Activar"} a ${o.name}?` }))) return;
    try {
      await api.put(`/admin/users/${o.id}/toggle-active`);
      await reload();
      toastSuccess(o.is_active ? "Organizador desactivado." : "Organizador activado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    }
  }

  if (loading) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizadores</h1>
          <p className="text-sm text-gray-500 mt-1">
            Productores que venden sus eventos en la plataforma.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/organizador"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
          >
            <LayoutDashboard className="w-4 h-4" /> Ir al panel del organizador
          </Link>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" /> Nuevo organizador
          </Button>
        </div>
      </div>

      {organizers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <EmptyState message="No hay organizadores. Creá el primero." />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {organizers.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-brand-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{o.name}</p>
                    <p className="text-xs text-gray-500 truncate">{o.email}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                    o.is_active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {o.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-gray-900">{o.events}</p>
                  <p className="text-xs text-gray-500">Eventos</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{o.tickets_sold}</p>
                  <p className="text-xs text-gray-500">Boletos</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-brand-700">{formatPrice(o.net)}</p>
                  <p className="text-xs text-gray-500">Neto</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => openDetail(o)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
                >
                  Ver detalle
                </button>
                <button
                  onClick={() => openEdit(o)}
                  className="p-2 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleActive(o)}
                  className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  {o.is_active ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detalle */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="" size="2xl">
        {selected && (
          <div className="space-y-5 -mt-3">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="w-11 h-11 rounded-full bg-brand-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-brand-600" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{selected.name}</p>
                <p className="text-sm text-gray-500">{selected.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <Stat label="Neto total" value={formatPrice(selected.net)} strong />
              <Stat label="Ventas" value={formatPrice(selected.subtotal)} />
              <Stat label="Comisión" value={formatPrice(selected.platform_fee)} />
              <Stat label="Impuestos" value={formatPrice(selected.municipal_tax + selected.tax)} />
            </div>

            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <CalendarDays className="w-4 h-4" /> Eventos
              </p>
              {selected.events_detail && selected.events_detail.length > 0 ? (
                <div className="space-y-2">
                  {selected.events_detail.map((e) => (
                    <div key={e.id} className="flex items-center justify-between border border-gray-200 rounded-xl p-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{e.title}</p>
                        <p className="text-xs text-gray-500">
                          {e.tickets_sold} boletos · {e.orders} órdenes
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-gray-900">{formatPrice(e.net)}</p>
                        <p className="text-xs text-gray-400">neto</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Sin eventos todavía.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Alta / edición */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={form.id ? "Editar organizador" : "Nuevo organizador"} size="lg">
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
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`font-bold ${strong ? "text-brand-700" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
