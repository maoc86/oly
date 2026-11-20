import Link from "next/link";
import { ArrowRight, Sparkles, Truck, ShieldCheck, HeartHandshake } from "lucide-react";
import { Product, Category, HeroSlide } from "@/lib/types";
import ProductCard from "@/components/ProductCard";
import HeroCarousel from "@/components/HeroCarousel";

export const dynamic = "force-dynamic";

const API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJson<T>(path: string): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return [] as T;
    return (await res.json()) as T;
  } catch {
    return [] as T;
  }
}

const HIGHLIGHTS = [
  { icon: Truck, title: "Envíos a toda Venezuela", text: "Recibe en la puerta de tu casa" },
  { icon: ShieldCheck, title: "Compra protegida", text: "Confirmamos tu pago antes de despachar" },
  { icon: HeartHandshake, title: "Atención cercana", text: "Te ayudamos por WhatsApp en todo momento" },
];

export default async function HomePage() {
  const [featured, slides, categories] = await Promise.all([
    fetchJson<Product[]>("/products/featured"),
    fetchJson<HeroSlide[]>("/hero-slides?placement=hero"),
    fetchJson<Category[]>("/categories"),
  ]);

  const heroConfig = { autoplay: true, transitionSeconds: 6, height: 560, overlay: 35 };

  return (
    <div>
      {slides.length > 0 ? (
        <HeroCarousel
          slides={slides}
          autoplay={heroConfig.autoplay}
          transitionSeconds={heroConfig.transitionSeconds}
          height={heroConfig.height}
          overlay={heroConfig.overlay}
        />
      ) : (
        <section className="relative overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 text-white">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 15%, rgba(198,93,59,0.35), transparent 45%), radial-gradient(circle at 85% 0%, rgba(176,138,86,0.25), transparent 50%)",
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/15 text-brand-200 ring-1 ring-brand-500/30 text-sm mb-6 backdrop-blur">
              <Sparkles className="w-4 h-4" />
              Nueva colección deportiva
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance">
              Entrena sin límites.
              <br />
              <span className="text-brand-400">Vístete Oly.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/80 max-w-2xl mx-auto text-pretty">
              Leggings, tops, conjuntos y más, diseñados para mujeres que se mueven. Encuentra tu talla y color ideal.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/productos"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 text-white rounded-xl font-semibold shadow-sm hover:bg-brand-600 hover:shadow-md transition-all"
              >
                Ver tienda
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/registro"
                className="inline-flex items-center justify-center px-6 py-3 text-white border border-white/40 rounded-xl font-semibold hover:bg-white/10 transition-colors"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Cualidades */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.title}
              className="flex items-start gap-3.5 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm"
            >
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-brand-50 text-brand-700 flex-shrink-0">
                <h.icon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{h.title}</p>
                <p className="text-sm text-gray-500 mt-0.5">{h.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categorías */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/productos?categoria=${c.slug}`}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:border-brand-300 hover:text-brand-700 transition-colors"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Destacados */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Destacados</h2>
            <p className="text-gray-500 mt-1.5 text-sm">Lo más vendido y recién llegado</p>
          </div>
          <Link
            href="/productos"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-600"
          >
            Ver todo
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
            <p className="font-semibold text-gray-900">Todavía no hay productos destacados</p>
            <p className="mt-1.5 text-sm text-gray-500">Pronto publicaremos la nueva colección.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
