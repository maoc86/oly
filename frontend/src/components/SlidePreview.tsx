"use client";

import { useEffect, useState } from "react";
import { HeroSlide } from "@/lib/types";
import { ImageSize, aspectRatio, loadImageSize, mobileRatioWarning, ratioWarning } from "@/lib/imageRatio";
import { ImageIcon, TriangleAlert } from "lucide-react";

interface Props {
  placement: "hero" | "banner";
  slides: HeroSlide[];
  height: number;
  overlay: number;
  /** Hay un valor editado que todavía no se guardó. */
  dirty: boolean;
}

/**
 * Vista previa de cómo se ve la banda con la altura que se está editando en el
 * formulario de arriba. Usa los valores locales, no los guardados, para poder
 * ajustar la altura sin guardar y volver atrás.
 *
 * Muestra dos marcos: el de escritorio (con la altura configurada) y el de móvil
 * (con la proporción real del teléfono). El de móvil no usa `<picture>`: las
 * media queries de esa etiqueta miran el ancho del viewport, no del contenedor.
 */
export default function SlidePreview({ placement, slides, height, overlay, dirty }: Props) {
  const active = slides.filter((s) => s.is_active && s.image_url);
  const slide = active[0] ?? null;
  const desktopUrl = slide?.image_url ?? null;
  const mobileUrl = slide?.mobile_image_url ?? null;
  const [size, setSize] = useState<ImageSize | null>(null);
  const [mobileSize, setMobileSize] = useState<ImageSize | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [loadedMobileUrl, setLoadedMobileUrl] = useState<string | null>(null);

  if (desktopUrl !== loadedUrl) {
    setLoadedUrl(desktopUrl);
    setSize(null);
  }

  if (mobileUrl !== loadedMobileUrl) {
    setLoadedMobileUrl(mobileUrl);
    setMobileSize(null);
  }

  useEffect(() => {
    if (!desktopUrl) return;
    let alive = true;
    loadImageSize(desktopUrl).then((s) => {
      if (alive) setSize(s);
    });
    return () => {
      alive = false;
    };
  }, [desktopUrl]);

  useEffect(() => {
    if (!mobileUrl) return;
    let alive = true;
    loadImageSize(mobileUrl).then((s) => {
      if (alive) setMobileSize(s);
    });
    return () => {
      alive = false;
    };
  }, [mobileUrl]);

  const isHero = placement === "hero";
  const warning = size ? ratioWarning(size, placement) : null;
  const mobileWarning = mobileSize ? mobileRatioWarning(mobileSize, placement) : null;
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
        {/* Escritorio */}
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
                  {slides.length === 0
                    ? "Todavía no creaste ninguna imagen."
                    : "No hay imágenes activas: solo se muestran las activas."}
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

          <p className="mt-2 text-xs text-gray-400">
            Alto aplicado en escritorio: <strong className="text-gray-600">{height}px</strong>
            {size && (
              <>
                {" · "}de la imagen: {size.width}×{size.height} ({aspectRatio(size).toFixed(2)}:1)
              </>
            )}
          </p>

          {warning && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{warning}</span>
            </p>
          )}
        </div>

        {/* Móvil */}
        <div className="w-[180px] flex-shrink-0">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">Móvil</p>
          <div
            className={`relative overflow-hidden rounded-xl bg-gray-900 ${
              isHero ? "aspect-[4/5]" : "aspect-[16/9]"
            }`}
          >
            {slide ? (
              <>
                {/* Sin imagen de móvil: la de escritorio completa sobre fondo difuminado. */}
                {!mobileUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.image_url}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-lg"
                  />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mobileUrl || slide.image_url}
                  alt={slide.title}
                  className={`absolute inset-0 h-full w-full ${mobileUrl ? "object-cover" : "object-contain"}`}
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
                  {slide.cta_text && (
                    <span className="mt-2 inline-block w-fit rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-gray-900">
                      {slide.cta_text}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
          </div>

          <p className="mt-2 text-xs text-gray-400">
            {isHero ? "Vertical 4:5 (1080×1350)" : "Horizontal 16:9 (1200×675)"}
          </p>

          {mobileWarning && (
            <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{mobileWarning}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
