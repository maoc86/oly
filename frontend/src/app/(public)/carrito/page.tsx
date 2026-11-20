"use client";

import Link from "next/link";
import { ShoppingBag, Trash2, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { usePriceFormatter } from "@/lib/currency";
import { normalizeImageUrl } from "@/lib/images";

export default function CartPage() {
  const { cart, setQty, removeLine, itemsCount, total } = useCart();
  const format = usePriceFormatter();

  if (cart.lines.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-gray-100 text-gray-400">
          <ShoppingBag className="w-8 h-8" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-gray-900">Tu carrito está vacío</h1>
        <p className="mt-2 text-gray-500">Agregá productos para empezar tu compra.</p>
        <Link
          href="/productos"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 transition-colors"
        >
          Ver tienda
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Carrito</h1>
      <p className="text-gray-500 mt-1 text-sm">{itemsCount} artículo{itemsCount === 1 ? "" : "s"}</p>

      <div className="mt-8 space-y-4">
        {cart.lines.map((l) => (
          <div key={l.variant_id} className="flex gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-20 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
              {l.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={normalizeImageUrl(l.image)!} alt={l.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-brand-200 text-2xl font-black">O.</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{l.name}</p>
              <p className="text-sm text-gray-500">
                {[l.size, l.color].filter(Boolean).join(" · ") || "Único"}
              </p>
              <p className="mt-1 text-sm font-medium text-gray-900">{format(l.price)}</p>
            </div>
            <div className="flex flex-col items-end justify-between">
              <button
                onClick={() => removeLine(l.variant_id)}
                className="text-gray-400 hover:text-red-600 transition-colors"
                aria-label="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="inline-flex items-center border border-gray-300 rounded-lg">
                <button onClick={() => setQty(l.variant_id, l.quantity - 1)} className="px-2.5 py-1 text-gray-600 hover:bg-gray-50">−</button>
                <span className="px-2.5 py-1 text-sm font-semibold min-w-9 text-center">{l.quantity}</span>
                <button onClick={() => setQty(l.variant_id, l.quantity + 1)} className="px-2.5 py-1 text-gray-600 hover:bg-gray-50">+</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">Subtotal</p>
          <p className="text-2xl font-bold text-gray-900">{format(total)}</p>
          <p className="text-xs text-gray-400 mt-1">Impuestos y envío se calculan en el checkout.</p>
        </div>
        <Link
          href="/checkout"
          className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 transition-colors"
        >
          Finalizar compra
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
