"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HeroSlide } from "@/lib/types";
import { normalizeImageUrl } from "@/lib/images";

const DEFAULT_TRANSITION_SECONDS = 6;
const DEFAULT_HEIGHT = 600;
const DEFAULT_OVERLAY = 40;

interface HeroCarouselProps {
  slides: HeroSlide[];
  autoplay?: boolean;
  transitionSeconds?: number;
  height?: number;
  overlay?: number;
  /** "hero" usa textos grandes; "banner" los muestra mas discretos. */
  variant?: "hero" | "banner";
}

export default function HeroCarousel({
  slides,
  autoplay = true,
  transitionSeconds = DEFAULT_TRANSITION_SECONDS,
  height = DEFAULT_HEIGHT,
  overlay = DEFAULT_OVERLAY,
  variant = "hero",
}: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const autoPlayMs = Math.max(1, transitionSeconds) * 1000;
  const isBanner = variant === "banner";

  const go = useCallback(
    (dir: 1 | -1) => setIndex((i) => (i + dir + slides.length) % slides.length),
    [slides.length]
  );

  useEffect(() => {
    if (slides.length < 2 || paused || !autoplay) return;
    const t = setInterval(() => go(1), autoPlayMs);
    return () => clearInterval(t);
  }, [slides.length, paused, autoplay, go, autoPlayMs]);

  // Si la lista de slides cambia y el indice actual queda fuera de rango.
  const safeIndex = slides.length === 0 ? 0 : Math.min(index, slides.length - 1);

  if (slides.length === 0) return null;

  const base = Math.min(85, Math.max(0, overlay)) / 100;
  const strong = Math.min(0.95, base + (isBanner ? 0.15 : 0.3));
  const soft = base * 0.5;

  return (
    <section
      className="relative text-white overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className={`relative ${
          isBanner
            ? "aspect-[16/9] sm:aspect-auto sm:h-[var(--carousel-h)]"
            : "aspect-[4/5] sm:aspect-auto sm:h-[var(--carousel-h)]"
        }`}
        style={{ "--carousel-h": `${height}px` } as CSSProperties}
      >
        {slides.map((s, i) => {
          const isVisible = i === safeIndex || i === (safeIndex + 1) % slides.length || i === (safeIndex - 1 + slides.length) % slides.length;
          if (!isVisible) return null;
          return (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${
              i === safeIndex ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            aria-hidden={i !== safeIndex}
          >
            {s.link_url ? (
              <Link
                href={s.link_url}
                className="absolute inset-0 z-[2] block cursor-pointer"
                aria-label={s.title || "Ir al enlace"}
              />
            ) : null}
            <div className="absolute inset-0 z-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={normalizeImageUrl(s.image_url) ?? undefined}
                alt={s.title}
                className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[7000ms] ease-out ${
                  i === safeIndex ? "scale-105" : "scale-100"
                }`}
              />
            </div>
            <div
              className="absolute inset-0 z-[1]"
              style={{
                background: isBanner
                  ? `linear-gradient(to right, rgba(0,0,0,${strong}), rgba(0,0,0,${soft}))`
                  : `linear-gradient(to top, rgba(0,0,0,${strong}), rgba(0,0,0,${base}) 50%, rgba(0,0,0,${soft}))`,
              }}
            />
            <div className="absolute inset-0 z-[3] flex items-center pointer-events-none">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                <div className="max-w-2xl">
                  {isBanner && (
                    <span className="inline-block px-3 py-1 mb-2 sm:mb-4 text-xs font-semibold uppercase tracking-wider bg-white/15 backdrop-blur rounded-full">
                      Aviso
                    </span>
                  )}
                  {s.title && (
                    <h1
                      className={
                        isBanner
                          ? "text-xl sm:text-3xl font-bold tracking-tight drop-shadow-sm"
                          : "text-3xl sm:text-5xl font-extrabold tracking-tight drop-shadow-sm text-balance"
                      }
                    >
                      {s.title}
                    </h1>
                  )}
                  {s.subtitle && (
                    <p
                      className={`mt-3 drop-shadow-sm ${
                        isBanner ? "text-sm sm:text-base text-white/85" : "mt-5 text-base sm:text-lg text-white/90"
                      }`}
                    >
                      {s.subtitle}
                    </p>
                  )}
                  {s.cta_text && s.cta_link && (
                    <Link
                      href={s.cta_link}
                      className={`inline-flex items-center gap-2 bg-brand-500 text-white rounded-xl font-semibold shadow-sm hover:bg-brand-600 hover:shadow-md transition-all pointer-events-auto ${
                        isBanner ? "mt-3 sm:mt-4 px-4 py-2 text-sm" : "mt-7 px-6 py-3"
                      }`}
                    >
                      {s.cta_text}
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Anterior"
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/25 backdrop-blur-sm hover:bg-black/45 text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Siguiente"
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/25 backdrop-blur-sm hover:bg-black/45 text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {slides.map((s, i) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setIndex(i)}
                aria-label={`Ir a ${s.title || "la imagen " + (i + 1)}`}
                aria-current={i === safeIndex}
                className={`h-2 rounded-full transition-all ${
                  i === safeIndex ? "w-8 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}