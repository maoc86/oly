"use client";

import { HeroSlide } from "@/lib/types";
import { ImageIcon } from "lucide-react";

interface Props {
  placement: "hero" | "banner";
  slides: HeroSlide[];
  height: number;
  overlay: number;
  dirty: boolean;
}

export default function SlidePreview({ placement, slides, height, overlay, dirty }: Props) {
  const active = slides.filter((s) => s.is_active && s.image_url);
  const slide = active[0] ?? null;
  const isHero = placement === "hero";
  const overlayAlpha = overlay / 100;

  return (
    <div className="mb-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-gray-500">
          Vista previa {isHero ? "del hero" : "del banner"}
        </span>
        {dirty && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            sin guardar
          </span>
        )}
        {slide && active.length > 1 && (
          <span className="text-[11px] text-gray-400">
            mostrando la 1 de {active.length} activas
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">Escritorio</p>
          <div
            className="relative mx-auto max-w-4xl overflow-hidden rounded-xl bg-gray-900"
            style={{ height: `${height}px` }}
          >
            {slide ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={slide.image_url} alt={slide.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-500">
                <ImageIcon className="h-7 w-7" />
                <span className="text-sm">
                  {slides.length === 0 ? "Todavía no creaste ninguna imagen." : "No hay imágenes activas."}
                </span>
              </div>
            )}

            {slide && (
              <div
                className="absolute inset-0 flex flex-col justify-center"
                style={{
                  background: `linear-gradient(to right, rgba(0,0,0,${overlayAlpha}) 0%, rgba(0,0,0,${overlayAlpha / 2}) 60%, transparent 100%)`,
                }}
              >
                <div className="max-w-xl px-8">
                  <h3 className="font-bold text-white drop-shadow">{slide.title}</h3>
                  {slide.subtitle && <p className="mt-1 text-sm text-white/85">{slide.subtitle}</p>}
                  {slide.cta_text && (
                    <span className="mt-3 inline-block rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-900">
                      {slide.cta_text}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-[180px] flex-shrink-0">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">Móvil</p>
          <div
            className={`relative overflow-hidden rounded-xl bg-gray-900 ${
              isHero ? "aspect-[4/5]" : "aspect-[16/9]"
            }`}
          >
            {slide ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.mobile_image_url || slide.image_url}
                  alt={slide.title}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: isHero
                      ? `linear-gradient(to top, rgba(0,0,0,${overlayAlpha + 0.3}), rgba(0,0,0,${overlayAlpha}) 50%, rgba(0,0,0,${overlayAlpha / 2}))`
                      : `linear-gradient(to right, rgba(0,0,0,${overlayAlpha + 0.15}), transparent)`,
                  }}
                />
                <div className="absolute inset-0 flex flex-col justify-center px-3">
                  <h3 className="text-sm font-bold text-white drop-shadow">{slide.title}</h3>
                  {slide.subtitle && <p className="mt-1 text-[10px] text-white/85">{slide.subtitle}</p>}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
