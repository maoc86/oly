import type { MetadataRoute } from "next";

const API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://olyofficial.com";

// Forzar renderizado dinámico: el sitemap depende de los productos del backend,
// que no están disponibles en tiempo de build.
export const dynamic = "force-dynamic";

async function fetchJson<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return [] as T;
    return (await res.json()) as T;
  } catch {
    return [] as T;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    fetchJson<any[]>("/products?limit=200"),
    fetchJson<any[]>("/categories"),
  ]);

  const entries: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/productos`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/terminos`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  for (const p of products) {
    entries.push({
      url: `${BASE}/producto/${p.slug || p.id}`,
      lastModified: p.created_at ? new Date(p.created_at) : new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  for (const c of categories) {
    if (c.slug) {
      entries.push({
        url: `${BASE}/productos?categoria=${c.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
