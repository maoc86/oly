"use client";

import { useState, useRef, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { useCurrency } from "@/lib/currency";

const OPTIONS = [
  { value: "USD", label: "USD" },
  { value: "VES", label: "Bs." },
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
            ? "text-gray-300 bg-white/5 hover:bg-white/10"
            : "text-gray-700 bg-gray-100/80 hover:bg-gray-100"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
        {current.label}
      </button>
      {open && (
        <div
          className={`absolute right-0 mt-2 w-40 rounded-lg shadow-xl z-50 py-1 ${
            dark ? "bg-gray-900 border border-white/10" : "bg-white border border-gray-200 shadow-lg"
          }`}
        >
          <p className={`px-3 py-1.5 text-xs ${dark ? "text-gray-500" : "text-gray-400"}`}>
            {bsRate != null ? `Tasa activa: Bs. ${bsRate.toFixed(2)}` : "Sin tasa activa"}
          </p>
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setCurrency(opt.value);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                dark ? "hover:bg-white/5" : "hover:bg-brand-50"
              } ${
                currency === opt.value
                  ? dark
                    ? "text-white font-medium"
                    : "text-brand-800 font-medium"
                  : dark
                    ? "text-gray-300"
                    : "text-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}