"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PaymentMethod } from "@/lib/types";
import { Button, Input, TextArea, Modal, EmptyState, Select } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { Plus, Pencil, Trash2, CreditCard, Landmark, Receipt, Paperclip } from "lucide-react";

interface PaymentForm {
  id?: number;
  name: string;
  type: string;
  currency: string;
  requires_reference: boolean;
  requires_receipt: boolean;
  phone: string;
  email: string;
  cedula: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  account_note: string;
  is_active: boolean;
  available_at_taquilla: boolean;
  is_cash: boolean;
}

const emptyForm: PaymentForm = {
  name: "",
  type: "",
  currency: "USD",
  requires_reference: true,
  requires_receipt: false,
  phone: "",
  email: "",
  cedula: "",
  bank_name: "",
  account_holder: "",
  account_number: "",
  account_note: "",
  is_active: true,
  available_at_taquilla: false,
  is_cash: false,
};

const CURRENCIES = [
  { value: "USD", label: "USD (Dólar)" },
  { value: "VES", label: "VES (Bolívares)" },
];

const TYPES = [
  { value: "card", label: "Tarjeta" },
  { value: "wallet", label: "Pago móvil / billetera" },
  { value: "transfer", label: "Transferencia bancaria" },
  { value: "crypto", label: "Cripto (Binance, etc.)" },
  { value: "cash", label: "Efectivo" },
];

const TYPE_LABEL: Record<string, string> = {
  card: "Tarjeta",
  wallet: "Pago móvil / billetera",
  transfer: "Transferencia bancaria",
  crypto: "Cripto",
  cash: "Efectivo",
};

type StringKey = "phone" | "email" | "cedula" | "bank_name" | "account_holder" | "account_number";

interface FieldDef {
  key: StringKey;
  label: string;
  placeholder: string;
}

// Campos de pago que ve el comprador, según el tipo de método.
const TYPE_FIELDS: Record<string, FieldDef[]> = {
  card: [],
  wallet: [
    { key: "phone", label: "Número de teléfono", placeholder: "0412-1234567" },
    { key: "bank_name", label: "Banco", placeholder: "Banco de Venezuela" },
    { key: "cedula", label: "Cédula", placeholder: "V-12345678" },
  ],
  transfer: [
    { key: "bank_name", label: "Banco", placeholder: "Banco de Venezuela" },
    { key: "account_number", label: "Número de cuenta", placeholder: "0102 0000 0000 0000 0000" },
    { key: "account_holder", label: "Titular", placeholder: "Nombre del titular" },
    { key: "cedula", label: "Cédula", placeholder: "V-12345678" },
  ],
  crypto: [
    { key: "account_number", label: "ID", placeholder: "ID de Binance" },
    { key: "email", label: "Correo", placeholder: "correo@ejemplo.com" },
  ],
  cash: [],
};

const DATA_LABELS: Record<StringKey, string> = {
  phone: "Teléfono",
  email: "Correo",
  cedula: "Cédula",
  bank_name: "Banco",
  account_holder: "Titular",
  account_number: "Cuenta / ID",
};

export default function AdminPagosPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<PaymentMethod[]>("/admin/payment-methods")
      .then(setMethods)
      .catch(() => setMethods([]))
      .finally(() => setLoading(false));
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<PaymentMethod[]>("/admin/payment-methods");
      setMethods(data);
    } catch {
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(p: PaymentMethod) {
    setForm({
      id: p.id,
      name: p.name,
      type: p.type || "",
      currency: p.currency || "USD",
      requires_reference: p.requires_reference,
      requires_receipt: p.requires_receipt,
      phone: p.phone || "",
      email: p.email || "",
      cedula: p.cedula || "",
      bank_name: p.bank_name || "",
      account_holder: p.account_holder || "",
      account_number: p.account_number || "",
      account_note: p.account_note || "",
      is_active: p.is_active,
      available_at_taquilla: p.available_at_taquilla ?? false,
      is_cash: p.is_cash ?? false,
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toastError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type || undefined,
      currency: form.currency || "USD",
      requires_reference: form.requires_reference,
      requires_receipt: form.requires_receipt,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      cedula: form.cedula.trim() || undefined,
      bank_name: form.bank_name.trim() || undefined,
      account_holder: form.account_holder.trim() || undefined,
      account_number: form.account_number.trim() || undefined,
      account_note: form.account_note.trim() || undefined,
      is_active: form.is_active,
      available_at_taquilla: form.available_at_taquilla,
      is_cash: form.is_cash,
    };
    try {
      if (form.id) {
        await api.put(`/admin/payment-methods/${form.id}`, payload);
      } else {
        await api.post("/admin/payment-methods", payload);
      }
      setModalOpen(false);
      await load();
      toastSuccess(form.id ? "Método de pago actualizado." : "Método de pago creado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!(await confirmDialog({ message: `¿Eliminar el método de pago "${name}"?`, danger: true }))) return;
    try {
      await api.delete(`/admin/payment-methods/${id}`);
      await load();
      toastSuccess("Método de pago eliminado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  if (loading) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  const fields = TYPE_FIELDS[form.type] || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Métodos de Pago</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configura las formas de pago del checkout: moneda, referencia y los datos que ve el comprador.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nuevo método
        </Button>
      </div>

      {methods.length === 0 ? (
        <EmptyState message="No hay métodos de pago configurados." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {methods.map((p) => {
            const dataPoints = (Object.keys(DATA_LABELS) as StringKey[])
              .filter((k) => !!p[k])
              .map((k) => ({ label: DATA_LABELS[k], value: p[k] as string }));
            return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <CreditCard className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{p.name}</h3>
                      <p className="text-sm text-gray-500">
                        {TYPE_LABEL[p.type || ""] || p.type || "Sin tipo"}
                        <span className="text-gray-400"> · {p.currency}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(p)} className="p-2 text-gray-500 hover:text-brand-600">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id, p.name)} className="p-2 text-gray-500 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {dataPoints.length > 0 && (
                  <div className="mt-3 flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                    <Landmark className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-0.5">
                      {dataPoints.map((d) => (
                        <p key={d.label}>
                          <span className="text-gray-400">{d.label}:</span>{" "}
                          <span className="font-medium text-gray-900">{d.value}</span>
                        </p>
                      ))}
                      {p.account_note && <p className="text-gray-500 mt-1">{p.account_note}</p>}
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-sm text-gray-600">
                    <span className={`w-2.5 h-2.5 rounded-full ${p.is_active ? "bg-green-500" : "bg-red-400"}`} />
                    {p.is_active ? "Activo" : "Inactivo"}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Receipt className="w-3.5 h-3.5 text-gray-400" />
                    {p.requires_reference ? "Pide referencia" : "Sin referencia"}
                  </span>
                </div>

                <div className="mt-2">
                  <span className="flex items-center gap-1.5 text-sm text-gray-600">
                    <Paperclip className="w-3.5 h-3.5 text-gray-400" />
                    {p.requires_receipt ? "Pide comprobante" : "Sin comprobante"}
                  </span>
                </div>

                {(p.available_at_taquilla || p.is_cash) && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {p.available_at_taquilla && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-100 text-brand-800">
                        Taquilla
                      </span>
                    )}
                    {p.is_cash && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        Efectivo · cuadre de caja
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Editar método de pago" : "Nuevo método de pago"} size="2xl">
        <div className="space-y-4">
          <Input
            label="Nombre *"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Pago móvil, Transferencia, Binance..."
          />

          <div className="grid sm:grid-cols-2 gap-4">
            <Select
              label="Tipo"
              value={form.type}
              onChange={(e) => {
                const type = e.target.value;
                // Sugerimos el comprobante según el tipo: las tarjetas (pasarela)
                // no lo necesitan; el resto sí. El admin puede cambiarlo después.
                setForm((prev) => ({
                  ...prev,
                  type,
                  requires_receipt: type ? type !== "card" : prev.requires_receipt,
                }));
              }}
              options={TYPES}
            />
            <Select
              label="Moneda"
              value={form.currency}
              onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
              options={CURRENCIES}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.requires_reference}
              onChange={(e) => setForm((prev) => ({ ...prev, requires_reference: e.target.checked }))}
              className="w-4 h-4"
            />
            El comprador debe informar una referencia al pagar
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.requires_receipt}
              onChange={(e) => setForm((prev) => ({ ...prev, requires_receipt: e.target.checked }))}
              className="w-4 h-4"
            />
            El comprador debe adjuntar el comprobante de pago
          </label>

          {fields.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-900 mb-3">Datos de pago que ve el comprador</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {fields.map((f) => (
                  <Input
                    key={f.key}
                    label={f.label}
                    value={form[f.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <TextArea
              label="Nota / instrucciones"
              value={form.account_note}
              onChange={(e) => setForm((prev) => ({ ...prev, account_note: e.target.value }))}
              placeholder="Instrucciones para el comprador (opcional)"
              rows={2}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="w-4 h-4"
            />
            Activo
          </label>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900">Taquilla (venta presencial)</p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.available_at_taquilla}
                onChange={(e) => setForm((prev) => ({ ...prev, available_at_taquilla: e.target.checked }))}
                className="w-4 h-4"
              />
              Disponible para cobrar en el panel de taquilla
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_cash}
                onChange={(e) => setForm((prev) => ({ ...prev, is_cash: e.target.checked }))}
                className="w-4 h-4"
              />
              Es efectivo (cuenta para el cuadre de caja)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear método"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
