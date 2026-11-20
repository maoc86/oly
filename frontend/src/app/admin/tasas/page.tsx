"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw, TrendingDown, TrendingUp, Wallet, CheckCircle2, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";

interface Rate {
  moneda: string;
  fuente: "oficial" | "paralelo";
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number | null;
  fechaActualizacion: string;
}

interface ActiveConfig {
  kind: string;
  moneda?: string;
  fuente?: string;
  nombre?: string;
  value?: number;
  rate?: number | null;
  updated_at?: string | null;
}

interface ExchangeResponse {
  active: ActiveConfig;
  rates: { dolares: Rate[]; euros: Rate[] };
}

const formatter = new Intl.NumberFormat("es-VE", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

function formatRate(n: number | null): string {
  return n == null ? "—" : `Bs. ${formatter.format(n)}`;
}

function isActiveApi(active: ActiveConfig | null, moneda: string, fuente: string): boolean {
  return active?.kind === "api" && active.moneda === moneda && active.fuente === fuente;
}

function isActiveManual(active: ActiveConfig | null): boolean {
  return active?.kind === "manual";
}

export default function AdminTasasPage() {
  const [rates, setRates] = useState<Rate[]>([]);
  const [active, setActive] = useState<ActiveConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [manualValue, setManualValue] = useState("");

  async function load() {
    setError("");
    try {
      const data = await api.get<ExchangeResponse>("/settings/exchange");
      setRates([...(data.rates?.dolares ?? []), ...(data.rates?.euros ?? [])]);
      setActive(data.active);
    } catch {
      setError("No se pudieron obtener las cotizaciones. Verificá tu conexión y reintentá.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<ExchangeResponse>("/settings/exchange");
        if (!cancelled) {
          setRates([...(data.rates?.dolares ?? []), ...(data.rates?.euros ?? [])]);
          setActive(data.active);
        }
      } catch {
        if (!cancelled) setError("No se pudieron obtener las cotizaciones. Verificá tu conexión y reintentá.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function startLoad() {
    setLoading(true);
    await load();
    setLoading(false);
  }

  async function applyApi(rate: Rate) {
    setSaving(true);
    setError("");
    try {
      const data = await api.post<ActiveConfig>("/settings/exchange", {
        kind: "api",
        moneda: rate.moneda,
        fuente: rate.fuente,
      });
      setActive(data);
      setSavedMsg(`Tasa aplicada: ${rate.moneda} ${rate.fuente === "oficial" ? "Oficial" : "Paralelo"}`);
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la tasa");
    } finally {
      setSaving(false);
    }
  }

  async function applyManual() {
    const value = parseFloat(manualValue.replace(",", "."));
    if (Number.isNaN(value) || value <= 0) {
      setError("Ingresá un valor válido para la tasa manual.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = await api.post<ActiveConfig>("/settings/exchange", {
        kind: "manual",
        value,
      });
      setActive(data);
      setSavedMsg(`Tasa manual aplicada: Bs. ${formatter.format(value)}`);
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la tasa");
    } finally {
      setSaving(false);
    }
  }

  const activeLabel = active?.kind === "manual"
    ? `Tasa manual: Bs. ${formatter.format(active.value ?? 0)}`
    : active?.nombre
      ? active.nombre
      : "Sin tasa activa";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasas de cambio</h1>
          <p className="text-gray-500 text-sm mt-1">
            Elegí la tasa activa (de la API o manual) que se usa para los precios en el sitio público.
          </p>
          <p className="text-brand-700 font-medium text-sm mt-1">
            Tasa activa: {activeLabel}
          </p>
        </div>
        <Button onClick={startLoad} disabled={loading || saving}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </Button>
      </div>

      {savedMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {savedMsg}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      {/* Tasa manual */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="w-5 h-5 text-brand-600" />
          <h2 className="font-semibold text-gray-900">Tasa manual</h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Configurá un valor fijo de Bs. por USD si querés usar tu propia cotización.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-600">
            Valor (Bs. por USD)
            <input
              type="number"
              step="0.01"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              className="block mt-1 w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              placeholder="ej: 900.00"
            />
          </label>
          <Button
            onClick={applyManual}
            disabled={saving || loading}
            className={isActiveManual(active) ? "bg-emerald-600" : ""}
          >
            {isActiveManual(active) ? "Tasa manual activa" : "Aplicar tasa manual"}
          </Button>
        </div>
      </div>

      {/* Cotizaciones de la API */}
      <h2 className="font-semibold text-gray-900 mb-3">Cotizaciones de la API (DolarApi.com)</h2>

      {loading && rates.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : rates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {rates.map((rate) => {
            const isSelected = isActiveApi(active, rate.moneda, rate.fuente);
            const isDolar = rate.moneda === "USD";
            return (
              <div
                key={`${rate.moneda}-${rate.fuente}`}
                className={`bg-white rounded-2xl p-5 shadow-sm border ${
                  isSelected ? "border-brand-500 ring-2 ring-brand-200" : "border-gray-100"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-white ${
                        isDolar ? "bg-emerald-500" : "bg-blue-500"
                      }`}
                    >
                      <Wallet className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900">
                        {rate.moneda} {rate.fuente === "oficial" ? "Oficial" : "Paralelo"}
                      </p>
                      <p className="text-xs text-gray-400">{rate.nombre}</p>
                    </div>
                  </div>
                  {isDolar ? (
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-blue-500" />
                  )}
                </div>

                <p className="text-2xl font-bold text-gray-900 mb-1">{formatRate(rate.promedio)}</p>
                <div className="flex justify-between text-xs text-gray-500 mb-4">
                  <span>Compra: {formatRate(rate.compra)}</span>
                  <span>Venta: {formatRate(rate.venta)}</span>
                </div>

                <button
                  onClick={() => applyApi(rate)}
                  disabled={saving}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                    isSelected
                      ? "bg-brand-500 text-white cursor-default"
                      : "bg-gray-100 text-gray-700 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                  }`}
                >
                  {isSelected ? "Tasa aplicada" : "Aplicar esta tasa"}
                </button>

                <p className="mt-2 text-[10px] text-gray-400">
                  {rate.fechaActualizacion ? `Actualizado: ${new Date(rate.fechaActualizacion).toLocaleString("es-ES")}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="text-center py-20 text-gray-500">
            <p>No hay cotizaciones disponibles.</p>
            <button onClick={startLoad} className="mt-4 text-brand-600 hover:underline">
              Reintentar
            </button>
          </div>
        )
      )}
    </div>
  );
}