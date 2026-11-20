"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { api } from "@/lib/api";
import { Product, Category } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

function ProductsInner() {
  const params = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("newest");

  const search = params.get("search") || "";
  const category = params.get("categoria") || "";
  const gender = params.get("genero") || "";

  useEffect(() => {
    api.get<Category[]>("/categories").then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (category) q.set("category", category);
    if (gender) q.set("gender", gender);
    if (sort) q.set("sort", sort);
    api
      .get<Product[]>(`/products?${q.toString()}`)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [search, category, gender, sort]);

  const title = search
    ? `Resultados para "${search}"`
    : category
      ? categories.find((c) => c.slug === category)?.name || "Productos"
      : "Toda la tienda";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {loading ? "Cargando…" : `${products.length} producto${products.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="newest">Más recientes</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
          <option value="name">Nombre A-Z</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-gray-100 text-gray-400">
            <PackageSearch className="w-7 h-7" />
          </span>
          <p className="mt-4 font-semibold text-gray-900">No encontramos productos</p>
          <p className="mt-1.5 text-sm text-gray-500">Probá con otra búsqueda o filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <ProductsInner />
    </Suspense>
  );
}
