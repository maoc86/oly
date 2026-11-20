"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useCurrency, formatMoney } from "@/lib/currency";
import { useSiteConfig } from "@/lib/siteConfig";
import { paymentDataPoints } from "@/lib/paymentMethods";
import { PaymentMethod, ShippingMethod } from "@/lib/types";

export default function CheckoutPage() {
  const { user, isAuthenticated } = useAuth();
  const { cart, total, clearCart } = useCart();
  const { currency, bsRate } = useCurrency();
  const { config } = useSiteConfig();
  const router = useRouter();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [pmId, setPmId] = useState<number | null>(null);
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    api.get<PaymentMethod[]>("/payment-methods").then(setMethods).catch(() => {});
    api.get<ShippingMethod[]>("/shipping-methods").then(setShippingMethods).catch(() => {});
  }, []);

  const pm = methods.find((m) => m.id === pmId) || null;
  const shippingMethod = shippingMethods.find((s) => s.id === shippingId) || null;

  const discount = coupon?.discount ?? 0;
  const taxable = Math.max(0, total - discount);
  const tax = Math.round(taxable * (config.tax_percent / 100) * 100) / 100;
  const shippingCost =
    shippingMethod && config.free_shipping_threshold > 0 && total >= config.free_shipping_threshold
      ? 0
      : Number(shippingMethod?.price ?? 0);
  const grandTotal = Math.round((taxable + tax + shippingCost) * 100) / 100;

  const money = (usd: number) => formatMoney(usd, currency, bsRate);

  async function validateCoupon() {
    if (!couponCode.trim()) return;
    try {
      const res = await api.post<{ valid: boolean; discount: number; message?: string }>("/coupons/validate", {
        code: couponCode,
        subtotal: total,
      });
      if (res.valid) {
        setCoupon({ discount: res.discount });
        setCouponMsg(res.message || `Descuento aplicado: -$${res.discount.toFixed(2)}`);
      }
    } catch (e) {
      setCoupon(null);
      setCouponMsg(e instanceof Error ? e.message : "Cupón inválido");
    }
  }

  async function handleReceipt(file: File) {
    setUploading(true);
    setError(null);
    try {
      const res = await api.upload<{ url: string }>("/orders/receipt", file);
      setReceiptUrl(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el comprobante");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    if (!isAuthenticated) {
      router.push("/login?redirect=/checkout");
      return;
    }
    if (!pm) {
      setError("Elegí un método de pago.");
      return;
    }
    if (pm.requires_reference && !reference.trim()) {
      setError("Este método de pago requiere una referencia.");
      return;
    }
    if (pm.requires_receipt && !receiptUrl) {
      setError("Este método de pago requiere adjuntar el comprobante.");
      return;
    }
    if (!terms) {
      setError("Debés aceptar los términos y condiciones.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/orders", {
        items: cart.lines.map((l) => ({ product_variant_id: l.variant_id, quantity: l.quantity })),
        payment_method_id: pm.id,
        reference: reference.trim() || undefined,
        receipt_url: receiptUrl || undefined,
        coupon_code: couponCode.trim() || undefined,
        terms_accepted: true,
        shipping_method_id: shippingId ?? undefined,
        shipping_address: address.trim() || undefined,
        shipping_city: city.trim() || undefined,
        shipping_state: state.trim() || undefined,
        shipping_zip: zip.trim() || undefined,
      });
      clearCart();
      router.push("/pedidos");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la orden.");
      setSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-gray-900">Iniciá sesión para comprar</h1>
        <p className="mt-2 text-gray-500">Necesitás una cuenta para finalizar tu compra.</p>
        <Link href="/login?redirect=/checkout" className="mt-6 inline-block px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-gray-900">No hay productos en tu carrito</h1>
        <Link href="/productos" className="mt-6 inline-block px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500">
          Ir a la tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Checkout</h1>

      <div className="mt-8 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Envío */}
          <section className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="font-semibold text-gray-900">Método de envío</h2>
            <div className="mt-3 grid gap-2">
              {shippingMethods.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setShippingId(s.id)}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                    shippingId === s.id ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{s.name}</span>
                    <span className="text-sm text-gray-600">
                      {config.free_shipping_threshold > 0 && total >= config.free_shipping_threshold
                        ? "Gratis"
                        : money(Number(s.price))}
                    </span>
                  </span>
                  {s.estimated_days && <span className="text-xs text-gray-500">{s.estimated_days}</span>}
                </button>
              ))}
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ciudad" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <input value={state} onChange={(e) => setState(e.target.value)} placeholder="Estado" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="Código postal" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </section>

          {/* Pago */}
          <section className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="font-semibold text-gray-900">Método de pago</h2>
            <div className="mt-3 grid gap-2">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setPmId(m.id)}
                  className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                    pmId === m.id ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{m.name}</span>
                    <span className="text-xs text-gray-500 uppercase">{m.currency}</span>
                  </span>
                  {pmId === m.id && (
                    <span className="block mt-2 space-y-1">
                      {paymentDataPoints(m).map((p) => (
                        <span key={p.label} className="block text-sm text-gray-600">
                          <span className="font-medium">{p.label}:</span> {p.value}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {pm?.requires_reference && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Referencia de pago</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Nº de operación" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            )}

            {pm?.requires_receipt && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Comprobante de pago</label>
                {receiptUrl ? (
                  <div className="flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Comprobante subido
                    <button onClick={() => setReceiptUrl(null)} className="text-gray-500 underline">quitar</button>
                  </div>
                ) : (
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:border-brand-400 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {uploading ? "Subiendo…" : "Adjuntar comprobante"}
                    <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleReceipt(e.target.files[0])} />
                  </label>
                )}
              </div>
            )}

            {/* Cupón */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cupón de descuento</label>
              <div className="flex gap-2">
                <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Código" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <button onClick={validateCoupon} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700">Aplicar</button>
              </div>
              {couponMsg && <p className={`mt-1 text-sm ${coupon ? "text-green-600" : "text-red-500"}`}>{couponMsg}</p>}
            </div>
          </section>
        </div>

        {/* Resumen */}
        <aside className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm h-fit">
          <h2 className="font-semibold text-gray-900">Resumen</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{money(total)}</span></div>
            {discount > 0 && <div className="flex justify-between text-green-600"><span>Descuento</span><span>-{money(discount)}</span></div>}
            <div className="flex justify-between"><span className="text-gray-600">Impuestos ({config.tax_percent}%)</span><span>{money(tax)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Envío</span><span>{shippingCost === 0 ? "Gratis" : money(shippingCost)}</span></div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-3 border-t"><span>Total</span><span>{money(grandTotal)}</span></div>
          </div>

          <label className="mt-5 flex items-start gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5" />
            Acepto los <Link href={config.terms_url || "/terminos"} className="text-brand-700 hover:underline">términos y condiciones</Link>
          </label>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting || cart.lines.length === 0}
            className="mt-5 w-full px-6 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Procesando…" : "Confirmar pedido"}
          </button>
        </aside>
      </div>
    </div>
  );
}
