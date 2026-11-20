"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { api } from "@/lib/api";
import { FavoriteResponse } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<FavoriteResponse[]>("/favorites").then(setFavorites).catch(() => setFavorites([])).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-10 text-gray-500">Cargando…</div>;
  }

  if (favorites.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-gray-100 text-gray-400">
          <Heart className="w-8 h-8" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-gray-900">No tenés favoritos</h1>
        <p className="mt-2 text-gray-500">Guardá productos que te gusten para encontrarlos fácil.</p>
        <Link href="/productos" className="mt-6 inline-block px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500">
          Explorar tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Favoritos</h1>
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {favorites.map((f) => f.product && <ProductCard key={f.id} product={f.product} />)}
      </div>
    </div>
  );
}
