"use client";

import {
  createContext, useContext, useState, useEffect, useSyncExternalStore, ReactNode,
} from "react";
import { api } from "./api";

const CURRENCY_KEY = "ticketing:currency";
export type Currency = "USD" | "VES";

const currencyListeners = new Set<() => void>();

function subscribeCurrency(callback: () => void) {
  currencyListeners.add(callback);
  return () => {
    currencyListeners.delete(callback);
  };
}

function readStoredCurrency(): Currency {
  const saved = typeof window !== "undefined" ? localStorage.getItem(CURRENCY_KEY) : null;
  return saved === "VES" || saved === "USD" ? saved : "USD";
}

// El SSR no tiene localStorage: ambas partes arrancan en "USD" y el cliente
// adopta la preferencia guardada tras el hydration (patrón useSyncExternalStore).
let currencySnapshot: Currency = "USD";

if (typeof window !== "undefined") {
  currencySnapshot = readStoredCurrency();
}

function getCurrencySnapshot() {
  return currencySnapshot;
}

function getCurrencyServerSnapshot(): Currency {
  return "USD";
}

interface ExchangeActive {
  kind: string;
  moneda?: string;
  fuente?: string;
  nombre?: string;
  value?: number;
  rate?: number | null; // Bs. por 1 USD (el valor resuelto, tarde/activa)
  updated_at?: string | null;
}

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  bsRate: number | null;
  exchange: ExchangeActive | null;
  loading: boolean;
}

const Ctx = createContext<CurrencyContextType>({
  currency: "USD",
  setCurrency: () => {},
  bsRate: null,
  exchange: null,
  loading: true,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const currency = useSyncExternalStore(
    subscribeCurrency,
    getCurrencySnapshot,
    getCurrencyServerSnapshot
  );
  const [exchange, setExchange] = useState<ExchangeActive | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.get<{ active: ExchangeActive }>("/settings/exchange");
        if (!cancelled) setExchange(data.active);
      } catch {
        /* sin cotizaciones: quedamos en USD */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setCurrency(c: Currency) {
    // Evita notificar de más (y posibles bucles de render) si no cambia.
    if (c === currencySnapshot) return;
    localStorage.setItem(CURRENCY_KEY, c);
    currencySnapshot = c;
    currencyListeners.forEach((l) => l());
  }

  return (
    <Ctx.Provider value={{ currency, setCurrency, bsRate: exchange?.rate ?? null, exchange, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCurrency() {
  return useContext(Ctx);
}

/**
 * Formatea un importe que ya está en la moneda indicada (sin convertir).
 */
export function formatAmount(value: number, currency: Currency): string {
  if (currency === "VES") {
    return `Bs. ${value.toLocaleString("es-VE", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  }
  return `USD ${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/**
 * Formatea un importe (base USD) en la moneda indicada. Para VES convierte con
 * la tasa activa; si la tasa no está disponible se muestra USD para no engañar.
 */
export function formatMoney(usdAmount: number, currency: Currency, bsRate: number | null): string {
  if (currency === "VES" && bsRate != null && bsRate > 0) {
    return formatAmount(usdAmount * bsRate, "VES");
  }
  return formatAmount(usdAmount, "USD");
}

/**
 * Hook que devuelve un formateador de precios que respeta la moneda activa
 * (USD por defecto, o Bs. convertido con la tasa activa). El precio base es USD.
 */
export function usePriceFormatter() {
  const { currency, bsRate } = useCurrency();

  return function format(usdAmount: number): string {
    return formatMoney(usdAmount, currency, bsRate);
  };
}