"use client";

import Link from "next/link";
import { Product } from "@/lib/types";
import { usePriceFormatter } from "@/lib/currency";
import { normalizeImageUrl } from "@/lib/images";

export default function ProductCard({ product }: { product: Product }) {
  const format = usePriceFormatter();
  const image = normalizeImageUrl(product.image_url);

  const showOffer = product.offer_active && product.offer_price != null;

  return (
    <Link
      href={`/producto/${product.slug || product.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-300">
            <span className="text-4xl font-black text-brand-200">Oly.</span>
          </div>
        )}
        {product.is_new && (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-ink-950 text-white text-[11px] font-semibold">
            Nuevo
          </span>
        )}
        {showOffer && (
          <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-brand-600 text-white text-[11px] font-semibold">
            Oferta
          </span>
        )}
        {product.stock != null && product.stock <= 0 && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="px-3 py-1 rounded-full bg-gray-900 text-white text-xs font-semibold">Agotado</span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-1">
        <p className="text-xs text-gray-400 uppercase tracking-wide truncate">{product.brand || product.category?.name}</p>
        <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">{product.name}</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-bold text-gray-900">{format(product.display_price)}</span>
          {showOffer && product.price != null && (
            <span className="text-sm text-gray-400 line-through">{format(product.price)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
