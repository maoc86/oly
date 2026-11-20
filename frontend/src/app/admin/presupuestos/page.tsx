"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Event } from "@/lib/types";
import { Button, EmptyState, Input, Modal, Select, Spinner } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { Plus, Pencil, Trash2, Calculator, TrendingUp, Wallet, Receipt, Landmark, Percent } from "lucide-react";

interface Quote {
  id: number;
  title: string;
  event_id: number | null;
  event_title: string | null;
  organizer_id: number | null;
  organizer_name: string | null;
  status: string;
  projected_price: number;
  projected_tickets: number;
  occupancy_percent: number;
  service_percent: number;
  municipal_percent: number;
  tax_percent: number;
  payment_surcharge_percent: number;
  discount_percent: number;
  additional_costs: any[] | null;
  notes: string | null;
  created_at: string | null;
}

interface QuoteListResponse {
  total: number;
  items: Quote[];
}

interface CostLine {
  label: string;
  quantity: number;
  unit_price: number;
  kind: string;
  category: string;
}

interface Breakdown {
  scenario: string;
  occupancy_percent: number;
  projected_tickets: number;
  sold_tickets: number;
  gross_revenue: number;
  base: number;
  service_fee: number;
  municipal_tax: number;
  tax: number;
  total_to_charge: number;
  payment_surcharge: number;
  discount: number;
  organizer_gross: number;
  platform_gross: number;
  organizer_tax: number;
  platform_tax: number;
  total_costs: number;
  platform_net: number;
  organizer_net: number;
  break_even_tickets: number;
  cost_per_ticket: number;
  cost_lines: { label: string; quantity: number; unit_cost: number; total: number; category: string | null }[];
}

const emptyForm = {
  title: "",
  event_id: "",
  organizer_id: "",
  projected_price: "",
  projected_tickets: "",
  occupancy_percent: "80",
  service_percent: "5",
  municipal_percent: "7",
  tax_percent: "16",
  payment_surcharge_percent: "0",
  discount_percent: "0",
  additional_costs: [] as CostLine[],
  notes: "",
  status: "draft",
};

function money(v: number) {
  return `$${Number(v || 0).toFixed(2)}`;
}

export default function AdminPresupuestosPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [scenarios, setScenarios] = useState<Breakdown[]>([]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<QuoteListResponse>("/admin/quotes?limit=200");
      setQuotes(data.items || []);
    } catch (e) {
      setQuotes([]);
      toastError(e instanceof Error ? e.message : "No se pudieron cargar los presupuestos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get<Event[]>("/admin/events").then(setEvents).catch(() => setEvents([]));
  }, []);

  function openCreate() {
    setForm({ ...emptyForm, additional_costs: [] });
    setBreakdown(null);
    setScenarios([]);
    setModalOpen(true);
  }

  function openEdit(q: Quote) {
    setForm({
      id: q.id,
      title: q.title,
      event_id: q.event_id ? String(q.event_id) : "",
      organizer_id: q.organizer_id ? String(q.organizer_id) : "",
      projected_price: String(q.projected_price),
      projected_tickets: String(q.projected_tickets),
      occupancy_percent: String(q.occupancy_percent),
      service_percent: String(q.service_percent),
      municipal_percent: String(q.municipal_percent),
      tax_percent: String(q.tax_percent),
      payment_surcharge_percent: String(q.payment_surcharge_percent),
      discount_percent: String(q.discount_percent),
      additional_costs: (q.additional_costs || []).map((c: any) => ({
        label: c.label || "",
        quantity: Number(c.quantity || 0),
        unit_price: Number(c.unit_price || 0),
        kind: c.kind || "cost",
        category: c.category || "Otros",
      })),
      notes: q.notes || "",
      status: q.status,
    });
    setBreakdown(null);
    setScenarios([]);
    setModalOpen(true);
  }

  function buildPayload() {
    return {
      title: form.title,
      event_id: form.event_id ? Number(form.event_id) : null,
      organizer_id: form.organizer_id ? Number(form.organizer_id) : null,
      projected_price: Number(form.projected_price || 0),
      projected_tickets: Number(form.projected_tickets || 0),
      occupancy_percent: Number(form.occupancy_percent || 100),
      service_percent: Number(form.service_percent || 0),
      municipal_percent: Number(form.municipal_percent || 0),
      tax_percent: Number(form.tax_percent || 0),
      payment_surcharge_percent: Number(form.payment_surcharge_percent || 0),
      discount_percent: Number(form.discount_percent || 0),
      additional_costs: form.additional_costs.map((c: CostLine) => ({
        label: c.label,
        quantity: c.quantity,
        unit_price: c.unit_price,
        kind: c.kind,
        category: c.category,
      })),
      notes: form.notes || null,
      status: form.status,
    };
  }

  async function calculateLive() {
    setCalculating(true);
    try {
      const payload = buildPayload();
      const req = {
        projected_price: payload.projected_price,
        projected_tickets: payload.projected_tickets,
        occupancy_percent: payload.occupancy_percent,
        service_percent: payload.service_percent,
        municipal_percent: payload.municipal_percent,
        tax_percent: payload.tax_percent,
        payment_surcharge_percent: payload.payment_surcharge_percent,
        discount_percent: payload.discount_percent,
        additional_costs: payload.additional_costs,
      };
      const b = await api.post<Breakdown>("/admin/quotes/calculate", req);
      setBreakdown(b);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al calcular");
    } finally {
      setCalculating(false);
    }
  }

  async function loadScenarios() {
    if (!form.id) {
      toastError("Guardá el presupuesto primero para ver escenarios.");
      return;
    }
    try {
      const data = await api.post<Breakdown[]>(`/admin/quotes/${form.id}/scenarios`, {});
      setScenarios(data);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al calcular escenarios");
    }
  }

  async function handleSubmit() {
    if (!form.title.trim()) {
      toastError("Ingresá un título para el presupuesto.");
      return;
    }
    setSaving(true);
    const payload = buildPayload();
    try {
      if (form.id) {
        await api.put(`/admin/quotes/${form.id}`, payload);
      } else {
        await api.post("/admin/quotes", payload);
      }
      setModalOpen(false);
      await load();
      toastSuccess(form.id ? "Presupuesto actualizado." : "Presupuesto creado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, title: string) {
    if (!(await confirmDialog({ message: `¿Eliminar el presupuesto "${title}"?`, danger: true }))) return;
    try {
      await api.delete(`/admin/quotes/${id}`);
      await load();
      toastSuccess("Presupuesto eliminado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  function addCostLine() {
    setForm((prev: any) => ({
      ...prev,
      additional_costs: [...prev.additional_costs, { label: "", quantity: 1, unit_price: 0, kind: "cost", category: "Otros" }],
    }));
  }

  function removeCostLine(idx: number) {
    setForm((prev: any) => ({
      ...prev,
      additional_costs: prev.additional_costs.filter((_: any, i: number) => i !== idx),
    }));
  }

  function updateCostLine(idx: number, field: string, value: any) {
    setForm((prev: any) => {
      const costs = [...prev.additional_costs];
      costs[idx] = { ...costs[idx], [field]: value };
      return { ...prev, additional_costs: costs };
    });
  }

  const totals = useMemo(() => {
    return quotes.reduce(
      (acc, q) => ({
        count: acc.count + 1,
        price: acc.price + (q.projected_price || 0),
      }),
      { count: 0, price: 0 }
    );
  }, [quotes]);

  if (loading) return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Cotizaciones para productores: proyección de venta, comisión, impuestos y costos adicionales.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nuevo presupuesto
        </Button>
      </div>

      {quotes.length === 0 ? (
        <EmptyState message="Todavía no hay presupuestos. Creá el primero para cotizar un evento." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Título</th>
                <th className="text-left px-4 py-3 font-medium">Evento</th>
                <th className="text-right px-4 py-3 font-medium">Precio boleto</th>
                <th className="text-right px-4 py-3 font-medium">Boletos</th>
                <th className="text-left px-4 py-3 font-medium">Estado</th>
                <th className="text-right px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 font-medium text-gray-900">{q.title}</td>
                  <td className="px-4 py-3 text-gray-600">{q.event_title || "—"}</td>
                  <td className="px-4 py-3 text-right">{money(q.projected_price)}</td>
                  <td className="px-4 py-3 text-right">{q.projected_tickets}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                      q.status === "accepted" ? "bg-emerald-100 text-emerald-800" :
                      q.status === "sent" ? "bg-blue-100 text-blue-800" :
                      q.status === "rejected" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(q)} className="p-2 text-gray-500 hover:text-brand-600" title="Editar">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(q.id, q.title)} className="p-2 text-gray-500 hover:text-red-600" title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Editar presupuesto" : "Nuevo presupuesto"} size="6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulario */}
          <div className="space-y-4">
            <Input label="Título" value={form.title} onChange={(e) => setForm((p: any) => ({ ...p, title: e.target.value }))} placeholder="Presupuesto Concierto X" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Evento (opcional)" value={form.event_id} onChange={(e) => setForm((p: any) => ({ ...p, event_id: e.target.value }))} options={events.map((ev) => ({ value: ev.id, label: ev.title }))} placeholder="Sin evento" />
              <Select label="Estado" value={form.status} onChange={(e) => setForm((p: any) => ({ ...p, status: e.target.value }))} placeholder={null} options={[
                { value: "draft", label: "Borrador" },
                { value: "sent", label: "Enviado" },
                { value: "accepted", label: "Aceptado" },
                { value: "rejected", label: "Rechazado" },
              ]} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Precio por boleto" type="number" min="0" step="0.01" value={form.projected_price} onChange={(e) => setForm((p: any) => ({ ...p, projected_price: e.target.value }))} />
              <Input label="Boletos proyectados" type="number" min="0" step="1" value={form.projected_tickets} onChange={(e) => setForm((p: any) => ({ ...p, projected_tickets: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Ocupación %" type="number" min="0" max="100" step="1" value={form.occupancy_percent} onChange={(e) => setForm((p: any) => ({ ...p, occupancy_percent: e.target.value }))} />
              <Input label="Comisión %" type="number" min="0" max="100" step="0.01" value={form.service_percent} onChange={(e) => setForm((p: any) => ({ ...p, service_percent: e.target.value }))} />
              <Input label="Municipal %" type="number" min="0" max="100" step="0.01" value={form.municipal_percent} onChange={(e) => setForm((p: any) => ({ ...p, municipal_percent: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="IVA %" type="number" min="0" max="100" step="0.01" value={form.tax_percent} onChange={(e) => setForm((p: any) => ({ ...p, tax_percent: e.target.value }))} />
              <Input label="Recargo tarjeta %" type="number" min="0" max="100" step="0.01" value={form.payment_surcharge_percent} onChange={(e) => setForm((p: any) => ({ ...p, payment_surcharge_percent: e.target.value }))} />
              <Input label="Descuento %" type="number" min="0" max="100" step="0.01" value={form.discount_percent} onChange={(e) => setForm((p: any) => ({ ...p, discount_percent: e.target.value }))} />
            </div>

            {/* Costos adicionales */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">Costos adicionales</p>
                <Button variant="secondary" onClick={addCostLine}>
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </Button>
              </div>
              <div className="space-y-2">
                {form.additional_costs.map((c: CostLine, idx: number) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <Input placeholder="Concepto (ej. Personal taquilla)" value={c.label} onChange={(e) => updateCostLine(idx, "label", e.target.value)} />
                    </div>
                    <div className="col-span-2">
                      <Input type="number" min="0" step="1" placeholder="Cant." value={c.quantity} onChange={(e) => updateCostLine(idx, "quantity", Number(e.target.value))} />
                    </div>
                    <div className="col-span-3">
                      <Input type="number" min="0" step="0.01" placeholder="Costo unit." value={c.unit_price} onChange={(e) => updateCostLine(idx, "unit_price", Number(e.target.value))} />
                    </div>
                    <div className="col-span-2 flex justify-end">
                      <button onClick={() => removeCostLine(idx)} className="p-2 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Input label="Notas" value={form.notes} onChange={(e) => setForm((p: any) => ({ ...p, notes: e.target.value }))} placeholder="Condiciones, observaciones..." />

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button onClick={calculateLive} disabled={calculating}>
                {calculating ? <Spinner size="sm" /> : <Calculator className="w-4 h-4" />} {calculating ? "Calculando..." : "Calcular"}
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Guardando..." : form.id ? "Guardar" : "Crear"}
              </Button>
            </div>
            {form.id && (
              <div className="flex justify-end">
                <Button variant="secondary" onClick={loadScenarios}>
                  <TrendingUp className="w-4 h-4" /> Ver escenarios (60/80/100%)
                </Button>
              </div>
            )}
          </div>

          {/* Resultado */}
          <div className="space-y-4">
            {!breakdown && !scenarios.length && (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-2xl p-8">
                Ingresá los datos y presioná "Calcular" para ver el desglose.
              </div>
            )}

            {breakdown && (
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
                  <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Receipt className="w-4 h-4" /> Desglose — {breakdown.scenario} ({breakdown.occupancy_percent}%)
                  </h3>
                  <div className="flex justify-between"><span className="text-gray-600">Boletos proyectados</span><span className="font-medium">{breakdown.projected_tickets}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Boletos vendidos (escenario)</span><span className="font-medium">{breakdown.sold_tickets}</span></div>
                  <div className="flex justify-between border-t border-gray-200 pt-2"><span className="text-gray-600">Vendido bruto</span><span className="font-medium">{money(breakdown.gross_revenue)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Precio base</span><span>{money(breakdown.base)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Cargo por servicio ({form.service_percent}%)</span><span>{money(breakdown.service_fee)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Impuesto municipal ({form.municipal_percent}%)</span><span>{money(breakdown.municipal_tax)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">IVA ({form.tax_percent}%)</span><span>{money(breakdown.tax)}</span></div>
                  {breakdown.payment_surcharge > 0 && <div className="flex justify-between"><span className="text-gray-600">Recargo tarjeta</span><span>{money(breakdown.payment_surcharge)}</span></div>}
                  {breakdown.discount > 0 && <div className="flex justify-between text-emerald-700"><span>Descuento</span><span>-{money(breakdown.discount)}</span></div>}
                  <div className="flex justify-between border-t border-gray-200 pt-2 font-semibold"><span>Total a cobrar</span><span>{money(breakdown.total_to_charge)}</span></div>
                </div>

                <div className="bg-emerald-50 rounded-2xl p-4 space-y-2 text-sm border border-emerald-100">
                  <h3 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Distribución de ingresos
                  </h3>
                  <div className="flex justify-between"><span className="text-emerald-800">Organizador recibe (bruto)</span><span className="font-medium">{money(breakdown.organizer_gross)}</span></div>
                  <div className="flex justify-between text-xs text-emerald-700"><span>Menos costos adicionales</span><span>-{money(breakdown.total_costs)}</span></div>
                  <div className="flex justify-between font-semibold"><span className="text-emerald-800">Organizador neto</span><span>{money(breakdown.organizer_net)}</span></div>
                  <div className="flex justify-between"><span className="text-emerald-800">Ticketera recibe</span><span className="font-medium">{money(breakdown.platform_gross)}</span></div>
                  <div className="flex justify-between text-xs text-emerald-700"><span>IVA organizador</span><span>{money(breakdown.organizer_tax)}</span></div>
                  <div className="flex justify-between text-xs text-emerald-700"><span>IVA ticketera</span><span>{money(breakdown.platform_tax)}</span></div>
                </div>

                {breakdown.cost_lines.length > 0 && (
                  <div className="bg-amber-50 rounded-2xl p-4 space-y-2 text-sm border border-amber-100">
                    <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                      <Landmark className="w-4 h-4" /> Costos adicionales (se deducen del organizador)
                    </h3>
                    {breakdown.cost_lines.map((c, i) => (
                      <div key={i} className="flex justify-between"><span className="text-amber-800">{c.label} ({c.quantity} × {money(c.unit_cost)})</span><span>{money(c.total)}</span></div>
                    ))}
                    <div className="flex justify-between border-t border-amber-200 pt-2 font-semibold"><span>Total costos</span><span>{money(breakdown.total_costs)}</span></div>
                  </div>
                )}

                <div className="bg-ink-950 text-white rounded-2xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-300">Margen neto ticketera (comisión + IVA + costos)</span><span className="font-bold text-brand-400">{money(breakdown.platform_net)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-300">A liquidar al organizador (neto)</span><span className="font-bold text-emerald-400">{money(breakdown.organizer_net)}</span></div>
                  <div className="flex justify-between text-xs text-gray-400"><span>Costo por boleto</span><span>{money(breakdown.cost_per_ticket)}</span></div>
                  <div className="flex justify-between text-xs text-gray-400"><span>Punto de equilibrio (organizador)</span><span>{breakdown.break_even_tickets} boletos</span></div>
                </div>
              </div>
            )}

            {scenarios.length > 0 && (
              <div className="bg-gray-50 rounded-2xl p-4 space-y-3 text-sm">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Escenarios
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500 border-b border-gray-200">
                        <th className="text-left py-2">Escenario</th>
                        <th className="text-right py-2">Boletos</th>
                        <th className="text-right py-2">Bruto</th>
                        <th className="text-right py-2">Ticketera</th>
                        <th className="text-right py-2">Margen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((sc, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-2 font-medium">{sc.scenario} ({sc.occupancy_percent}%)</td>
                          <td className="py-2 text-right">{sc.sold_tickets}</td>
                          <td className="py-2 text-right">{money(sc.gross_revenue)}</td>
                          <td className="py-2 text-right">{money(sc.platform_gross)}</td>
                          <td className="py-2 text-right font-bold text-emerald-600">{money(sc.platform_net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
