"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Customer } from "@/lib/types";
import { Button, Input, TextArea, Modal, EmptyState } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

interface Form {
  id?: number;
  name: string;
  email: string;
  phone: string;
  cedula: string;
  address: string;
  notes: string;
}

const emptyForm: Form = { name: "", email: "", phone: "", cedula: "", address: "", notes: "" };

export default function AdminClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    try { setCustomers(await api.get<Customer[]>(`/admin/customers${q}`)); } catch { setCustomers([]); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [search]);

  function openCreate() { setForm(emptyForm); setModalOpen(true); }
  function openEdit(c: Customer) {
    setForm({ id: c.id, name: c.name, email: c.email || "", phone: c.phone || "", cedula: c.cedula || "", address: c.address || "", notes: c.notes || "" });
    setModalOpen(true);
  }

  async function submit() {
    setSaving(true);
    try {
      const payload = { name: form.name, email: form.email || undefined, phone: form.phone || undefined, cedula: form.cedula || undefined, address: form.address || undefined, notes: form.notes || undefined };
      if (form.id) await api.put(`/admin/customers/${form.id}`, payload);
      else await api.post("/admin/customers", payload);
      setModalOpen(false);
      await load();
      toastSuccess("Cliente guardado.");
    } catch (e) { toastError(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  }

  async function remove(c: Customer) {
    if (!(await confirmDialog({ message: `¿Eliminar "${c.name}"?`, danger: true }))) return;
    try { await api.delete(`/admin/customers/${c.id}`); await load(); toastSuccess("Cliente eliminado."); } catch (e) { toastError(e instanceof Error ? e.message : "Error"); }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">Base de datos de clientes de mostrador.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <Button onClick={openCreate}><Plus className="w-4 h-4" /> Nuevo cliente</Button>
        </div>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
      ) : customers.length === 0 ? (
        <EmptyState message="No hay clientes." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {customers.map((c) => (
            <div key={c.id} className="px-5 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{c.name}</p>
                <p className="text-sm text-gray-500">{[c.phone, c.email].filter(Boolean).join(" · ") || "Sin contacto"}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="p-2 text-gray-500 hover:text-brand-600"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(c)} className="p-2 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Editar cliente" : "Nuevo cliente"}>
        <div className="space-y-3">
          <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Cédula" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
          </div>
          <Input label="Dirección" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <TextArea label="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
