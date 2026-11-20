"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ShoppingCart, Plus, Minus, Trash2, Wallet } from "lucide-react";
import { api } from "@/lib/api";
import { PosProduct, PaymentMethod, CashSession, ProductVariant } from "@/lib/types";
import { useCurrency } from "@/lib/currency";
import { useSiteConfig } from "@/lib/siteConfig";
import { toastError, toastSuccess } from "@/lib/toast";

interface Line {
  variant: ProductVariant;
  product: PosProduct;
  quantity: number;
}

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

function ves(n: number): string {
  return `Bs. ${n.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PosPage() {
  const { config } = useSiteConfig();
  const { bsRate } = useCurrency();

  const [catalog, setCatalog] = useState<PosProduct[]>([]);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [session, setSession] = useState<CashSession | null>(null);
  const [search, setSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pmId, setPmId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerCedula, setBuyerCedula] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [received, setReceived] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCatalog = useCallback(() => {
    api.get<{ products: PosProduct[] }>("/pos/products").then((d) => setCatalog(d.products)).catch(() => {});
  }, []);

  useEffect(() => {
    loadCatalog();
    api.get<PaymentMethod[]>("/pos/payment-methods").then(setMethods).catch(() => {});
    api.get<CashSession | null>("/pos/cash/current").then(setSession).catch(() => {});
  }, [loadCatalog]);

  const filtered = useMemo(() => {
    if (!search.trim()) return catalog;
    const t = search.toLowerCase();
    return catalog.filter(
      (p) =>
        p.name.toLowerCase().includes(t) ||
        (p.sku || "").toLowerCase().includes(t) ||
        p.variants.some((v) => (v.sku || "").toLowerCase().includes(t))
    );
  }, [catalog, search]);

  const selectedMethod = methods.find((m) => m.id === pmId) || null;

  const subtotal = lines.reduce(
    (s, l) => s + Number(l.variant.price_override ?? l.product.display_price) * l.quantity,
    0
  );
  const tax = Math.round(subtotal * (Number(config.tax_percent || 0) / 100) * 100) / 100;
  const totalUsd = Math.round((subtotal + tax) * 100) / 100;

  // Importe a cobrar según la moneda del método de pago.
  const chargeCurrency = selectedMethod?.currency || "USD";
  const chargeAmount = chargeCurrency === "VES" ? totalUsd * (bsRate ?? 0) : totalUsd;

  const change =
    selectedMethod?.is_cash && received !== ""
      ? Number(received) - chargeAmount
      : null;

  function addVariant(p: PosProduct, v: ProductVariant) {
    setLines((prev) => {
      const existing = prev.find((l) => l.variant.id === v.id);
      if (existing) {
        if (existing.quantity >= v.stock) return prev;
        return prev.map((l) => (l.variant.id === v.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { variant: v, product: p, quantity: 1 }];
    });
  }

  function setQty(variantId: number, qty: number) {
    setLines((prev) => {
      if (qty <= 0) return prev.filter((l) => l.variant.id !== variantId);
      return prev.map((l) => {
        if (l.variant.id !== variantId) return l;
        const capped = Math.min(qty, l.variant.stock);
        return { ...l, quantity: capped };
      });
    });
  }

  function resetSale() {
    setLines([]);
    setReference("");
    setBuyerName("");
    setBuyerCedula("");
    setBuyerPhone("");
    setBuyerEmail("");
    setReceived("");
    setPmId(null);
  }

  async function submitSale() {
    if (lines.length === 0) {
      toastError("Agregá productos a la venta.");
      return;
    }
    if (!pmId) {
      toastError("Elegí un método de pago.");
      return;
    }
    setSaving(true);
    try {
      const order = await api.post<{ id: number }>("/pos/sales", {
        items: lines.map((l) => ({ product_variant_id: l.variant.id, quantity: l.quantity })),
        payment_method_id: pmId,
        reference: reference || undefined,
        buyer: {
          name: buyerName || undefined,
          cedula: buyerCedula || undefined,
          phone: buyerPhone || undefined,
          email: buyerEmail || undefined,
        },
        send_email: false,
      });
      toastSuccess(`Venta registrada (pedido #${order.id}).`);
      resetSale();
      // Refresca el stock del catálogo y el resumen de caja.
      loadCatalog();
      const s = await api.get<CashSession | null>("/pos/cash/current");
      setSession(s);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al registrar la venta");
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <Wallet className="w-10 h-10 text-gray-400 mx-auto" />
        <h1 className="mt-4 text-lg font-bold text-gray-900">No tenés la caja abierta</h1>
        <p className="mt-2 text-sm text-gray-500">Abrí la caja para empezar a vender en el POS.</p>
        <Link href="/pos/caja" className="mt-5 inline-block px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500">
          Abrir caja
        </Link>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Catálogo */}
      <div className="lg:col-span-2">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto o SKU…" className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto pr-1">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-3">
              <p className="font-medium text-gray-900 text-sm truncate">{p.name}</p>
              <p className="text-xs text-gray-400">{p.sku || "—"}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.variants.filter((v) => v.stock > 0).map((v) => (
                  <button
                    key={v.id}
                    onClick={() => addVariant(p, v)}
                    className="px-2 py-1 rounded-lg text-xs font-medium bg-brand-50 text-brand-700 hover:bg-brand-100"
                    title={`stock ${v.stock}`}
                  >
                    {v.size || "Único"}{v.color ? ` · ${v.color}` : ""}
                  </button>
                ))}
              </div>
              {p.variants.every((v) => v.stock <= 0) && <p className="mt-2 text-xs text-red-500">Agotado</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Carrito */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-fit">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> Venta actual</h2>

        <div className="mt-3 space-y-2 max-h-[32vh] overflow-y-auto">
          {lines.length === 0 ? (
            <p className="text-sm text-gray-400">Sin productos.</p>
          ) : (
            lines.map((l) => (
              <div key={l.variant.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 text-sm">
                <div className="min-w-0">
                  <p className="text-gray-900 truncate">{l.product.name}</p>
                  <p className="text-xs text-gray-400">
                    {l.variant.size || "Único"}{l.variant.color ? ` · ${l.variant.color}` : ""} · {usd(Number(l.variant.price_override ?? l.product.display_price))}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setQty(l.variant.id, l.quantity - 1)} className="p-1 text-gray-500 hover:bg-gray-100 rounded"><Minus className="w-3.5 h-3.5" /></button>
                  <span className="min-w-6 text-center font-medium">{l.quantity}</span>
                  <button
                    onClick={() => setQty(l.variant.id, l.quantity + 1)}
                    disabled={l.quantity >= l.variant.stock}
                    className="p-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30"
                  ><Plus className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setQty(l.variant.id, 0)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totales */}
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{usd(subtotal)}</span></div>
          <div className="flex justify-between text-gray-600"><span>IVA ({Number(config.tax_percent || 0)}%)</span><span>{usd(tax)}</span></div>
          <div className="flex justify-between text-lg font-bold text-gray-900">
            <span>Total</span>
            <span>{chargeCurrency === "VES" ? ves(chargeAmount) : usd(chargeAmount)}</span>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Método de pago</label>
          <select value={pmId ?? ""} onChange={(e) => { setPmId(e.target.value ? Number(e.target.value) : null); setReceived(""); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">Elegir…</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.currency})</option>)}
          </select>
        </div>

        {selectedMethod?.is_cash && (
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto recibido ({chargeCurrency})</label>
            <input type="number" min="0" step="0.01" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="0.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            {change != null && (
              <p className={`mt-1 text-sm font-semibold ${change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                Vuelto: {chargeCurrency === "VES" ? ves(change) : usd(change)}
              </p>
            )}
          </div>
        )}

        {selectedMethod && selectedMethod.requires_reference && (
          <div className="mt-3">
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Referencia (opcional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        )}

        <div className="mt-3">
          <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Nombre del cliente (opcional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input value={buyerCedula} onChange={(e) => setBuyerCedula(e.target.value)} placeholder="Cédula" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="Teléfono" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="mt-2">
          <input value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} placeholder="Correo (opcional)" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>

        <button onClick={submitSale} disabled={saving || lines.length === 0} className="mt-5 w-full px-6 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 disabled:opacity-50">
          {saving ? "Registrando…" : "Cobrar y registrar venta"}
        </button>
      </div>
    </div>
  );
}
