import Link from "next/link";
import { Sparkles, ArrowRight, QrCode, ShieldCheck, Headphones } from "lucide-react";
import { Event, Category, HeroSlide } from "@/lib/types";
import HeroCarousel from "@/components/HeroCarousel";
import HomeClient from "./HomeClient";

const HIGHLIGHTS = [
  { icon: QrCode, title: "Boletos con QR", text: "Descarga y lleva tu entrada al cellphone" },
  { icon: ShieldCheck, title: "Compra segura", text: "Paga como quieras y guardas tu orden" },
  { icon: Headphones, title: "Soporte cercano", text: "Te ayudamos antes y despues del evento" },
];

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

export default async function HomePage() {
  const [events, slides, banners] = await Promise.all([
    fetchJson<Event[]>("/events?limit=100"),
    fetchJson<HeroSlide[]>("/hero-slides?placement=hero"),
    fetchJson<HeroSlide[]>("/hero-slides?placement=banner"),
  ]);

  const categories = Array.from(
    new Map(
      events
        .map((e) => e.category)
        .filter((c): c is Category => !!c)
        .map((c) => [c.id, c])
    ).values()
  );

  const heroConfig = {
    autoplay: true,
    transitionSeconds: 6,
    height: 600,
    overlay: 40,
  };
  const bannerConfig = {
    autoplay: true,
    transitionSeconds: 5,
    height: 260,
    overlay: 40,
  };

  return (
    <div>
      {/* Hero */}
      {slides.length > 0 ? (
        <HeroCarousel
          slides={slides}
          autoplay={heroConfig.autoplay}
          transitionSeconds={heroConfig.transitionSeconds}
          height={heroConfig.height}
          overlay={heroConfig.overlay}
        />
      ) : (
        <section className="relative overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-ink-950 text-white">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 15%, rgba(255,184,0,0.30), transparent 45%), radial-gradient(circle at 85% 0%, rgba(255,138,0,0.22), transparent 50%)",
            }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/15 text-brand-300 ring-1 ring-brand-500/30 text-sm mb-6 backdrop-blur">
              <Sparkles className="w-4 h-4" />
              Descubre los mejores eventos
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-balance">
              Compra tus entradas para los eventos que amas
            </h1>
            <p className="mt-5 text-base sm:text-lg text-white/80 max-w-2xl mx-auto text-pretty">
              Explora conciertos, festivales, deportes y mas. Elige tu zona o asiento y asegura tu lugar.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/eventos"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-brand-500 text-ink-900 rounded-xl font-semibold shadow-sm hover:bg-brand-400 hover:shadow-md transition-all"
              >
                Explorar eventos
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

      {/* Banners */}
      {banners.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <div className="rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5">
            <HeroCarousel
              slides={banners}
              autoplay={bannerConfig.autoplay}
              transitionSeconds={bannerConfig.transitionSeconds}
              height={bannerConfig.height}
              overlay={bannerConfig.overlay}
              variant="banner"
            />
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

      <HomeClient events={events} categories={categories} />
    </div>
  );
}