"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ShoppingBag, Check } from "lucide-react";
import { api } from "@/lib/api";
import { Product } from "@/lib/types";
import { useCart } from "@/lib/cart";
import { usePriceFormatter } from "@/lib/currency";
import { normalizeImageUrl } from "@/lib/images";

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const { addLine } = useCart();
  const format = usePriceFormatter();

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
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const sizes = useMemo(() => (product ? uniqueSizes(product) : []), [product]);
  const colors = useMemo(() => (product ? uniqueColors(product) : []), [product]);

  const variant = useMemo(() => {
    if (!product) return null;
    return product.variants?.find((v) => v.size === size && v.color === color) ?? null;
  }, [product, size, color]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-8">
        <div className="aspect-[3/4] rounded-2xl bg-gray-100 animate-pulse" />
        <div className="space-y-4">
          <div className="h-8 bg-gray-100 rounded animate-pulse w-3/4" />
          <div className="h-5 bg-gray-100 rounded animate-pulse w-1/3" />
          <div className="h-32 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="font-semibold text-gray-900">Producto no encontrado</p>
        <Link href="/productos" className="mt-4 inline-block text-brand-700 hover:underline">
          Volver a la tienda
        </Link>
      </div>
    );
  }

  const images = product.images?.length ? product.images : product.image_url ? [product.image_url] : [];
  const effectivePrice = variant ? Number(variant.price_override ?? product.display_price) : product.display_price;
  const inStock = variant ? variant.stock > 0 : (product.stock ?? 0) > 0;

  function addToCart() {
    if (!variant) return;
    addLine(
      {
        variant_id: variant.id,
        product_id: product!.id,
        name: product!.name,
        image: product!.image_url ?? undefined,
        size: variant.size ?? undefined,
        color: variant.color ?? undefined,
        price: effectivePrice,
      },
      qty
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-gray-600">Inicio</Link>
        <span className="mx-2">/</span>
        <Link href="/productos" className="hover:text-gray-600">Tienda</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-700">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Galería */}
        <div className="space-y-3">
          <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-gray-100">
            {images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={normalizeImageUrl(images[0])!}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-brand-200">
                <span className="text-6xl font-black">Oly.</span>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={normalizeImageUrl(img)!}
                  alt=""
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <p className="text-sm text-gray-400 uppercase tracking-wide">{product.brand || product.category?.name}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold tracking-tight text-gray-900">{product.name}</h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-gray-900">{format(effectivePrice)}</span>
            {product.offer_active && product.offer_price != null && (
              <span className="text-lg text-gray-400 line-through">{format(product.price)}</span>
            )}
          </div>

          {product.description && (
            <p className="mt-5 text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
          )}

          {/* Tallas */}
          {sizes.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-gray-900 mb-2">Talla</p>
              <div className="flex flex-wrap gap-2">
                {sizes.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={`min-w-12 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      size === s
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-300 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Colores */}
          {colors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-900 mb-2">Color</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      color === c
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-300 text-gray-700 hover:border-gray-400"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cantidad */}
          <div className="mt-6">
            <p className="text-sm font-semibold text-gray-900 mb-2">Cantidad</p>
            <div className="inline-flex items-center border border-gray-300 rounded-lg">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-4 py-2 text-gray-600 hover:bg-gray-50"
              >
                −
              </button>
              <span className="px-4 py-2 text-sm font-semibold min-w-12 text-center">{qty}</span>
              <button
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                className="px-4 py-2 text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Stock */}
          <p className="mt-4 text-sm">
            {variant ? (
              variant.stock > 0 ? (
                <span className="text-green-600">Disponible ({variant.stock} en stock)</span>
              ) : (
                <span className="text-red-600">Agotado</span>
              )
            ) : (
              <span className="text-gray-500">Elegí talla y color</span>
            )}
          </p>

          <button
            onClick={addToCart}
            disabled={!variant || !inStock}
            className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {added ? <Check className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
            {added ? "Agregado al carrito" : "Agregar al carrito"}
          </button>
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
