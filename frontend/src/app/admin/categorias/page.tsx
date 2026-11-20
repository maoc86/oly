"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Category } from "@/lib/types";
import { Button, Input, Modal, EmptyState } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";

interface CategoryForm {
  id?: number;
  name: string;
  icon: string;
}

const emptyForm: CategoryForm = { name: "", icon: "" };

export default function AdminCategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Category[]>("/admin/categories")
      .then(setCategories)
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Category[]>("/admin/categories");
      setCategories(data);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(c: Category) {
    setForm({ id: c.id, name: c.name, icon: c.icon || "" });
    setModalOpen(true);
  }

  async function handleSubmit() {
    setSaving(true);
    const payload = { name: form.name, icon: form.icon || undefined };
    try {
      if (form.id) {
        await api.put(`/admin/categories/${form.id}`, payload);
      } else {
        await api.post("/admin/categories", payload);
      }
      setModalOpen(false);
      await load();
      toastSuccess(form.id ? "Categoría actualizada." : "Categoría creada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!(await confirmDialog({ message: `¿Eliminar la categoría "${name}"?`, danger: true }))) return;
    try {
      await api.delete(`/admin/categories/${id}`);
      await load();
      toastSuccess("Categoría eliminada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  if (loading) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-sm text-gray-500 mt-1">Clasifica los productos (Leggings, Tops, Conjuntos...).</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nueva categoría
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState message="No hay categorías. Crea la primera." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((c) => (
            <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-brand-100 rounded-xl">
                    <Tags className="w-6 h-6 text-brand-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{c.name}</h3>
                    {c.icon && <p className="text-sm text-gray-500">{c.icon}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="p-2 text-gray-500 hover:text-brand-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(c.id, c.name)} className="p-2 text-gray-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Editar categoría" : "Nueva categoría"}>
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Conciertos, Deportes, Teatro..."
          />
          <Input
            label="Icono"
            value={form.icon}
            onChange={(e) => setForm((prev) => ({ ...prev, icon: e.target.value }))}
            placeholder="music, ball, drama..."
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear categoría"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
