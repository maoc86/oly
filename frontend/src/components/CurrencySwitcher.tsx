"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw, ChevronDown, Check } from "lucide-react";
import { useCurrency } from "@/lib/currency";

const OPTIONS = [
  { value: "USD", label: "USD", sub: "Dólares" },
  { value: "VES", label: "Bs.", sub: "Bolívares" },
] as const;

export default function CurrencySwitcher({ variant = "light" }: { variant?: "light" | "dark" }) {
  const { currency, setCurrency, bsRate, loading } = useCurrency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = OPTIONS.find((o) => o.value === currency) ?? OPTIONS[0];
  const dark = variant === "dark";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          dark
            ? "text-gray-200 bg-white/5 hover:bg-white/10 border border-white/10"
            : "text-gray-700 bg-gray-100/80 hover:bg-gray-100 border border-gray-200"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          className={`absolute right-0 mt-2 w-48 rounded-xl shadow-xl z-50 py-1.5 overflow-hidden ${
            dark ? "bg-ink-950 border border-white/10" : "bg-white border border-gray-200"
          }`}
        >
          <p className={`px-3 py-1.5 text-[11px] uppercase tracking-wide ${dark ? "text-gray-500" : "text-gray-400"}`}>
            {bsRate != null ? `Tasa: Bs. ${bsRate.toFixed(2)}` : "Sin tasa activa"}
          </p>
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setCurrency(opt.value);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors ${
                currency === opt.value
                  ? dark
                    ? "bg-brand-600/20 text-white"
                    : "bg-brand-50 text-brand-800"
                  : dark
                    ? "text-gray-300 hover:bg-white/5"
                    : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="flex flex-col items-start">
                <span className="font-medium">{opt.label}</span>
                <span className={`text-[11px] ${dark ? "text-gray-500" : "text-gray-400"}`}>{opt.sub}</span>
              </span>
              {currency === opt.value && <Check className="w-4 h-4 text-brand-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
