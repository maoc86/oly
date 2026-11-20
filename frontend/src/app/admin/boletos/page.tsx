"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TicketTemplate } from "@/lib/types";
import { Button, Input, Modal, EmptyState } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { Plus, Pencil, Trash2, Ticket as TicketIcon, Star, UploadCloud, X, Eye } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

const BRAND_DEFAULT = "#ffb800";
const ACCENT_DEFAULT = "#ff8a00";

interface TicketTemplateForm {
  id?: number;
  name: string;
  description: string;
  brand_color: string;
  accent_color: string;
  text_color: string;
  background_image_url: string;
  logo_url: string;
  footer_text: string;
  is_active: boolean;
  is_default: boolean;
}

const emptyForm: TicketTemplateForm = {
  name: "",
  description: "",
  brand_color: BRAND_DEFAULT,
  accent_color: ACCENT_DEFAULT,
  text_color: "#ffffff",
  background_image_url: "",
  logo_url: "",
  footer_text: "",
  is_active: true,
  is_default: false,
};

/** Miniatura del boleto: mitad izquierda (info + fondo) y talón con el QR. */
function TicketPreview({ form }: { form: TicketTemplateForm }) {
  const bg = form.background_image_url;
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm flex flex-col sm:flex-row min-h-[150px]">
      <div
        className="relative flex-1 p-4 text-white"
        style={{
          backgroundImage: bg ? `url(${bg})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "#111827",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/25" />
        <div className="relative">
          <p className="text-[10px] tracking-widest font-bold" style={{ color: form.brand_color }}>
            BOLETO ELECTRÓNICO
          </p>
          <p className="text-base font-bold mt-1 leading-tight">Nombre del evento</p>
          <p className="text-xs mt-2 text-gray-200">📅 12/12/2026 · 20:00</p>
          <p className="text-xs mt-1 text-gray-200">📍 Estadio Central</p>
          <div className="mt-3 flex gap-4">
            <div>
              <p className="text-[9px] tracking-wider text-gray-300">ÁREA</p>
              <p className="text-xs font-bold">VIP</p>
            </div>
            <div>
              <p className="text-[9px] tracking-wider text-gray-300">ASIENTO</p>
              <p className="text-xs font-bold">Fila 3 · Silla 12</p>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full sm:w-40 shrink-0 bg-gray-50 border-t sm:border-t-0 sm:border-l border-dashed border-gray-300 flex flex-col items-center justify-center p-3">
        <div className="rounded-xl p-1.5" style={{ backgroundColor: form.brand_color }}>
          <div className="bg-white rounded-md p-1">
            <QRCodeSVG value="https://ticketve.com/boleto/preview" size={80} />
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mt-2 text-center">
          {form.footer_text || "Escaneá en el acceso"}
        </p>
        {form.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.logo_url} alt="Logo" className="mt-2 h-5 object-contain" />
        ) : null}
      </div>
    </div>
  );
}

export default function AdminBoletosPage() {
  const [templates, setTemplates] = useState<TicketTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TicketTemplateForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<TicketTemplate[]>("/admin/ticket-templates");
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .get<TicketTemplate[]>("/admin/ticket-templates")
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    // La primera plantilla se marca como predeterminada por defecto.
    setForm({ ...emptyForm, is_default: templates.length === 0 });
    setModalOpen(true);
  }

  function openEdit(t: TicketTemplate) {
    setForm({
      id: t.id,
      name: t.name,
      description: t.description || "",
      brand_color: t.brand_color || BRAND_DEFAULT,
      accent_color: t.accent_color || ACCENT_DEFAULT,
      text_color: t.text_color || "#ffffff",
      background_image_url: t.background_image_url || "",
      logo_url: t.logo_url || "",
      footer_text: t.footer_text || "",
      is_active: t.is_active,
      is_default: t.is_default,
    });
    setModalOpen(true);
  }

  function updateField<K extends keyof TicketTemplateForm>(key: K, value: TicketTemplateForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleUpload(file: File, field: "background_image_url" | "logo_url") {
    setUploading(true);
    try {
      const data = await api.upload<{ url: string }>("/admin/upload", file);
      updateField(field, data.url);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toastError("El nombre de la plantilla es obligatorio.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      brand_color: form.brand_color,
      accent_color: form.accent_color,
      text_color: form.text_color,
      background_image_url: form.background_image_url || null,
      logo_url: form.logo_url || null,
      footer_text: form.footer_text.trim() || null,
      is_active: form.is_active,
      is_default: form.is_default,
    };
    try {
      if (form.id) {
        await api.put(`/admin/ticket-templates/${form.id}`, payload);
      } else {
        await api.post("/admin/ticket-templates", payload);
      }
      setModalOpen(false);
      await load();
      toastSuccess(form.id ? "Plantilla actualizada." : "Plantilla creada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!(await confirmDialog({ message: `¿Eliminar la plantilla "${name}"?`, danger: true }))) return;
    try {
      await api.delete(`/admin/ticket-templates/${id}`);
      await load();
      toastSuccess("Plantilla eliminada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  if (loading) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Boletos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Diseña el boleto que reciben los compradores (correo con QR + PDF). Asigná el diseño a un
            evento desde la sección Eventos.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nueva plantilla
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState message="No hay diseños de boleto. Creá el primero." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {templates.map((t) => (
            <div
              key={t.id}
              className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
                t.is_active ? "border-gray-100" : "border-gray-200 opacity-70"
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="p-3 rounded-xl shrink-0"
                      style={{ backgroundColor: `${t.brand_color}22`, color: t.brand_color }}
                    >
                      <TicketIcon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate flex items-center gap-2">
                        {t.name}
                        {t.is_default && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-800">
                            <Star className="w-3 h-3" /> Predeterminada
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500 truncate">{t.description || "Sin descripción"}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEdit(t)} className="p-2 text-gray-500 hover:text-brand-600" aria-label="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id, t.name)}
                      className="p-2 text-gray-500 hover:text-red-600"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <TicketPreview
                    form={{
                      ...emptyForm,
                      background_image_url: t.background_image_url || "",
                      brand_color: t.brand_color,
                      logo_url: t.logo_url || "",
                      footer_text: t.footer_text || "",
                    }}
                  />
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: t.brand_color }} />
                    <span className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: t.accent_color }} />
                  </span>
                  <span
                    className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                      t.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.is_active ? "Activa" : "Inactiva"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? "Editar diseño de boleto" : "Nuevo diseño de boleto"}
        size="3xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nombre" value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Boleto estándar" />
            <Input
              label="Descripción"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="¿Para qué eventos? (opcional)"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorField label="Color de marca" value={form.brand_color} onChange={(v) => updateField("brand_color", v)} />
            <ColorField label="Color de acento" value={form.accent_color} onChange={(v) => updateField("accent_color", v)} />
            <ColorField label="Color de texto" value={form.text_color} onChange={(v) => updateField("text_color", v)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageField
              label="Imagen de fondo"
              hint="Arte de la mitad izquierda del boleto (si falta se usa la portada del evento)."
              value={form.background_image_url}
              uploading={uploading}
              onPick={(f) => handleUpload(f, "background_image_url")}
              onClear={() => updateField("background_image_url", "")}
            />
            <ImageField
              label="Logo (opcional)"
              hint="Logo mostrado junto al QR. Si falta se usa el logo del sitio."
              value={form.logo_url}
              uploading={uploading}
              onPick={(f) => handleUpload(f, "logo_url")}
              onClear={() => updateField("logo_url", "")}
            />
          </div>

          <Input
            label="Texto bajo el QR"
            value={form.footer_text}
            onChange={(e) => updateField("footer_text", e.target.value)}
            placeholder="Escaneá en el acceso"
          />

          <div className="rounded-xl border border-gray-200 p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-3">
              <Eye className="w-4 h-4 text-accent-600" /> Vista previa
            </p>
            <TicketPreview form={form} />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Toggle
              label="Plantilla activa"
              checked={form.is_active}
              onChange={(v) => updateField("is_active", v)}
            />
            <Toggle
              label="Usar por defecto"
              checked={form.is_default}
              onChange={(v) => updateField("is_default", v)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear plantilla"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer bg-white p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
    </div>
  );
}

function ImageField({
  label,
  hint,
  value,
  uploading,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  value: string;
  uploading: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <p className="text-xs text-gray-400 mb-2">{hint}</p>
      {value ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 h-24">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Quitar imagen"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-400 text-gray-400">
          <UploadCloud className="w-6 h-6 mb-1" />
          <span className="text-xs">{uploading ? "Subiendo..." : "Subir imagen"}</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onPick(file);
              e.target.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-colors relative ${checked ? "bg-brand-500" : "bg-gray-300"}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
