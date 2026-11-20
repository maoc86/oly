"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { FinanceBalances, FinanceEntry, FinanceSummary, PaymentMethod } from "@/lib/types";
import { Button, EmptyState, Input, Modal, Select } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { formatAmount, type Currency } from "@/lib/currency";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { Plus, TrendingUp, TrendingDown, Scale, RefreshCw, Pencil, Trash2, ArrowUpRight, ArrowDownRight, Wallet, Landmark } from "lucide-react";
import CuentasPorPagar from "./cuentas-por-pagar";

interface FormState {
  id: number | null;
  type: "income" | "expense";
  amount: string;
  currency: string;
  rate: string;
  category: string;
  description: string;
  date: string;
  payment_method_id: string;
}

const EMPTY_FORM: FormState = {
  id: null, type: "income", amount: "", currency: "USD", rate: "", category: "", description: "", date: "", payment_method_id: "",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminFinanzasPage() {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [balances, setBalances] = useState<FinanceBalances | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<{ income: string[]; expense: string[] }>({ income: [], expense: [] });
  const [activeRate, setActiveRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<"caja" | "cuentas">("caja");

  async function reload() {
    const [e, s, b] = await Promise.all([
      api.get<FinanceEntry[]>("/admin/finance/entries"),
      api.get<FinanceSummary>("/admin/finance/summary"),
      api.get<FinanceBalances>("/admin/finance/balances"),
    ]);
    setEntries(e);
    setSummary(s);
    setBalances(b);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<FinanceEntry[]>("/admin/finance/entries"),
      api.get<FinanceSummary>("/admin/finance/summary"),
      api.get<FinanceBalances>("/admin/finance/balances"),
      api.get<PaymentMethod[]>("/payment-methods"),
      api.get<{ income: string[]; expense: string[] }>("/admin/finance/categories").catch(() => ({ income: [], expense: [] })),
      api.get<{ active: { rate?: number } }>("/settings/exchange").then((r) => r.active?.rate ?? null).catch(() => null),
    ]).then(([e, s, b, m, c, rate]) => {
      if (cancelled) return;
      setEntries(e);
      setSummary(s);
      setBalances(b);
      setMethods(m);
      setCategories(c);
      if (rate != null) setActiveRate(rate);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (typeFilter && e.type !== typeFilter) return false;
      if (!q) return true;
      return (
        (e.category || "").toLowerCase().includes(q) ||
        (e.description || "").toLowerCase().includes(q) ||
        String(e.related_order_id ?? "").includes(q)
      );
    });
  }, [entries, typeFilter, search]);

  function openCreate() {
    setForm({ ...EMPTY_FORM, date: today(), rate: activeRate ? String(activeRate) : "" });
    setFormOpen(true);
  }

  function openEdit(e: FinanceEntry) {
    setForm({
      id: e.id,
      type: e.type,
      amount: String(e.amount),
      currency: e.currency,
      rate: e.rate != null ? String(e.rate) : "",
      category: e.category || "",
      description: e.description || "",
      date: e.date ? e.date.slice(0, 10) : today(),
      payment_method_id: e.payment_method_id != null ? String(e.payment_method_id) : "",
    });
    setFormOpen(true);
  }

  async function save() {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toastError("Ingresá un monto válido.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        amount,
        currency: form.currency,
        category: form.category || undefined,
        description: form.description || undefined,
        date: form.date ? new Date(form.date).toISOString() : undefined,
        rate: form.currency === "VES" && form.rate ? Number(form.rate) : undefined,
        payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : undefined,
      };
      if (form.id) {
        await api.put(`/admin/finance/entries/${form.id}`, payload);
      } else {
        await api.post("/admin/finance/entries", payload);
      }
      setFormOpen(false);
      await reload();
      toastSuccess(form.id ? "Movimiento actualizado." : "Movimiento registrado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(e: FinanceEntry) {
    if (!(await confirmDialog({ message: `¿Eliminar el movimiento "${e.description || e.category || e.id}"?`, danger: true }))) return;
    try {
      await api.delete(`/admin/finance/entries/${e.id}`);
      await reload();
      toastSuccess("Movimiento eliminado.");
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      const r = await api.post<{ created: number }>("/admin/finance/sync", {});
      await reload();
      toastSuccess(r.created > 0 ? `Se generaron ${r.created} ingresos faltantes.` : "No hay ventas pendientes de sincronizar.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  const catOptions = (form.type === "income" ? categories.income : categories.expense).map((c) => ({ value: c, label: c }));
  const methodOptions = [
    { value: "", label: "Sin cuenta (general)" },
    ...methods.map((m) => ({ value: String(m.id), label: `${m.name} (${m.currency})` })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tab === "caja" ? "Libro de caja: ingresos, egresos y saldo por cuenta." : "Cuentas por pagar: proveedores y acreedores."}
          </p>
        </div>
        {tab === "caja" && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={sync} disabled={syncing}>
              <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Sincronizar ventas
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> Nuevo movimiento
            </Button>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("caja")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "caja" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Libro de caja
        </button>
        <button
          onClick={() => setTab("cuentas")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 ${
            tab === "cuentas" ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <Landmark className="w-4 h-4" /> Cuentas por pagar
        </button>
      </div>

      {tab === "caja" ? (
        <>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-emerald-600">
            <TrendingUp className="w-4 h-4" />
            <p className="text-sm text-gray-500">Ingresos</p>
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatPrice(summary?.income ?? 0)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-red-600">
            <TrendingDown className="w-4 h-4" />
            <p className="text-sm text-gray-500">Egresos</p>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatPrice(summary?.expense ?? 0)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-brand-600">
            <Scale className="w-4 h-4" />
            <p className="text-sm text-gray-500">Balance general</p>
          </div>
          <p className="text-2xl font-bold text-brand-700 mt-1">{formatPrice(summary?.balance ?? 0)}</p>
        </div>
      </div>

      {/* Saldos por cuenta */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <Wallet className="w-5 h-5 text-brand-600" /> Saldos por cuenta
          </h2>
          <span className="text-sm text-gray-500">
            General: <span className="font-semibold text-gray-900">{formatPrice(balances?.general.balance_usd ?? 0)}</span>
          </span>
        </div>
        {balances && balances.accounts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {balances.accounts.map((a) => {
              const cur: Currency = a.currency === "VES" ? "VES" : "USD";
              const hasAccount = !!(a.bank_name || a.account_holder || a.account_number);
              return (
                <div key={a.payment_method_id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{a.name}</p>
                      {a.type && <p className="text-xs text-gray-400 uppercase">{a.type}</p>}
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {a.currency}
                    </span>
                  </div>

                  {hasAccount && (
                    <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                      {a.bank_name && <p>Banco: <span className="text-gray-700">{a.bank_name}</span></p>}
                      {a.account_holder && <p>Titular: <span className="text-gray-700">{a.account_holder}</span></p>}
                      {a.account_number && <p className="font-mono">Cuenta: <span className="text-gray-700">{a.account_number}</span></p>}
                    </div>
                  )}

                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <p className="text-lg font-bold text-brand-700">{formatAmount(a.balance, cur)}</p>
                    {(a.currency === "VES" || Math.abs(a.balance - a.balance_usd) > 0.01) && (
                      <p className="text-xs text-gray-400">≈ {formatPrice(a.balance_usd)}</p>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      <span>+{formatAmount(a.income, cur)}</span>
                      <span>-{formatAmount(a.expense, cur)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No hay cuentas configuradas.</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {[
            { value: "", label: "Todos" },
            { value: "income", label: "Ingresos" },
            { value: "expense", label: "Egresos" },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                typeFilter === f.value
                  ? "bg-brand-500 text-white border-brand-500"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex-1 sm:max-w-xs">
          <Input placeholder="Buscar…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <EmptyState message="No hay movimientos." />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-4">Movimiento</th>
                  <th className="text-left p-4">Categoría</th>
                  <th className="text-left p-4">Cuenta</th>
                  <th className="text-left p-4">Fecha</th>
                  <th className="text-right p-4">Monto</th>
                  <th className="text-right p-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const currency: Currency = e.currency === "VES" ? "VES" : "USD";
                  const method = methods.find((m) => m.id === e.payment_method_id);
                  return (
                    <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {e.type === "income" ? (
                            <ArrowUpRight className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-red-600 shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">
                              {e.description || "Movimiento sin descripción"}
                            </p>
                            <p className="text-xs text-gray-400">
                              {e.type === "income" ? "Ingreso" : "Egreso"}
                              {e.related_order_id ? ` · Orden #${e.related_order_id}` : ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600">{e.category || "—"}</td>
                      <td className="p-4 text-gray-600">{method ? method.name : "—"}</td>
                      <td className="p-4 text-gray-500">{formatDate(e.date)}</td>
                      <td className="p-4 text-right">
                        <p className="font-bold text-gray-900">{formatAmount(Number(e.amount), currency)}</p>
                        {currency === "VES" && (
                          <p className="text-xs text-gray-400">≈ {formatPrice(Number(e.amount_usd))}</p>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {e.related_order_id == null ? (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => openEdit(e)}
                              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => remove(e)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">Automático</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={form.id ? "Editar movimiento" : "Nuevo movimiento"} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: "income" })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                    form.type === "income" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-gray-600 border-gray-300"
                  }`}
                >
                  Ingreso
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: "expense" })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                    form.type === "expense" ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-600 border-gray-300"
                  }`}
                >
                  Egreso
                </button>
              </div>
            </div>
            <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Monto" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            <Select
              label="Moneda"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              options={[
                { value: "USD", label: "USD (Dólar)" },
                { value: "VES", label: "VES (Bolívares)" },
              ]}
            />
          </div>

          {form.currency === "VES" && (
            <Input
              label="Tasa (Bs/USD)"
              type="number"
              step="0.0001"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value })}
              placeholder={activeRate ? `Tasa activa: ${activeRate}` : "Tasa aplicada"}
            />
          )}

          <Select
            label="Cuenta / método de pago"
            value={form.payment_method_id}
            onChange={(e) => setForm({ ...form, payment_method_id: e.target.value })}
            options={methodOptions}
          />
          <Select
            label="Categoría"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            options={catOptions}
          />
          <Input label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

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
        </>
      ) : (
        <CuentasPorPagar />
      )}
    </div>
  );
}
