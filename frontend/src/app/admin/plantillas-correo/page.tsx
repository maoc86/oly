"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { EmailTemplate } from "@/lib/types";
import { Button, Input, Modal, EmptyState } from "@/components/ui";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { Plus, Pencil, Trash2, Mail, Braces, Send } from "lucide-react";

const EMAIL_TEMPLATE_VARIABLES = [
  "nombre", "orden", "cantidad", "productos", "subtotal", "descuento", "impuesto",
  "envio", "total", "moneda", "metodo_pago", "referencia", "link", "plataforma", "soporte",
];

interface EmailTemplateForm {
  id?: number;
  key: string;
  name: string;
  subject: string;
  body: string;
  description: string;
  is_active: boolean;
}

const emptyForm: EmailTemplateForm = {
  key: "",
  name: "",
  subject: "",
  body: "",
  description: "",
  is_active: true,
};

function extractVariables(template: EmailTemplate): string[] {
  const found = [...new Set((template.subject + " " + template.body).match(/\{\{\s*\w+\s*\}\}/g) || [])];
  return found;
}

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EmailTemplateForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  useEffect(() => {
    api
      .get<EmailTemplate[]>("/admin/email-templates")
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<EmailTemplate[]>("/admin/email-templates");
      setTemplates(data);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(t: EmailTemplate) {
    setForm({
      id: t.id,
      key: t.key,
      name: t.name,
      subject: t.subject,
      body: t.body,
      description: t.description || "",
      is_active: t.is_active,
    });
    setModalOpen(true);
  }

  function updateField(key: keyof EmailTemplateForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    const payload = {
      key: form.key.trim(),
      name: form.name.trim(),
      subject: form.subject.trim(),
      body: form.body,
      description: form.description.trim() || undefined,
      is_active: form.is_active,
    };
    try {
      if (form.id) {
        await api.put(`/admin/email-templates/${form.id}`, payload);
      } else {
        await api.post("/admin/email-templates", payload);
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
      await api.delete(`/admin/email-templates/${id}`);
      await load();
      toastSuccess("Plantilla eliminada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  async function handleSendTest() {
    const to = testEmail.trim();
    if (!to) {
      toastError("Escribe un correo de destino para la prueba.");
      return;
    }
    setSendingTest(true);
    try {
      await api.post("/admin/email-templates/test", {
        to,
        subject: form.subject,
        body: form.body,
      });
      toastSuccess(`Correo de prueba enviado a ${to}.`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "No se pudo enviar la prueba");
    } finally {
      setSendingTest(false);
    }
  }

  if (loading) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plantillas de Correo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Crea y edita las plantillas que se enviarán por correo. Usa variables como{" "}
            <code className="text-accent-600 font-mono">{"{{nombre}}"}</code>,{" "}
            <code className="text-accent-600 font-mono">{"{{evento}}"}</code> o{" "}
            <code className="text-accent-600 font-mono">{"{{link}}"}</code>.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nueva plantilla
        </Button>
      </div>

      {templates.length === 0 ? (
        <EmptyState message="No hay plantillas de correo. Crea tu primera plantilla." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {templates.map((t) => {
            const vars = extractVariables(t);
            return (
              <div
                key={t.id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${
                  t.is_active ? "border-gray-100" : "border-gray-200 opacity-70"
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-3 bg-accent-100 rounded-xl shrink-0">
                        <Mail className="w-6 h-6 text-accent-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">{t.name}</h3>
                        <p className="text-sm text-gray-500 font-mono truncate">{t.key}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => openEdit(t)} className="p-2 text-gray-500 hover:text-brand-600">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        className="p-2 text-gray-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-gray-600 break-words">
                    <span className="text-gray-400">Asunto: </span>
                    {t.subject}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 line-clamp-2 break-words whitespace-pre-wrap">{t.body}</p>

                  {vars.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Braces className="w-4 h-4 text-accent-500" />
                      {vars.map((v, i) => (
                        <span key={i} className="px-2 py-0.5 text-xs font-mono bg-gray-100 text-gray-600 rounded-md">
                          {v}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        t.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {t.is_active ? "Activa" : "Inactiva"}
                    </span>
                    {t.description && <span className="text-xs text-gray-400 truncate">{t.description}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? "Editar plantilla" : "Nueva plantilla"}
        size="3xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Identificador"
              value={form.key}
              onChange={(e) => updateField("key", e.target.value.replace(/\s+/g, "_"))}
              placeholder="ticket_compra"
              disabled={!!form.id}
            />
            <Input label="Nombre" value={form.name} onChange={(e) => updateField("name", e.target.value)} />
          </div>
          <Input label="Asunto" value={form.subject} onChange={(e) => updateField("subject", e.target.value)} />
          <RichTextEditor
              label="Cuerpo del correo"
              value={form.body}
              onChange={(html) => updateField("body", html)}
              variables={EMAIL_TEMPLATE_VARIABLES}
            />
          <Input
            label="Descripción"
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="¿Cuándo se envía? (opcional)"
          />
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Plantilla activa</span>
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                form.is_active ? "bg-brand-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                  form.is_active ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
              <Send className="w-4 h-4 text-accent-600" /> Enviar prueba
            </p>
            <p className="mt-1 mb-3 text-xs text-gray-500">
              Envía el asunto y el cuerpo actuales (con variables de ejemplo) a un correo para
              previsualizarlos.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button
                variant="secondary"
                onClick={handleSendTest}
                disabled={sendingTest}
                className="justify-center"
              >
                <Send className="w-4 h-4" />
                {sendingTest ? "Enviando..." : "Enviar prueba"}
              </Button>
            </div>
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