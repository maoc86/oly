"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { api } from "@/lib/api";
import { ShippingMethod } from "@/lib/types";
import { Button, Input, Modal, EmptyState } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

interface Form {
  id?: number;
  name: string;
  price: string;
  description: string;
  estimated_days: string;
}

const emptyForm: Form = { name: "", price: "0", description: "", estimated_days: "" };

export default function AdminEnviosPage() {
  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try { setMethods(await api.get<ShippingMethod[]>("/admin/shipping-methods")); } catch { setMethods([]); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() { setForm(emptyForm); setModalOpen(true); }
  function openEdit(m: ShippingMethod) {
    setForm({ id: m.id, name: m.name, price: String(m.price ?? 0), description: m.description || "", estimated_days: m.estimated_days || "" });
    setModalOpen(true);
  }

  async function submit() {
    setSaving(true);
    try {
      const payload = { name: form.name, price: Number(form.price || 0), description: form.description || undefined, estimated_days: form.estimated_days || undefined };
      if (form.id) await api.put(`/admin/shipping-methods/${form.id}`, payload);
      else await api.post("/admin/shipping-methods", payload);
      setModalOpen(false);
      await load();
      toastSuccess("Método de envío guardado.");
    } catch (e) { toastError(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  }

  async function remove(m: ShippingMethod) {
    if (!(await confirmDialog({ message: `¿Eliminar "${m.name}"?`, danger: true }))) return;
    try { await api.delete(`/admin/shipping-methods/${m.id}`); await load(); toastSuccess("Eliminado."); } catch (e) { toastError(e instanceof Error ? e.message : "Error"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Métodos de envío</h1>
          <p className="text-sm text-gray-500 mt-1">Opciones de entrega disponibles en el checkout.</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> Nuevo método</Button>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
      ) : methods.length === 0 ? (
        <EmptyState message="No hay métodos de envío." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {methods.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-xl bg-brand-50 text-brand-600"><Truck className="w-5 h-5" /></span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{m.name}</h3>
                    {m.estimated_days && <p className="text-xs text-gray-500">{m.estimated_days}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(m)} className="p-2 text-gray-500 hover:text-brand-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => remove(m)} className="p-2 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <p className="mt-3 font-bold text-gray-900">${Number(m.price).toFixed(2)}</p>
              {m.description && <p className="text-sm text-gray-500 mt-1">{m.description}</p>}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Editar método" : "Nuevo método"}>
        <div className="space-y-3">
          <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Precio (USD)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <Input label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Tiempo estimado" value={form.estimated_days} onChange={(e) => setForm({ ...form, estimated_days: e.target.value })} placeholder="2-4 días hábiles" />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
