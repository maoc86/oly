import type { Metadata } from "next";
import ProductDetailClient from "./ProductDetailClient";

const API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://olyofficial.com";

interface Product {
  id: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  price: number;
  display_price: number;
  image_url?: string | null;
  images?: string[] | null;
  category?: { name: string } | null;
  brand?: string | null;
  is_active?: boolean;
}

async function fetchProduct(slug: string): Promise<Product | null> {
  try {
    const res = await fetch(`${API_URL}/products/${slug}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as Product;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProduct(slug);
  if (!product) {
    return {
      title: "Producto no encontrado",
      description: "El producto que buscas no está disponible.",
      robots: { index: false, follow: false },
    };
  }

  const image = product.image_url || product.images?.[0] || null;
  const ogImage = image || `${SITE_URL}/opengraph-image`;
  const price = Number(product.display_price ?? product.price ?? 0).toFixed(2);
  const description = product.description
    ? product.description.slice(0, 160)
    : `${product.name} — ropa deportiva${product.category?.name ? ` · ${product.category.name}` : ""}. Precio USD ${price}.`;

  return {
    title: product.name,
    description,
    keywords: [product.name, product.brand || "", product.category?.name || "", "ropa deportiva", "Oly Official"].filter(Boolean),
    openGraph: {
      title: product.name,
      description,
      type: "website",
      url: `${SITE_URL}/producto/${product.slug || product.id}`,
      images: [{ url: ogImage, alt: product.name, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description,
      images: [ogImage],
    },
    other: {
      "product:price:amount": price,
      "product:price:currency": "USD",
    },
  };
}

export default function ProductDetailPage() {
  return <ProductDetailClient />;
}
