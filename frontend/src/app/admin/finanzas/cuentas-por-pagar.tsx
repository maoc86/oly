"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PaymentMethod } from "@/lib/types";
import { Button, Input, Modal, Select } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { formatAmount, type Currency } from "@/lib/currency";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import {
  Plus, Landmark, Users, Wallet, ArrowDownRight, Trash2, Pencil,
  CalendarClock, HandCoins, Receipt,
} from "lucide-react";

interface Vendor {
  id: number;
  name: string;
  category?: string | null;
  phone?: string | null;
  email?: string | null;
  rif?: string | null;
  notes?: string | null;
  is_active: boolean;
}

interface Payable {
  id: number;
  vendor_id: number;
  vendor_name?: string | null;
  description?: string | null;
  amount: number;
  currency: string;
  rate?: number | null;
  amount_usd: number;
  due_date?: string | null;
  status: string;
}

interface Payout {
  id: number;
  vendor_id?: number | null;
  payee_name?: string | null;
  amount: number;
  currency: string;
  rate?: number | null;
  amount_usd: number;
  date: string;
  payment_method_id?: number | null;
  reference?: string | null;
  note?: string | null;
}

interface Payee {
  payee_type: string;
  payee_id: number;
  name: string;
  accrued: number;
  paid: number;
  pending: number;
}

interface PayeesResponse {
  payees: Payee[];
  totals: { accrued: number; paid: number; pending: number };
}

interface PayeeOptions {
  vendors: Vendor[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  cancelled: "Cancelada",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export default function CuentasPorPagar() {
  const [payees, setPayees] = useState<PayeesResponse | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [payables, setPayables] = useState<Payable[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [options, setOptions] = useState<PayeeOptions | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  // Modales
  const [vendorOpen, setVendorOpen] = useState(false);
  const [payableOpen, setPayableOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);

  // Formularios
  const [vendorForm, setVendorForm] = useState({ id: null as number | null, name: "", category: "", phone: "", email: "", rif: "", notes: "" });
  const [payableForm, setPayableForm] = useState({ vendor_id: "", description: "", amount: "", currency: "USD", due_date: "" });
  const [payoutForm, setPayoutForm] = useState({
    payee_type: "vendor" as "vendor",
    payee_id: "",
    amount: "",
    currency: "USD",
    rate: "",
    date: today(),
    payment_method_id: "",
    reference: "",
    note: "",
    payable_ids: [] as number[],
  });
  const [saving, setSaving] = useState(false);
  const [activeRate, setActiveRate] = useState<number | null>(null);
  const [payableFrom, setPayableFrom] = useState("");
  const [payableTo, setPayableTo] = useState("");

  async function reload() {
    const [p, v, pay, po, m] = await Promise.all([
      api.get<PayeesResponse>("/admin/finance/payees"),
      api.get<Vendor[]>("/admin/finance/vendors"),
      api.get<Payable[]>("/admin/finance/payables"),
      api.get<Payout[]>("/admin/finance/payouts"),
      api.get<PaymentMethod[]>("/payment-methods"),
    ]);
    setPayees(p);
    setVendors(v);
    setPayables(pay);
    setPayouts(po);
    setMethods(m);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<PayeesResponse>("/admin/finance/payees"),
      api.get<Vendor[]>("/admin/finance/vendors"),
      api.get<Payable[]>("/admin/finance/payables"),
      api.get<Payout[]>("/admin/finance/payouts"),
      api.get<PayeeOptions>("/admin/finance/payee-options"),
      api.get<PaymentMethod[]>("/payment-methods"),
      api.get<{ active: { rate?: number } }>("/settings/exchange").then((r) => r.active?.rate ?? null).catch(() => null),
    ]).then(([p, v, pay, po, opt, m, rate]) => {
      if (cancelled) return;
      setPayees(p);
      setVendors(v);
      setPayables(pay);
      setPayouts(po);
      setOptions(opt);
      setMethods(m);
      if (rate != null) setActiveRate(rate);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const vendorPending = useMemo(() => {
    const map: Record<number, { accrued: number; paid: number; pending: number }> = {};
    for (const p of payees?.payees ?? []) {
      if (p.payee_type === "vendor") map[p.payee_id] = { accrued: p.accrued, paid: p.paid, pending: p.pending };
    }
    return map;
  }, [payees]);

  const pendingPayablesByVendor = useMemo(() => {
    const map: Record<number, Payable[]> = {};
    for (const p of payables) {
      if (p.status !== "pending") continue;
      if (payableFrom) {
        const from = new Date(payableFrom);
        if (p.due_date && new Date(p.due_date) < from) continue;
      }
      if (payableTo) {
        const to = new Date(payableTo);
        to.setHours(23, 59, 59, 999);
        if (p.due_date && new Date(p.due_date) > to) continue;
      }
      (map[p.vendor_id] = map[p.vendor_id] || []).push(p);
    }
    return map;
  }, [payables, payableFrom, payableTo]);

  function openVendor(v?: Vendor) {
    setVendorForm(v ? { id: v.id, name: v.name, category: v.category || "", phone: v.phone || "", email: v.email || "", rif: v.rif || "", notes: v.notes || "" } : { id: null, name: "", category: "", phone: "", email: "", rif: "", notes: "" });
    setVendorOpen(true);
  }

  async function saveVendor() {
    if (!vendorForm.name.trim()) {
      toastError("El nombre es obligatorio.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: vendorForm.name.trim(),
        category: vendorForm.category.trim() || undefined,
        phone: vendorForm.phone.trim() || undefined,
        email: vendorForm.email.trim() || undefined,
        rif: vendorForm.rif.trim() || undefined,
        notes: vendorForm.notes.trim() || undefined,
        is_active: true,
      };
      if (vendorForm.id) await api.put(`/admin/finance/vendors/${vendorForm.id}`, payload);
      else await api.post("/admin/finance/vendors", payload);
      setVendorOpen(false);
      await reload();
      toastSuccess(vendorForm.id ? "Proveedor actualizado." : "Proveedor creado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVendor(v: Vendor) {
    if (!(await confirmDialog({ message: `¿Eliminar el proveedor "${v.name}"?`, danger: true }))) return;
    try {
      await api.delete(`/admin/finance/vendors/${v.id}`);
      await reload();
      toastSuccess("Proveedor eliminado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  function openPayable(vendorId?: number) {
    setPayableForm({ vendor_id: vendorId ? String(vendorId) : "", description: "", amount: "", currency: "USD", due_date: "" });
    setPayableOpen(true);
  }

  async function savePayable() {
    const amount = Number(payableForm.amount);
    if (!payableForm.vendor_id || !amount || amount <= 0) {
      toastError("Seleccioná el proveedor y un monto válido.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/admin/finance/payables", {
        vendor_id: Number(payableForm.vendor_id),
        description: payableForm.description.trim() || undefined,
        amount,
        currency: payableForm.currency,
        due_date: payableForm.due_date || undefined,
      });
      setPayableOpen(false);
      await reload();
      toastSuccess("Cuenta por pagar registrada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function settlePayable(p: Payable) {
    if (!(await confirmDialog({ message: `¿Marcar como pagada la cuenta "${p.description || p.vendor_name}"?` }))) return;
    try {
      await api.put(`/admin/finance/payables/${p.id}`, { vendor_id: p.vendor_id, amount: p.amount, currency: p.currency, due_date: p.due_date, status: "paid" });
      await reload();
      toastSuccess("Cuenta marcada como pagada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    }
  }

  function exportPayablesCsv() {
    const rows = payables.filter((p) => {
      if (payableFrom) {
        const from = new Date(payableFrom);
        if (p.due_date && new Date(p.due_date) < from) return false;
      }
      if (payableTo) {
        const to = new Date(payableTo);
        to.setHours(23, 59, 59, 999);
        if (p.due_date && new Date(p.due_date) > to) return false;
      }
      return true;
    });
    const header = ["ID", "Proveedor", "Descripción", "Monto", "Moneda", "USD", "Vencimiento", "Estado"];
    const lines = [header.join(",")];
    for (const p of rows) {
      const vendor = vendors.find((v) => v.id === p.vendor_id);
      lines.push([
        p.id,
        `"${(vendor?.name || "").replace(/"/g, '""')}"`,
        `"${(p.description || "").replace(/"/g, '""')}"`,
        p.amount,
        p.currency,
        p.amount_usd,
        p.due_date || "",
        p.status,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cuentas-por-pagar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function cancelPayable(p: Payable) {
    if (!(await confirmDialog({ message: `¿Cancelar la cuenta "${p.description || p.vendor_name}"?` }))) return;
    try {
      await api.put(`/admin/finance/payables/${p.id}`, { vendor_id: p.vendor_id, amount: p.amount, currency: p.currency, due_date: p.due_date, status: "cancelled" });
      await reload();
      toastSuccess("Cuenta cancelada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    }
  }

  function openPayout(payee?: Payee) {
    setPayoutForm({
      payee_type: payee ? (payee.payee_type as "vendor") : "vendor",
      payee_id: payee ? String(payee.payee_id) : "",
      amount: "",
      currency: "USD",
      rate: "",
      date: today(),
      payment_method_id: "",
      reference: "",
      note: "",
      payable_ids: [],
    });
    setPayoutOpen(true);
  }

  async function savePayout() {
    const amount = Number(payoutForm.amount);
    if (!payoutForm.payee_id || !amount || amount <= 0) {
      toastError("Seleccioná el acreedor y un monto válido.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        amount,
        currency: payoutForm.currency,
        date: payoutForm.date ? new Date(payoutForm.date).toISOString() : undefined,
        rate: payoutForm.currency === "VES" && payoutForm.rate ? Number(payoutForm.rate) : undefined,
        payment_method_id: payoutForm.payment_method_id ? Number(payoutForm.payment_method_id) : undefined,
        reference: payoutForm.reference.trim() || undefined,
        note: payoutForm.note.trim() || undefined,
      };
      payload.vendor_id = Number(payoutForm.payee_id);
      if (payoutForm.payable_ids.length) payload.payable_ids = payoutForm.payable_ids;
      await api.post("/admin/finance/payouts", payload);
      setPayoutOpen(false);
      await reload();
      toastSuccess("Pago registrado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al registrar el pago");
    } finally {
      setSaving(false);
    }
  }

  async function deletePayout(p: Payout) {
    if (!(await confirmDialog({ message: `¿Deshacer el pago a "${p.payee_name}"? (también se borra el egreso de caja)`, danger: true }))) return;
    try {
      await api.delete(`/admin/finance/payouts/${p.id}`);
      await reload();
      toastSuccess("Pago eliminado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  if (loading) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  const totals = payees?.totals ?? { accrued: 0, paid: 0, pending: 0 };
  const methodOptions = [{ value: "", label: "Sin cuenta (general)" }, ...methods.map((m) => ({ value: String(m.id), label: `${m.name} (${m.currency})` }))];
  const vendorOptions = options?.vendors ?? [];
  const payeeOptionsForType = vendorOptions.map((v) => ({ value: String(v.id), label: v.name }));

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-gray-500">
            <Landmark className="w-4 h-4" />
            <p className="text-sm">Adeudado total</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(totals.accrued)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-emerald-600">
            <HandCoins className="w-4 h-4" />
            <p className="text-sm text-gray-500">Pagado total</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatPrice(totals.paid)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-amber-600">
            <Wallet className="w-4 h-4" />
            <p className="text-sm text-gray-500">Pendiente</p>
          </div>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatPrice(totals.pending)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => openVendor()}>
          <Plus className="w-4 h-4" /> Nuevo proveedor
        </Button>
        <Button variant="secondary" onClick={() => openPayable()}>
          <Plus className="w-4 h-4" /> Nueva cuenta por pagar
        </Button>
        <Button onClick={() => openPayout()}>
          <HandCoins className="w-4 h-4" /> Registrar pago
        </Button>
        <Button variant="secondary" onClick={exportPayablesCsv}>
          Exportar CSV
        </Button>
      </div>

      {/* Filtro por fecha de vencimiento */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <span className="text-sm font-medium text-gray-700">Filtrar cuentas por vencimiento:</span>
        <input type="date" value={payableFrom} onChange={(e) => setPayableFrom(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" title="Desde" />
        <input type="date" value={payableTo} onChange={(e) => setPayableTo(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" title="Hasta" />
        {(payableFrom || payableTo) && (
          <button onClick={() => { setPayableFrom(""); setPayableTo(""); }} className="text-xs text-brand-700 hover:underline">Limpiar</button>
        )}
      </div>

      {/* Acreedores (cuentas por pagar) */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-600" />
          <h2 className="font-bold text-gray-900">Cuentas por pagar</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left p-4">Acreedor</th>
                <th className="text-left p-4">Tipo</th>
                <th className="text-right p-4">Adeudado</th>
                <th className="text-right p-4">Pagado</th>
                <th className="text-right p-4">Pendiente</th>
                <th className="text-right p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(payees?.payees ?? []).map((p) => (
                <tr key={`${p.payee_type}-${p.payee_id}`} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-900">{p.name}</td>
                  <td className="p-4">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      Proveedor
                    </span>
                  </td>
                  <td className="p-4 text-right text-gray-700">{formatPrice(p.accrued)}</td>
                  <td className="p-4 text-right text-emerald-600">{formatPrice(p.paid)}</td>
                  <td className="p-4 text-right font-bold text-amber-600">{formatPrice(p.pending)}</td>
                  <td className="p-4 text-right">
                    <Button variant="secondary" onClick={() => openPayout(p)}>
                      <HandCoins className="w-4 h-4" /> Pagar
                    </Button>
                  </td>
                </tr>
              ))}
              {(payees?.payees ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500 text-sm">
                    No hay acreedores todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Proveedores */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-brand-600" />
          <h2 className="font-bold text-gray-900">Proveedores</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left p-4">Nombre</th>
                <th className="text-left p-4">Categoría</th>
                <th className="text-right p-4">Pendiente</th>
                <th className="text-left p-4">Cuentas por pagar</th>
                <th className="text-right p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => {
                const pend = vendorPending[v.id] ?? { accrued: 0, paid: 0, pending: 0 };
                const pendingList = pendingPayablesByVendor[v.id] ?? [];
                return (
                  <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900">{v.name}</td>
                    <td className="p-4 text-gray-500">{v.category || "—"}</td>
                    <td className="p-4 text-right font-bold text-amber-600">{formatPrice(pend.pending)}</td>
                    <td className="p-4">
                      {pendingList.length === 0 ? (
                        <button onClick={() => openPayable(v.id)} className="text-xs text-brand-600 hover:underline">
                          + Cuenta por pagar
                        </button>
                      ) : (
                        <div className="space-y-1">
                          {pendingList.map((p) => (
                            <div key={p.id} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-600">
                                {p.description || "Cuenta"} · {formatAmount(p.amount, p.currency === "VES" ? "VES" : "USD")}
                                {p.due_date ? ` · vence ${fmtDate(p.due_date)}` : ""}
                              </span>
                              <button onClick={() => settlePayable(p)} className="text-emerald-600 hover:underline" title="Marcar pagada">
                                pagar
                              </button>
                              <button onClick={() => cancelPayable(p)} className="text-gray-400 hover:underline" title="Cancelar">
                                cancelar
                              </button>
                            </div>
                          ))}
                          <button onClick={() => openPayable(v.id)} className="text-xs text-brand-600 hover:underline">
                            + Agregar
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openVendor(v)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" title="Editar">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteVendor(v)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {vendors.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 text-sm">
                    No hay proveedores. Creá uno con "Nuevo proveedor".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historial de pagos */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-brand-600" />
          <h2 className="font-bold text-gray-900">Pagos realizados</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left p-4">Acreedor</th>
                <th className="text-left p-4">Fecha</th>
                <th className="text-left p-4">Referencia</th>
                <th className="text-right p-4">Monto</th>
                <th className="text-right p-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => {
                const cur: Currency = p.currency === "VES" ? "VES" : "USD";
                return (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <p className="font-medium text-gray-900">{p.payee_name || "—"}</p>
                      <p className="text-xs text-gray-400">Proveedor{p.note ? ` · ${p.note}` : ""}</p>
                    </td>
                    <td className="p-4 text-gray-500">{fmtDate(p.date)}</td>
                    <td className="p-4 text-gray-500">{p.reference || "—"}</td>
                    <td className="p-4 text-right">
                      <p className="font-bold text-gray-900">{formatAmount(p.amount, cur)}</p>
                      {cur === "VES" && <p className="text-xs text-gray-400">≈ {formatPrice(p.amount_usd)}</p>}
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => deletePayout(p)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Deshacer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 text-sm">
                    No hay pagos registrados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: proveedor */}
      <Modal open={vendorOpen} onClose={() => setVendorOpen(false)} title={vendorForm.id ? "Editar proveedor" : "Nuevo proveedor"} size="lg">
        <div className="space-y-4">
          <Input label="Nombre *" value={vendorForm.name} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })} placeholder="Papelería, Hosting, etc." />
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Categoría" value={vendorForm.category} onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })} placeholder="Papelería, Servidores..." />
            <Input label="RIF / Cédula" value={vendorForm.rif} onChange={(e) => setVendorForm({ ...vendorForm, rif: e.target.value })} />
            <Input label="Teléfono" value={vendorForm.phone} onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })} />
            <Input label="Email" value={vendorForm.email} onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })} />
          </div>
          <Input label="Notas" value={vendorForm.notes} onChange={(e) => setVendorForm({ ...vendorForm, notes: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setVendorOpen(false)}>Cancelar</Button>
            <Button onClick={saveVendor} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: cuenta por pagar */}
      <Modal open={payableOpen} onClose={() => setPayableOpen(false)} title="Nueva cuenta por pagar" size="lg">
        <div className="space-y-4">
          <Select
            label="Proveedor *"
            value={payableForm.vendor_id}
            onChange={(e) => setPayableForm({ ...payableForm, vendor_id: e.target.value })}
            options={vendorOptions.map((v) => ({ value: String(v.id), label: v.name }))}
          />
          <Input label="Descripción" value={payableForm.description} onChange={(e) => setPayableForm({ ...payableForm, description: e.target.value })} placeholder="Resma de papel, factura de hosting..." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Monto *" type="number" min="0" step="0.01" value={payableForm.amount} onChange={(e) => setPayableForm({ ...payableForm, amount: e.target.value })} />
            <Select label="Moneda" value={payableForm.currency} onChange={(e) => setPayableForm({ ...payableForm, currency: e.target.value })} options={[{ value: "USD", label: "USD" }, { value: "VES", label: "VES" }]} />
          </div>
          <Input label="Vencimiento" type="date" value={payableForm.due_date} onChange={(e) => setPayableForm({ ...payableForm, due_date: e.target.value })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPayableOpen(false)}>Cancelar</Button>
            <Button onClick={savePayable} disabled={saving}>{saving ? "Guardando..." : "Registrar"}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: registrar pago */}
      <Modal open={payoutOpen} onClose={() => setPayoutOpen(false)} title="Registrar pago" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acreedor</label>
            <p className="text-sm text-gray-500">El pago se registra a un proveedor.</p>
          </div>
          <Select label="Acreedor *" value={payoutForm.payee_id} onChange={(e) => setPayoutForm({ ...payoutForm, payee_id: e.target.value })} options={payeeOptionsForType} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Monto *" type="number" min="0" step="0.01" value={payoutForm.amount} onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })} />
            <Select label="Moneda" value={payoutForm.currency} onChange={(e) => setPayoutForm({ ...payoutForm, currency: e.target.value })} options={[{ value: "USD", label: "USD" }, { value: "VES", label: "VES" }]} />
          </div>
          {payoutForm.currency === "VES" && (
            <Input label="Tasa (Bs/USD)" type="number" step="0.0001" value={payoutForm.rate} onChange={(e) => setPayoutForm({ ...payoutForm, rate: e.target.value })} placeholder={activeRate ? `Tasa activa: ${activeRate}` : "Tasa aplicada"} />
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Fecha" type="date" value={payoutForm.date} onChange={(e) => setPayoutForm({ ...payoutForm, date: e.target.value })} />
            <Select label="Cuenta (opcional)" value={payoutForm.payment_method_id} onChange={(e) => setPayoutForm({ ...payoutForm, payment_method_id: e.target.value })} options={methodOptions} />
          </div>
          <Input label="Referencia" value={payoutForm.reference} onChange={(e) => setPayoutForm({ ...payoutForm, reference: e.target.value })} placeholder="N° de transferencia, etc." />
          <Input label="Nota" value={payoutForm.note} onChange={(e) => setPayoutForm({ ...payoutForm, note: e.target.value })} />

          {payoutForm.payee_id && (pendingPayablesByVendor[Number(payoutForm.payee_id)] ?? []).length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">Salda estas cuentas pendientes (opcional)</p>
              <div className="space-y-2 max-h-40 overflow-auto">
                {(pendingPayablesByVendor[Number(payoutForm.payee_id)] ?? []).map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={payoutForm.payable_ids.includes(p.id)}
                      onChange={(e) => {
                        setPayoutForm((prev) => ({
                          ...prev,
                          payable_ids: e.target.checked ? [...prev.payable_ids, p.id] : prev.payable_ids.filter((x) => x !== p.id),
                        }));
                      }}
                      className="w-4 h-4"
                    />
                    <span>{p.description || "Cuenta"} · {formatAmount(p.amount, p.currency === "VES" ? "VES" : "USD")}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPayoutOpen(false)}>Cancelar</Button>
            <Button onClick={savePayout} disabled={saving}>{saving ? "Guardando..." : "Registrar pago"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
