"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Percent } from "lucide-react";
import { api } from "@/lib/api";
import { Coupon, Category, Product } from "@/lib/types";
import { Button, Input, Select, Modal, EmptyState, Badge } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

interface Form {
  id?: number;
  code: string;
  type: string;
  value: string;
  min_amount: string;
  max_discount: string;
  usage_limit: string;
  product_id: string;
  category_id: string;
  is_active: boolean;
}

const emptyForm: Form = {
  code: "", type: "percentage", value: "", min_amount: "0", max_discount: "",
  usage_limit: "", product_id: "", category_id: "", is_active: true,
};

export default function AdminCuponesPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<{ total: number; items: Coupon[] }>("/admin/coupons");
      setCoupons(data.items);
    } catch { setCoupons([]); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.get<Category[]>("/admin/categories").then(setCategories).catch(() => {});
    api.get<{ total: number; items: Product[] }>("/admin/products?limit=500").then((d) => setProducts(d.items)).catch(() => {});
  }, []);

  function openCreate() { setForm(emptyForm); setModalOpen(true); }
  function openEdit(c: Coupon) {
    setForm({
      id: c.id, code: c.code, type: c.type, value: String(c.value),
      min_amount: String(c.min_amount ?? 0), max_discount: c.max_discount != null ? String(c.max_discount) : "",
      usage_limit: c.usage_limit != null ? String(c.usage_limit) : "",
      product_id: c.product_id ? String(c.product_id) : "", category_id: c.category_id ? String(c.category_id) : "",
      is_active: c.is_active,
    });
    setModalOpen(true);
  }

  async function submit() {
    setSaving(true);
    try {
      const payload: any = {
        code: form.code,
        type: form.type,
        value: Number(form.value),
        min_amount: Number(form.min_amount || 0),
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        product_id: form.product_id ? Number(form.product_id) : null,
        category_id: form.category_id ? Number(form.category_id) : null,
        is_active: form.is_active,
      };
      if (form.id) await api.put(`/admin/coupons/${form.id}`, payload);
      else await api.post("/admin/coupons", payload);
      setModalOpen(false);
      await load();
      toastSuccess("Cupón guardado.");
    } catch (e) { toastError(e instanceof Error ? e.message : "Error"); } finally { setSaving(false); }
  }

  async function remove(c: Coupon) {
    if (!(await confirmDialog({ message: `¿Eliminar el cupón "${c.code}"?`, danger: true }))) return;
    try { await api.delete(`/admin/coupons/${c.id}`); await load(); toastSuccess("Cupón eliminado."); } catch (e) { toastError(e instanceof Error ? e.message : "Error"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cupones</h1>
          <p className="text-sm text-gray-500 mt-1">Códigos de descuento para el checkout.</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> Nuevo cupón</Button>
      </div>

      {loading ? (
        <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
      ) : coupons.length === 0 ? (
        <EmptyState message="No hay cupones." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {coupons.map((c) => (
            <div key={c.id} className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <span className="grid place-items-center w-10 h-10 rounded-xl bg-brand-50 text-brand-600"><Percent className="w-5 h-5" /></span>
                <div className="min-w-0">
                  <p className="font-mono font-semibold text-gray-900">{c.code}</p>
                  <p className="text-sm text-gray-500">
                    {c.type === "percentage" ? `${c.value}%` : `$${c.value}`}
                    {c.min_amount > 0 ? ` · desde $${c.min_amount}` : ""} · usos {c.used_count}{c.usage_limit ? `/${c.usage_limit}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge status={c.is_active ? "completed" : "cancelled"} />
                <button onClick={() => openEdit(c)} className="p-2 text-gray-500 hover:text-brand-600"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => remove(c)} className="p-2 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Editar cupón" : "Nuevo cupón"}>
        <div className="space-y-3">
          <Input label="Código" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipo" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} options={[{ value: "percentage", label: "Porcentaje (%)" }, { value: "fixed", label: "Monto fijo (USD)" }]} placeholder={null} />
            <Input label="Valor" type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Compra mínima" type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} />
            <Input label="Tope de descuento" type="number" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} />
          </div>
          <Input label="Límite de usos (vacío = ilimitado)" type="number" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Restringir a categoría" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} options={categories.map((c) => ({ value: c.id, label: c.name }))} placeholder="Todas" />
            <Select label="Restringir a producto" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} options={products.map((p) => ({ value: p.id, label: p.name }))} placeholder="Todos" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activo
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
