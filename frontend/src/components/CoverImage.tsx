import { getImageProps } from "next/image";
import { normalizeImageUrl } from "@/lib/images";

interface Props {
  /** Imagen principal (escritorio). */
  desktopSrc?: string | null;
  /** Imagen específica para móvil. Si falta, la de escritorio se muestra completa. */
  mobileSrc?: string | null;
  alt: string;
  /** Clases extra para el <img> principal (por ejemplo el zoom del hover). */
  className?: string;
  eager?: boolean;
  /** Tamaños responsivos para el srcSet del optimizador de Next. */
  sizes?: string;
  /** Prioridad de carga (LCP). Agrega preload + fetchpriority high. */
  priority?: boolean;
}

/**
 * Imagen de una banda (portada, cabecera del detalle o hero) que se adapta al
 * ancho de pantalla:
 *
 * - En móvil usa `mobileSrc` si existe (rellena el marco, sin recorte).
 * - Si no hay imagen de móvil, muestra la de escritorio **completa**
 *   (`object-contain`) sobre el fondo del contenedor (sin cargar una segunda
 *   copia desenfocada, para no duplicar el peso).
 * - En escritorio (>= 640px) usa `desktopSrc` con `object-cover`.
 *
 * Se espera un contenedor `relative` con overflow oculto y la proporción
 * correspondiente (`aspect-[...]`).
 */
export default function CoverImage({
  desktopSrc,
  mobileSrc,
  alt,
  className = "",
  eager = false,
  sizes = "100vw",
  priority = false,
}: Props) {
  const desktop = normalizeImageUrl(desktopSrc) || normalizeImageUrl(mobileSrc);
  const mobile = normalizeImageUrl(mobileSrc);
  if (!desktop) return null;

  const desktopImg = getImageProps({
    src: desktop,
    alt,
    width: 1920,
    height: 1080,
    sizes,
    quality: 80,
    loading: eager ? "eager" : "lazy",
    priority,
  });

  const mobileImg = mobile
    ? getImageProps({
        src: mobile,
        alt,
        width: 1080,
        height: 1350,
        sizes,
        quality: 80,
        loading: eager ? "eager" : "lazy",
        priority,
      })
    : null;

  const imgClass = `absolute inset-0 h-full w-full ${
    mobile ? "object-cover" : "object-contain sm:object-cover"
  } ${className}`;

  const desktopProps = desktopImg.props as any;
  const mobileProps = mobileImg?.props as any;

  return (
    <picture>
      {mobile && mobileProps && <source media="(max-width: 639px)" srcSet={mobileProps.srcSet} sizes={sizes} />}
      <source media="(min-width: 640px)" srcSet={desktopProps.srcSet} sizes={sizes} />
      <img
        {...(mobile && mobileProps ? mobileProps : desktopProps)}
        alt={alt}
        className={imgClass}
        {...(priority ? { fetchPriority: "high" as any } : {})}
      />
    </picture>
  );
}
