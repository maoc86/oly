"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Venue } from "@/lib/types";
import { Button, Input, Modal, EmptyState } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { Plus, Pencil, Trash2, MapPin, Users } from "lucide-react";

interface VenueForm {
  id?: number;
  name: string;
  address: string;
  city: string;
  country: string;
  total_capacity: string;
}

const emptyForm: VenueForm = {
  name: "",
  address: "",
  city: "",
  country: "",
  total_capacity: "0",
};

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<VenueForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Venue[]>("/admin/venues")
      .then(setVenues)
      .catch(() => setVenues([]))
      .finally(() => setLoading(false));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Venue[]>("/admin/venues");
      setVenues(data);
    } catch {
      setVenues([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(v: Venue) {
    setForm({
      id: v.id,
      name: v.name,
      address: v.address || "",
      city: v.city || "",
      country: v.country || "",
      total_capacity: String(v.total_capacity || 0),
    });
    setModalOpen(true);
  }

  function updateField(key: keyof VenueForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    const payload = {
      name: form.name,
      address: form.address || undefined,
      city: form.city || undefined,
      country: form.country || undefined,
      total_capacity: Number(form.total_capacity) || 0,
    };
    try {
      if (form.id) {
        await api.put(`/admin/venues/${form.id}`, payload);
      } else {
        await api.post("/admin/venues", payload);
      }
      setModalOpen(false);
      await load();
      toastSuccess(form.id ? "Venue actualizado." : "Venue creado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!(await confirmDialog({ message: `¿Eliminar el venue "${name}"?`, danger: true }))) return;
    try {
      await api.delete(`/admin/venues/${id}`);
      await load();
      toastSuccess("Venue eliminado.");
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
          <h1 className="text-2xl font-bold text-gray-900">Venues y Estadios</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configura estadios con capacidad máxima. Las áreas se definen por evento.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nuevo venue
        </Button>
      </div>

      {venues.length === 0 ? (
        <EmptyState message="No hay venues. Crea tu primer estadio." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {venues.map((v) => (
            <div key={v.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-accent-100 rounded-xl">
                      <MapPin className="w-6 h-6 text-accent-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{v.name}</h3>
                      <p className="text-sm text-gray-500">
                        {v.city ? `${v.city}, ` : ""}{v.country || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(v)} className="p-2 text-gray-500 hover:text-brand-600">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(v.id, v.name)} className="p-2 text-gray-500 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  Capacidad máxima: {v.total_capacity.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Editar venue" : "Nuevo venue"}>
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Estadio Azteca"
          />
          <Input
            label="Capacidad máxima"
            type="number"
            min="0"
            value={form.total_capacity}
            onChange={(e) => updateField("total_capacity", e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Ciudad"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
            />
            <Input
              label="País"
              value={form.country}
              onChange={(e) => updateField("country", e.target.value)}
            />
          </div>
          <Input
            label="Dirección"
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear venue"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
