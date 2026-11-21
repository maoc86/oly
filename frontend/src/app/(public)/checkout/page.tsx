"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, CheckCircle2, ArrowLeft, Lock, Truck, ShieldCheck, RotateCcw, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { useCurrency, formatMoney } from "@/lib/currency";
import { useSiteConfig } from "@/lib/siteConfig";
import { paymentDataPoints } from "@/lib/paymentMethods";
import { PaymentMethod, ShippingMethod } from "@/lib/types";
import { toastError } from "@/lib/toast";
import { normalizeImageUrl } from "@/lib/images";

export default function CheckoutPage() {
  const { user, isAuthenticated, updateUser } = useAuth();
  const { cart, total, clearCart } = useCart();
  const { currency, bsRate, setCurrency } = useCurrency();
  const { config } = useSiteConfig();
  const router = useRouter();

  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [pmId, setPmId] = useState<number | null>(null);
  const [shippingId, setShippingId] = useState<number | null>(null);
  const [reference, setReference] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState<{ discount: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerCedula, setBuyerCedula] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
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

  // Precarga los datos del comprador desde el perfil.
  useEffect(() => {
    if (user) {
      setBuyerName(user.name || "");
      setBuyerCedula(user.cedula || "");
      setBuyerPhone(user.phone || "");
    }
  }, [user]);

  // La moneda de la compra sigue la del método de pago seleccionado.
  useEffect(() => {
    if (pm?.currency) {
      setCurrency(pm.currency === "VES" ? "VES" : "USD");
    }
  }, [pm, setCurrency]);

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
    setCouponLoading(true);
    setCouponMsg(null);
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
    } finally {
      setCouponLoading(false);
    }
  }

  async function handleReceipt(file: File) {
    setUploading(true);
    setError(null);
    try {
      const res = await api.upload<{ url: string }>("/orders/receipt", file);
      setReceiptUrl(res.url);
      if (file.type.startsWith("image/")) {
        setReceiptPreview(URL.createObjectURL(file));
      } else {
        setReceiptPreview(null);
      }
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
      // Si el comprador completó o modificó sus datos, los guardamos en su perfil.
      if (user && (buyerName.trim() !== (user.name || "") || buyerCedula.trim() !== (user.cedula || "") || buyerPhone.trim() !== (user.phone || ""))) {
        try {
          const updated = await api.patch<any>("/auth/me", {
            name: buyerName.trim() || user.name,
            cedula: buyerCedula.trim() || undefined,
            phone: buyerPhone.trim() || undefined,
          });
          if (updated) updateUser(updated);
        } catch {
          /* no bloqueamos la compra si falla la actualización del perfil */
        }
      }

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
      toastError(e instanceof Error ? e.message : "No se pudo crear la orden.");
      setSubmitting(false);
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-brand-50 text-brand-600 grid place-items-center">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="mt-6 text-xl font-bold text-gray-900">Iniciá sesión para comprar</h1>
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Link href="/carrito" className="p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Checkout</h1>
          <p className="text-gray-500 text-sm mt-0.5">Completá tus datos y elegí cómo pagar.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Formulario */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos del comprador */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
              <h2 className="font-semibold text-gray-900">Datos del comprador</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
                <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Tu nombre" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
                  <input value={buyerCedula} onChange={(e) => setBuyerCedula(e.target.value)} placeholder="V-12345678" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} placeholder="0412-0000000" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
                <input value={user?.email || ""} readOnly className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500" />
                <p className="text-xs text-gray-400 mt-1">El correo de tu cuenta. No se puede modificar aquí.</p>
              </div>
              {(buyerCedula || buyerPhone) && (buyerCedula !== (user?.cedula || "") || buyerPhone !== (user?.phone || "") || buyerName.trim() !== (user?.name || "")) && (
                <p className="text-xs text-brand-600">Se guardarán los datos actualizados en tu perfil.</p>
              )}
            </div>
          </section>

          {/* Envío */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Truck className="w-5 h-5 text-brand-600" />
              <h2 className="font-semibold text-gray-900">Envío y entrega</h2>
            </div>
            <div className="p-5 space-y-4">
              {shippingMethods.length > 0 && (
                <div className="grid gap-2">
                  {shippingMethods.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setShippingId(s.id)}
                      className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                        shippingId === s.id ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200" : "border-gray-200 hover:border-gray-300"
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
                      {s.estimated_days && <span className="text-xs text-gray-500 mt-0.5 block">{s.estimated_days}</span>}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle, número, apartamento" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ciudad" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  <input value={state} onChange={(e) => setState(e.target.value)} placeholder="Estado" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Código postal</label>
                  <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="0000" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              </div>
            </div>
          </section>

          {/* Pago */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-600" />
              <h2 className="font-semibold text-gray-900">Método de pago</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid gap-2">
                {methods.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPmId(m.id)}
                    className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                      pmId === m.id ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">{m.name}</span>
                      <span className="text-xs text-gray-500 uppercase">{m.currency}</span>
                    </span>
                    {pmId === m.id && paymentDataPoints(m).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-brand-200 space-y-0.5">
                        {paymentDataPoints(m).map((p) => (
                          <p key={p.label} className="text-sm text-gray-600">
                            <span className="font-medium">{p.label}:</span> {p.value}
                          </p>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {pm?.requires_reference && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referencia de pago</label>
                  <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Nº de operación" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              )}

              {pm?.requires_receipt && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Comprobante de pago</label>
                  {receiptUrl ? (
                    <div className="flex items-center gap-3">
                      {receiptPreview && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={receiptPreview} alt="Comprobante" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                      )}
                      <div className="flex items-center gap-2 text-emerald-600 text-sm">
                        <CheckCircle2 className="w-4 h-4" /> Comprobante subido
                      </div>
                      <button onClick={() => { setReceiptUrl(null); setReceiptPreview(null); }} className="text-xs text-gray-500 hover:text-red-600 underline">quitar</button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-600 hover:border-brand-400 cursor-pointer transition-colors">
                      <Upload className="w-4 h-4" />
                      {uploading ? "Subiendo…" : "Adjuntar comprobante (imagen o PDF)"}
                      <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleReceipt(e.target.files[0])} />
                    </label>
                  )}
                </div>
              )}

              {/* Cupón */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cupón de descuento</label>
                <div className="flex gap-2">
                  <input value={couponCode} onChange={(e) => setCouponCode(e.target.value)} placeholder="Código" className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <button
                    onClick={validateCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    {couponLoading ? "…" : "Aplicar"}
                  </button>
                </div>
                {couponMsg && <p className={`mt-1.5 text-sm ${coupon ? "text-emerald-600" : "text-red-500"}`}>{couponMsg}</p>}
              </div>
            </div>
          </section>
        </div>

        {/* Resumen */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 text-lg">Resumen</h2>
                <button
                  onClick={() => setCurrency(currency === "USD" ? "VES" : "USD")}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-700 transition-colors"
                >
                  {currency === "USD" ? "Ver en Bs." : "Ver en USD"}
                </button>
              </div>

              <div className="space-y-2.5 text-sm">
                {cart.lines.map((l) => (
                  <div key={l.variant_id} className="flex items-center gap-3">
                    <div className="w-10 h-12 rounded-md overflow-hidden bg-gray-100 flex-shrink-0">
                      {l.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={normalizeImageUrl(l.image)!} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-brand-200 text-xs font-black">O.</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-700 truncate text-xs">{l.name}</p>
                      <p className="text-gray-400 text-xs">{[l.size, l.color].filter(Boolean).join(" · ") || "Único"} × {l.quantity}</p>
                    </div>
                    <span className="text-gray-900 font-medium text-xs">{money(l.price * l.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 space-y-2 text-sm border-t pt-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{money(total)}</span>
                </div>
                {discount > 0 && <div className="flex justify-between text-emerald-600">
                  <span>Descuento</span>
                  <span>-{money(discount)}</span>
                </div>}
                <div className="flex justify-between text-gray-600">
                  <span>Impuestos ({config.tax_percent}%)</span>
                  <span>{money(tax)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Envío</span>
                  <span>{shippingCost === 0 ? "Gratis" : money(shippingCost)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold text-gray-900 pt-3 border-t">
                  <span>Total</span>
                  <span>{money(grandTotal)}</span>
                </div>
              </div>

              <label className="mt-5 flex items-start gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 w-4 h-4 rounded border-gray-300" />
                <span>
                  Acepto los{" "}
                  <Link href={config.terms_url || "/terminos"} className="text-brand-700 hover:underline font-medium">
                    términos y condiciones
                  </Link>
                </span>
              </label>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

              <button
                onClick={submit}
                disabled={submitting || cart.lines.length === 0}
                className="mt-5 w-full px-6 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 disabled:opacity-50 transition-colors shadow-sm hover:shadow-md"
              >
                {submitting ? "Procesando…" : "Confirmar pedido"}
              </button>

              <p className="mt-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Pago seguro
              </p>
            </div>

            {/* Trust signals */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex-shrink-0">
                  <Truck className="w-4 h-4" />
                </span>
                <span>Envío a toda Venezuela</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex-shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </span>
                <span>Pago seguro y verificado</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-600">
                <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex-shrink-0">
                  <RotateCcw className="w-4 h-4" />
                </span>
                <span>Cambios de talla en 7 días</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
