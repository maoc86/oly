"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ShoppingBag, Check, Share2, CheckCircle2, Truck, ShieldCheck, RotateCcw,
  ChevronLeft, ChevronRight, Minus, Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import { Product } from "@/lib/types";
import { useCart } from "@/lib/cart";
import { useCurrency, usePriceFormatter } from "@/lib/currency";
import { normalizeImageUrl } from "@/lib/images";

export default function ProductDetailClient() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [shared, setShared] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);

  const { currency, setCurrency } = useCurrency();
  const format = usePriceFormatter();
  const { addLine } = useCart();

  useEffect(() => {
    setLoading(true);
    api
      .get<Product>(`/products/${slug}`)
      .then((p) => {
        setProduct(p);
        const sizes = uniqueSizes(p);
        const colors = uniqueColors(p);
        if (sizes.length === 1) setSize(sizes[0]);
        if (colors.length === 1) setColor(colors[0]);
        setSelectedImage(0);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const sizes = useMemo(() => (product ? uniqueSizes(product) : []), [product]);
  const colors = useMemo(() => (product ? uniqueColors(product) : []), [product]);

  const availableColors = useMemo(() => {
    if (!product) return [];
    if (!size) return colors.filter((c) => product.variants?.some((v) => v.color === c && (v.stock ?? 0) > 0));
    return colors.filter((c) => product.variants?.some((v) => v.size === size && v.color === c && (v.stock ?? 0) > 0));
  }, [product, size, colors]);

  const availableSizes = useMemo(() => {
    if (!product) return [];
    if (!color) return sizes.filter((s) => product.variants?.some((v) => v.size === s && (v.stock ?? 0) > 0));
    return sizes.filter((s) => product.variants?.some((v) => v.size === s && v.color === color && (v.stock ?? 0) > 0));
  }, [product, color, sizes]);

  const variant = useMemo(() => {
    if (!product) return null;
    return product.variants?.find((v) => v.size === size && v.color === color) ?? null;
  }, [product, size, color]);

  const mainImage = useMemo(() => {
    if (!product) return null;
    if (color) {
      const v = product.variants?.find((x) => x.color === color && x.image_url);
      if (v?.image_url) return v.image_url;
    }
    const imgs = product.images?.length ? product.images : product.image_url ? [product.image_url] : [];
    return imgs[selectedImage] ?? imgs[0] ?? product.image_url ?? null;
  }, [product, color, selectedImage]);

  const images = useMemo(() => {
    if (!product) return [];
    if (product.images?.length) return product.images;
    return product.image_url ? [product.image_url] : [];
  }, [product]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-8 lg:gap-12">
        <div className="aspect-[3/4] rounded-2xl bg-gray-100 animate-pulse" />
        <div className="space-y-4">
          <div className="h-4 bg-gray-100 rounded animate-pulse w-1/4" />
          <div className="h-10 bg-gray-100 rounded animate-pulse w-3/4" />
          <div className="h-8 bg-gray-100 rounded animate-pulse w-1/3" />
          <div className="h-24 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="text-xl font-bold text-gray-900">Producto no encontrado</p>
        <Link href="/productos" className="mt-4 inline-block text-brand-700 hover:underline">
          Volver a la tienda
        </Link>
      </div>
    );
  }

  const effectivePrice = variant ? Number(variant.price_override ?? product.display_price) : product.display_price;
  const inStock = variant ? variant.stock > 0 : (product.stock ?? 0) > 0;
  const lowStock = variant && variant.stock > 0 && variant.min_stock > 0 && variant.stock <= variant.min_stock;

  function addToCart() {
    if (!variant) return;
    addLine(
      {
        variant_id: variant.id,
        product_id: product!.id,
        name: product!.name,
        image: (variant.image_url || product!.image_url) ?? undefined,
        size: variant.size ?? undefined,
        color: variant.color ?? undefined,
        price: effectivePrice,
      },
      qty
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: product!.name, text: product!.description || product!.name, url });
        return;
      } catch { /* cancelado */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* sin portapapeles */ }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6 sm:mb-8 flex items-center gap-1.5">
        <Link href="/" className="hover:text-gray-600 transition-colors">Inicio</Link>
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        <Link href="/productos" className="hover:text-gray-600 transition-colors">Tienda</Link>
        {product.category?.name && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
            <Link href={`/productos?categoria=${product.category?.name?.toLowerCase().replace(/\s+/g, "-")}`} className="hover:text-gray-600 transition-colors">
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
        <span className="text-gray-700 truncate">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-16">
        {/* Galería */}
        <div className="space-y-4">
          <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100 group">
            {mainImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={normalizeImageUrl(mainImage)!}
                alt={product.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-brand-200">
                <span className="text-7xl font-black">Oly.</span>
              </div>
            )}
            {product.is_new && (
              <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-ink-950 text-white text-xs font-semibold">
                Nuevo
              </span>
            )}
            {product.offer_active && product.offer_price != null && (
              <span className="absolute top-4 right-4 px-3 py-1 rounded-full bg-brand-600 text-white text-xs font-semibold">
                Oferta
              </span>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedImage((i) => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full bg-white/80 backdrop-blur text-gray-700 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSelectedImage((i) => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-full bg-white/80 backdrop-blur text-gray-700 hover:bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Imagen siguiente"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {images.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                    selectedImage === i ? "border-brand-600 ring-2 ring-brand-200" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <img src={normalizeImageUrl(img)!} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {product.brand || product.category?.name}
            </p>
            <button
              onClick={share}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-gray-500 hover:text-brand-700 hover:bg-brand-50 transition-colors"
              aria-label="Compartir producto"
            >
              {shared ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              {shared ? "Copiado" : "Compartir"}
            </button>
          </div>

          <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight">
            {product.name}
          </h1>

          <div className="mt-5 flex items-end gap-3 flex-wrap">
            <span className="text-3xl sm:text-4xl font-bold text-gray-900">{format(effectivePrice)}</span>
            {product.offer_active && product.offer_price != null && (
              <span className="text-lg text-gray-400 line-through mb-1">{format(product.price)}</span>
            )}
            <button
              onClick={() => setCurrency(currency === "USD" ? "VES" : "USD")}
              className="ml-auto px-3.5 py-1.5 rounded-full text-xs font-semibold border border-gray-200 text-gray-600 hover:border-brand-400 hover:text-brand-700 transition-colors"
            >
              {currency === "USD" ? "Ver en Bs." : "Ver en USD"}
            </button>
          </div>

          {product.description && (
            <p className="mt-5 text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
          )}

          {/* Colores */}
          {colors.length > 0 && (
            <div className="mt-7">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Color{color ? <span className="font-normal text-gray-500"> — {color}</span> : ""}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {colors.map((c) => {
                  const disabled = !availableColors.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => !disabled && setColor(color === c ? null : c)}
                      disabled={disabled}
                      className={`px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                        disabled
                          ? "border-gray-200 text-gray-300 cursor-not-allowed line-through"
                          : color === c
                            ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                            : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tallas */}
          {sizes.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-gray-900 mb-3">
                Talla{size ? <span className="font-normal text-gray-500"> — {size}</span> : ""}
              </p>
              <div className="flex flex-wrap gap-2.5">
                {sizes.map((s) => {
                  const disabled = !availableSizes.includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => !disabled && setSize(size === s ? null : s)}
                      disabled={disabled}
                      className={`min-w-12 px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                        disabled
                          ? "border-gray-200 text-gray-300 cursor-not-allowed line-through"
                          : size === s
                            ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                            : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cantidad + Add to cart */}
          <div className="mt-7 flex items-center gap-3">
            <div className="inline-flex items-center border border-gray-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-4 py-3 text-gray-600 hover:bg-gray-50 transition-colors"
                aria-label="Disminuir cantidad"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="px-4 py-3 text-sm font-semibold min-w-12 text-center">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                className="px-4 py-3 text-gray-600 hover:bg-gray-50 transition-colors"
                aria-label="Aumentar cantidad"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={addToCart}
              disabled={!variant || !inStock}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
            >
              {added ? <Check className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
              {added ? "Agregado al carrito" : "Agregar al carrito"}
            </button>
          </div>

          {/* Stock status */}
          <div className="mt-4 flex items-center gap-2 text-sm">
            {variant ? (
              variant.stock > 0 ? (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-gray-700">
                    Disponible
                    {lowStock && <span className="ml-1 text-amber-600 font-medium">(¡últimas {variant.stock} unidades!)</span>}
                    {!lowStock && <span className="text-gray-400"> · {variant.stock} en stock</span>}
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-red-600 font-medium">Agotado</span>
                </>
              )
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                <span className="text-gray-500">Elegí talla y color</span>
              </>
            )}
          </div>

          {/* Trust signals */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-gray-100">
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex-shrink-0">
                <Truck className="w-4 h-4" />
              </span>
              <span>Envío a toda Venezuela</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex-shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <span>Compra protegida</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-gray-600">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex-shrink-0">
                <RotateCcw className="w-4 h-4" />
              </span>
              <span>Cambios de talla 7 días</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function uniqueSizes(p: Product): string[] {
  const set = new Set<string>();
  p.variants?.forEach((v) => v.size && set.add(v.size));
  return Array.from(set);
}

function uniqueColors(p: Product): string[] {
  const set = new Set<string>();
  p.variants?.forEach((v) => v.color && set.add(v.color));
  return Array.from(set);
}
