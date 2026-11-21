"use client";

import Link from "next/link";
import { Heart, Eye, ShoppingBag, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Product } from "@/lib/types";
import { usePriceFormatter } from "@/lib/currency";
import { normalizeImageUrl } from "@/lib/images";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toastSuccess, toastError } from "@/lib/toast";

export default function ProductCard({ product }: { product: Product }) {
  const format = usePriceFormatter();
  const { isAuthenticated } = useAuth();
  const [hovered, setHovered] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const images = (product.images?.length ? product.images : product.image_url ? [product.image_url] : [])
    .map((u) => normalizeImageUrl(u))
    .filter((u): u is string => !!u);

  const primaryImage = images[0] ?? null;
  const secondaryImage = images.length > 1 ? images[1] : null;

  const showOffer = product.offer_active && product.offer_price != null;
  const discountPct = showOffer && product.price
    ? Math.round((1 - Number(product.offer_price) / Number(product.price)) * 100)
    : 0;
  const inStock = (product.stock ?? 0) > 0;
  const lowStock = inStock && (product.stock ?? 0) <= 3;

  async function toggleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      window.location.href = "/login?redirect=/favoritos";
      return;
    }
    setFavLoading(true);
    try {
      if (favorited) {
        await api.delete(`/favorites/${product.id}`);
        setFavorited(false);
      } else {
        await api.post(`/favorites/${product.id}`);
        setFavorited(true);
        toastSuccess("Agregado a favoritos.");
      }
    } catch {
      toastError("No se pudo actualizar favoritos.");
    } finally {
      setFavLoading(false);
    }
  }

  return (
    <Link
      href={`/producto/${product.slug || product.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Imagen */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100">
        {primaryImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primaryImage}
              alt={product.name}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${hovered && secondaryImage ? "opacity-0 scale-105" : "opacity-100 scale-100 group-hover:scale-105"}`}
            />
            {secondaryImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={secondaryImage}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${hovered ? "opacity-100 scale-100" : "opacity-0 scale-105"}`}
              />
            )}
          </>
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
            <span className="text-5xl font-black text-brand-300 select-none">Oly.</span>
          </div>
        )}

        {/* Overlay hover */}
        <div className={`absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent transition-opacity duration-300 ${hovered ? "opacity-100" : "opacity-0"}`} />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.is_new && (
            <span className="px-2.5 py-1 rounded-full bg-ink-950/80 backdrop-blur text-white text-[10px] font-bold uppercase tracking-wider">
              Nuevo
            </span>
          )}
          {showOffer && discountPct > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-brand-600 text-white text-[10px] font-bold">
              -{discountPct}%
            </span>
          )}
          {lowStock && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
              Últimas
            </span>
          )}
        </div>

        {/* Acciones rápidas (hover) */}
        <div className={`absolute top-3 right-3 flex flex-col gap-2 transition-all duration-300 ${hovered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"}`}>
          <button
            onClick={toggleFavorite}
            disabled={favLoading}
            className={`grid place-items-center w-9 h-9 rounded-full backdrop-blur transition-colors ${
              favorited ? "bg-brand-600 text-white" : "bg-white/90 text-gray-700 hover:bg-white hover:text-brand-600"
            }`}
            aria-label={favorited ? "Quitar de favoritos" : "Agregar a favoritos"}
          >
            <Heart className={`w-4 h-4 ${favorited ? "fill-current" : ""}`} />
          </button>
          <span className="grid place-items-center w-9 h-9 rounded-full bg-white/90 backdrop-blur text-gray-700 hover:bg-white hover:text-brand-600 transition-colors">
            <Eye className="w-4 h-4" />
          </span>
        </div>

        {/* Agotado overlay */}
        {!inStock && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
            <span className="px-4 py-1.5 rounded-full bg-gray-900 text-white text-xs font-bold uppercase tracking-wider">
              Agotado
            </span>
          </div>
        )}

        {/* "Ver producto" CTA on hover */}
        <div className={`absolute bottom-3 left-3 right-3 transition-all duration-300 ${hovered && inStock ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}>
          <span className="block w-full py-2.5 rounded-xl bg-white/95 backdrop-blur text-gray-900 text-sm font-semibold text-center shadow-lg">
            Ver producto
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="p-4 sm:p-5 flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 truncate">
          {product.brand || product.category?.name || "Oly"}
        </p>
        <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2 text-sm sm:text-base">
          {product.name}
        </h3>
        <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
          <span className="text-base sm:text-lg font-bold text-gray-900">{format(product.display_price)}</span>
          {showOffer && product.price != null && (
            <>
              <span className="text-sm text-gray-400 line-through">{format(product.price)}</span>
            </>
          )}
        </div>
        {/* Color swatches */}
        {product.variants && product.variants.length > 1 && (
          <div className="flex gap-1.5 mt-2">
            {Array.from(new Set(product.variants.map((v) => v.color).filter(Boolean))).slice(0, 5).map((c) => (
              <span
                key={c}
                className="w-4 h-4 rounded-full border border-gray-300 bg-gray-200"
                title={c!}
              />
            ))}
            {Array.from(new Set(product.variants.map((v) => v.color).filter(Boolean))).length > 5 && (
              <span className="text-xs text-gray-400 self-center">+{Array.from(new Set(product.variants.map((v) => v.color).filter(Boolean))).length - 5}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
