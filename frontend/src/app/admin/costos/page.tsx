"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { CostingAnalysisItem, CostingAnalysisResponse, CostingConfig, Product } from "@/lib/types";
import { Button, EmptyState, Input, Modal, Select } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import {
  Calculator, TrendingUp, TrendingDown, DollarSign, Package, Search,
  Save, Check, AlertTriangle, RefreshCw, Pencil,
} from "lucide-react";

interface ConfigForm {
  operational_expenses: string;
  fixed_expenses: string;
  estimated_monthly_units: string;
  profit_margin_percent: string;
  tax_rate_percent: string;
}

const EMPTY_CONFIG: ConfigForm = {
  operational_expenses: "0",
  fixed_expenses: "0",
  estimated_monthly_units: "1",
  profit_margin_percent: "40",
  tax_rate_percent: "16",
};

function roundTo(value: number, step: number): number {
  if (!step || step <= 0) return value;
  return Math.ceil(value / step) * step;
}

function fmt2(v: number): string {
  return v.toFixed(2);
}

export default function AdminCostosPage() {
  const [config, setConfig] = useState<CostingConfig | null>(null);
  const [form, setForm] = useState<ConfigForm>(EMPTY_CONFIG);
  const [analysis, setAnalysis] = useState<CostingAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [applying, setApplying] = useState<number | null>(null);
  const [roundStep, setRoundStep] = useState<string>("0.5");
  const [applyModal, setApplyModal] = useState<CostingAnalysisItem | null>(null);
  const [applyPrice, setApplyPrice] = useState("");

  async function loadAnalysis(cfg?: CostingConfig) {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    const q = params.toString() ? `?${params.toString()}` : "";
    const data = await api.get<CostingAnalysisResponse>(`/admin/costing/analysis${q}`);
    setAnalysis(data);
    if (cfg) setConfig(cfg);
    else if (data.config) setConfig(data.config);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<CostingConfig>("/admin/costing/config"),
      api.get<CostingAnalysisResponse>("/admin/costing/analysis"),
    ]).then(([cfg, data]) => {
      if (cancelled) return;
      setConfig(cfg);
      setForm({
        operational_expenses: String(cfg.operational_expenses ?? 0),
        fixed_expenses: String(cfg.fixed_expenses ?? 0),
        estimated_monthly_units: String(cfg.estimated_monthly_units ?? 1),
        profit_margin_percent: String(cfg.profit_margin_percent ?? 0),
        tax_rate_percent: String(cfg.tax_rate_percent ?? 0),
      });
      setAnalysis(data);
      setLoading(false);
    }).catch((e) => {
      if (cancelled) return;
      toastError(e instanceof Error ? e.message : "Error al cargar");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function saveConfig() {
    const op = Number(form.operational_expenses);
    const fx = Number(form.fixed_expenses);
    const units = Number(form.estimated_monthly_units);
    const margin = Number(form.profit_margin_percent);
    const tax = Number(form.tax_rate_percent);
    if (Number.isNaN(op) || op < 0) { toastError("Gastos operativos inválidos."); return; }
    if (Number.isNaN(fx) || fx < 0) { toastError("Gastos fijos inválidos."); return; }
    if (Number.isNaN(units) || units <= 0) { toastError("El volumen mensual debe ser mayor a 0."); return; }
    if (Number.isNaN(margin) || margin < 0) { toastError("Margen inválido."); return; }
    if (Number.isNaN(tax) || tax < 0) { toastError("Impuesto inválido."); return; }
    setSaving(true);
    try {
      const cfg = await api.put<CostingConfig>("/admin/costing/config", {
        operational_expenses: op,
        fixed_expenses: fx,
        estimated_monthly_units: Math.round(units),
        profit_margin_percent: margin,
        tax_rate_percent: tax,
      });
      setConfig(cfg);
      await loadAnalysis(cfg);
      toastSuccess("Configuración guardada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function doSearch() {
    try {
      await loadAnalysis(config ?? undefined);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al buscar");
    }
  }

  function openApply(item: CostingAnalysisItem) {
    const step = Number(roundStep);
    const rounded = step > 0 ? roundTo(item.suggested_price, step) : item.suggested_price;
    setApplyPrice(fmt2(rounded));
    setApplyModal(item);
  }

  async function applyPriceToProduct() {
    if (!applyModal) return;
    const price = Number(applyPrice);
    if (Number.isNaN(price) || price <= 0) { toastError("Precio inválido."); return; }
    const step = Number(roundStep);
    setApplying(applyModal.product_id);
    try {
      await api.post(`/admin/costing/apply/${applyModal.product_id}`, {
        price,
        round_to: step > 0 ? step : undefined,
      });
      toastSuccess(`Precio actualizado a ${formatPrice(price)}.`);
      setApplyModal(null);
      await loadAnalysis(config ?? undefined);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al aplicar");
    } finally {
      setApplying(null);
    }
  }

  const filteredItems = useMemo(() => {
    if (!analysis) return [];
    const q = search.trim().toLowerCase();
    if (!q) return analysis.items;
    return analysis.items.filter((it) =>
      it.name.toLowerCase().includes(q) ||
      (it.sku || "").toLowerCase().includes(q) ||
      (it.category || "").toLowerCase().includes(q)
    );
  }, [analysis, search]);

  if (loading) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  const items = filteredItems;
  const summary = analysis?.summary;
  const cfg = config;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Costos y precios de venta</h1>
          <p className="text-sm text-gray-500 mt-1">
            Calcula el costo de venta (precio sugerido) a partir del costo del producto, gastos operativos/fijos, margen e impuestos.
          </p>
        </div>
      </div>

      {/* Configuración */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-4">
          <Calculator className="w-5 h-5 text-brand-600" /> Configuración de costos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input
            label="Gastos operativos mensuales (USD)"
            type="number"
            min="0"
            step="0.01"
            value={form.operational_expenses}
            onChange={(e) => setForm({ ...form, operational_expenses: e.target.value })}
          />
          <Input
            label="Gastos fijos mensuales (USD)"
            type="number"
            min="0"
            step="0.01"
            value={form.fixed_expenses}
            onChange={(e) => setForm({ ...form, fixed_expenses: e.target.value })}
          />
          <Input
            label="Volumen estimado de ventas (unidades/mes)"
            type="number"
            min="1"
            step="1"
            value={form.estimated_monthly_units}
            onChange={(e) => setForm({ ...form, estimated_monthly_units: e.target.value })}
          />
          <Input
            label="Margen de ganancia (%)"
            type="number"
            min="0"
            step="0.5"
            value={form.profit_margin_percent}
            onChange={(e) => setForm({ ...form, profit_margin_percent: e.target.value })}
          />
          <Input
            label="Tasa de impuesto (%)"
            type="number"
            min="0"
            step="0.5"
            value={form.tax_rate_percent}
            onChange={(e) => setForm({ ...form, tax_rate_percent: e.target.value })}
          />
          <div className="flex items-end">
            <Button onClick={saveConfig} disabled={saving} className="w-full">
              <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar configuración"}
            </Button>
          </div>
        </div>
        {cfg && (
          <p className="text-xs text-gray-400 mt-3">
            Asignación por unidad: operativos {formatPrice(cfg.operational_expenses / Math.max(1, cfg.estimated_monthly_units))} · fijos {formatPrice(cfg.fixed_expenses / Math.max(1, cfg.estimated_monthly_units))}
          </p>
        )}
      </div>

      {/* Resumen */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">Productos analizados</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total_products}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">Con costo definido</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{summary.products_with_cost}</p>
            {summary.products_without_cost > 0 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {summary.products_without_cost} sin costo
              </p>
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">Costo total promedio</p>
            <p className="text-2xl font-bold text-brand-700 mt-1">{formatPrice(summary.avg_total_cost)}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <p className="text-sm text-gray-500">Margen promedio actual</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{summary.avg_margin_on_current_percent.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Búsqueda + redondeo */}
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 sm:max-w-xs">
          <Input
            placeholder="Buscar producto…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
          />
        </div>
        <Button variant="secondary" onClick={doSearch}>
          <Search className="w-4 h-4" /> Buscar
        </Button>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 whitespace-nowrap">Redondear a:</label>
          <Select
            value={roundStep}
            onChange={(e) => setRoundStep(e.target.value)}
            options={[
              { value: "0", label: "Sin redondeo" },
              { value: "0.5", label: "0.50" },
              { value: "1", label: "1.00" },
              { value: "5", label: "5.00" },
              { value: "10", label: "10.00" },
            ]}
          />
        </div>
        <Button variant="secondary" onClick={() => loadAnalysis(config ?? undefined)}>
          <RefreshCw className="w-4 h-4" /> Recargar
        </Button>
      </div>

      {/* Tabla */}
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
          <EmptyState message="No hay productos para analizar." />
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-3">Producto</th>
                  <th className="text-right p-3">Costo prod.</th>
                  <th className="text-right p-3">Op. (alloc)</th>
                  <th className="text-right p-3">Fijos (alloc)</th>
                  <th className="text-right p-3">Costo total</th>
                  <th className="text-right p-3">Margen</th>
                  <th className="text-right p-3">Impuesto</th>
                  <th className="text-right p-3">Precio sugerido</th>
                  <th className="text-right p-3">Precio actual</th>
                  <th className="text-right p-3">Diferencia</th>
                  <th className="text-center p-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const diffColor = it.difference > 0 ? "text-emerald-600" : it.difference < 0 ? "text-red-600" : "text-gray-400";
                  const step = Number(roundStep);
                  const displaySuggested = step > 0 ? roundTo(it.suggested_price, step) : it.suggested_price;
                  return (
                    <tr key={it.product_id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {it.image_url ? (
                            <img src={it.image_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Package className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate max-w-[160px]">{it.name}</p>
                            <p className="text-xs text-gray-400">
                              {it.sku ? `SKU: ${it.sku}` : ""}
                              {it.category ? ` · ${it.category}` : ""}
                            </p>
                            {!it.has_cost && (
                              <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Sin costo
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right text-gray-700">{formatPrice(it.product_cost)}</td>
                      <td className="p-3 text-right text-gray-500">{formatPrice(it.allocated_operational)}</td>
                      <td className="p-3 text-right text-gray-500">{formatPrice(it.allocated_fixed)}</td>
                      <td className="p-3 text-right font-semibold text-gray-900">{formatPrice(it.total_cost)}</td>
                      <td className="p-3 text-right text-gray-600">
                        <div>{formatPrice(it.margin_amount)}</div>
                        <div className="text-xs text-gray-400">{it.profit_margin_percent}%</div>
                      </td>
                      <td className="p-3 text-right text-gray-600">
                        <div>{formatPrice(it.tax_amount)}</div>
                        <div className="text-xs text-gray-400">{it.tax_rate_percent}%</div>
                      </td>
                      <td className="p-3 text-right font-bold text-brand-700">
                        {formatPrice(displaySuggested)}
                      </td>
                      <td className="p-3 text-right text-gray-700">{formatPrice(it.current_price)}</td>
                      <td className={`p-3 text-right font-semibold ${diffColor}`}>
                        {it.difference >= 0 ? "+" : ""}{formatPrice(it.difference)}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => openApply(it)}
                          disabled={applying === it.product_id}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
                          title="Asignar precio sugerido"
                        >
                          {applying === it.product_id ? "..." : "Asignar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal aplicar precio */}
      <Modal open={!!applyModal} onClose={() => setApplyModal(null)} title="Asignar precio de venta" size="lg">
        {applyModal && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Producto: <span className="font-semibold text-gray-900">{applyModal.name}</span>
            </p>
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Costo total:</span><span className="font-medium">{formatPrice(applyModal.total_cost)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Margen ({applyModal.profit_margin_percent}%):</span><span className="font-medium">{formatPrice(applyModal.margin_amount)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Impuesto ({applyModal.tax_rate_percent}%):</span><span className="font-medium">{formatPrice(applyModal.tax_amount)}</span></div>
              <div className="flex justify-between border-t border-gray-200 pt-1 mt-1"><span className="font-semibold text-gray-700">Precio sugerido:</span><span className="font-bold text-brand-700">{formatPrice(roundTo(applyModal.suggested_price, Number(roundStep)))}</span></div>
            </div>
            <Input
              label="Precio a asignar (USD)"
              type="number"
              min="0"
              step="0.01"
              value={applyPrice}
              onChange={(e) => setApplyPrice(e.target.value)}
            />
            <p className="text-xs text-gray-400">
              Puedes ajustar el precio antes de asignarlo. El redondeo ({roundStep === "0" ? "sin redondeo" : roundStep}) se aplicó automáticamente.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setApplyModal(null)}>Cancelar</Button>
              <Button onClick={applyPriceToProduct} disabled={applying === applyModal.product_id}>
                <Check className="w-4 h-4" /> {applying === applyModal.product_id ? "Aplicando..." : "Asignar precio"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
