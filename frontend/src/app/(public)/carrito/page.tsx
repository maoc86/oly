"use client";

import Link from "next/link";
import { ShoppingBag, Trash2, ArrowRight, Truck, ShieldCheck, RotateCcw, Minus, Plus } from "lucide-react";
import { useCart } from "@/lib/cart";
import { usePriceFormatter, useCurrency } from "@/lib/currency";
import { useSiteConfig } from "@/lib/siteConfig";
import { normalizeImageUrl } from "@/lib/images";

export default function CartPage() {
  const { cart, setQty, removeLine, itemsCount, total } = useCart();
  const format = usePriceFormatter();
  const { currency, setCurrency } = useCurrency();
  const { config } = useSiteConfig();

  const freeThreshold = Number(config.free_shipping_threshold || 0);
  const freeShipping = freeThreshold > 0 && total >= freeThreshold;
  const progress = freeThreshold > 0 ? Math.min(100, (total / freeThreshold) * 100) : 0;
  const remaining = freeThreshold > 0 ? Math.max(0, freeThreshold - total) : 0;

  // Estimación de impuestos (el backend calcula el definitivo en el checkout).
  const taxRate = Number(config.tax_percent || 0) / 100;
  const estimatedTax = Math.round(total * taxRate * 100) / 100;
  const estimatedTotal = total + estimatedTax;

  if (cart.lines.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 sm:py-28">
        <div className="max-w-md mx-auto text-center">
          <span className="inline-grid place-items-center w-20 h-20 rounded-3xl bg-brand-50 text-brand-600">
            <ShoppingBag className="w-9 h-9" />
          </span>
          <h1 className="mt-6 text-2xl sm:text-3xl font-bold text-gray-900">Tu carrito está vacío</h1>
          <p className="mt-3 text-gray-500">Agregá productos para empezar tu compra.</p>
          <Link
            href="/productos"
            className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 transition-colors shadow-sm"
          >
            Explorar tienda
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Tu carrito</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {itemsCount} artículo{itemsCount === 1 ? "" : "s"} · Precios en {currency}
          </p>
        </div>
        <Link href="/productos" className="text-sm font-medium text-brand-700 hover:text-brand-600 flex items-center gap-1">
          Seguir comprando <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          {cart.lines.map((l) => (
            <div key={l.variant_id} className="group flex gap-4 sm:gap-5 p-4 sm:p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <Link href={`/producto/${l.variant_id}`} className="w-24 h-30 sm:w-28 sm:h-36 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                {l.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={normalizeImageUrl(l.image)!} alt={l.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-brand-200 text-3xl font-black">O.</div>
                )}
              </Link>
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/producto/${l.variant_id}`} className="font-semibold text-gray-900 hover:text-brand-700 transition-colors line-clamp-2">
                      {l.name}
                    </Link>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {[l.size, l.color].filter(Boolean).join(" · ") || "Único"}
                    </p>
                  </div>
                  <button
                    onClick={() => removeLine(l.variant_id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                  <div className="inline-flex items-center border border-gray-300 rounded-xl overflow-hidden">
                    <button onClick={() => setQty(l.variant_id, l.quantity - 1)} className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 py-1.5 text-sm font-semibold min-w-10 text-center">{l.quantity}</span>
                    <button onClick={() => setQty(l.variant_id, l.quantity + 1)} className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">{format(l.price)} c/u</p>
                    <p className="font-bold text-gray-900">{format(l.price * l.quantity)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Free shipping progress */}
          {freeThreshold > 0 && (
            <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
              {freeShipping ? (
                <p className="text-sm font-medium text-emerald-600 flex items-center gap-2">
                  <Truck className="w-4 h-4" /> ¡Tienes envío gratis!
                </p>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Te faltan <span className="font-semibold text-gray-900">{format(remaining)}</span> para envío gratis.
                  </p>
                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Summary */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 text-lg">Resumen del pedido</h2>
                <button
                  onClick={() => setCurrency(currency === "USD" ? "VES" : "USD")}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-700 transition-colors"
                >
                  {currency === "USD" ? "Ver en Bs." : "Ver en USD"}
                </button>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({itemsCount} artículo{itemsCount === 1 ? "" : "s"})</span>
                  <span>{format(total)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Impuestos estimados ({config.tax_percent}%)</span>
                  <span>{format(estimatedTax)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Envío</span>
                  <span>{freeShipping ? "Gratis" : "A calcular"}</span>
                </div>
                <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t">
                  <span>Total estimado</span>
                  <span>{format(estimatedTotal)}</span>
                </div>
              </div>

              <Link
                href="/checkout"
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 transition-colors shadow-sm hover:shadow-md"
              >
                Finalizar compra
                <ArrowRight className="w-4 h-4" />
              </Link>

              <p className="mt-3 text-xs text-gray-400 text-center">
                El total final se calcula en el checkout (impuestos y envío exactos).
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
                <span>Pago seguro</span>
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
