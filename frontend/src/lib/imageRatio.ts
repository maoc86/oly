/**
 * Proporciones recomendadas para las imágenes de portada y banners.
 *
 * Cada ubicación pide dos imágenes: una de **escritorio** y otra de **móvil**.
 *
 * - Escritorio: bandas horizontales (4:1 para portadas y banners, ~16:9 para el
 *   hero). El recorte es `object-cover`: una foto más alta que la banda se
 *   recorta arriba y abajo.
 * - Móvil: la pantalla es angosta, así que el hero pide una vertical (4:5) y las
 *   portadas/banners un 16:9. Si falta la imagen móvil se muestra la de
 *   escritorio completa (`object-contain`) sobre un fondo difuminado, así que no
 *   se recorta nada.
 */

export interface ImageSize {
  width: number;
  height: number;
}

interface RatioSpec {
  /** Proporción mínima aceptable sin avisar (ancho / alto). */
  min: number;
  /** Proporción a la que el recorte se ve perfecto. */
  ideal: number;
  /** Texto de la pista del campo de altura. */
  label: string;
}

export const PLACEMENT_RATIO: Record<string, RatioSpec> = {
  hero: {
    min: 1.5,
    ideal: 3.2,
    label: "portada ancha (1920×600)",
  },
  // Portada del evento: se muestra en tarjetas (home y /eventos), en el detalle
  // y en el admin. Se estandariza como banner horizontal 4:1 (1600×400).
  event: {
    min: 2.5,
    ideal: 4,
    label: "banner horizontal (1600×400 o más)",
  },
  banner: {
    min: 3,
    ideal: 4,
    label: "banda panorámica (1600×400 o más)",
  },
};

/** Proporciones ideales de la imagen de móvil (ancho / alto). */
export const MOBILE_RATIO: Record<string, { ideal: number; label: string }> = {
  hero: { ideal: 0.8, label: "vertical 4:5 (1080×1350)" },
  event: { ideal: 16 / 9, label: "horizontal 16:9 (1200×675)" },
  banner: { ideal: 16 / 9, label: "horizontal 16:9 (1200×675)" },
};

export function ratioSpec(placement: string): RatioSpec {
  return PLACEMENT_RATIO[placement] ?? PLACEMENT_RATIO.hero;
}

export function mobileRatioSpec(placement: string) {
  return MOBILE_RATIO[placement] ?? MOBILE_RATIO.hero;
}

/** Proporción de una imagen ya cargada en el navegador. */
export function aspectRatio(size: ImageSize): number {
  return size.height > 0 ? size.width / size.height : 0;
}

/** Avisa cuando la imagen es demasiado alta para la banda donde se va a mostrar. */
export function ratioWarning(size: ImageSize, placement: string): string | null {
  const spec = ratioSpec(placement);
  const ratio = aspectRatio(size);
  if (ratio <= 0 || ratio >= spec.min) return null;
  return `Esta imagen es de ${size.width}×${size.height} (proporción ${ratio.toFixed(2)}:1) y se va a recortar a ${spec.min}:1 o más. Se verá una franja del centro. Ideal para ${spec.label}.`;
}

/**
 * Avisa cuando la imagen de móvil se aleja de la proporción ideal. A diferencia
 * de `ratioWarning` (que solo se queja de fotos demasiado altas), aquí también
 * importa pasarse de ancha: en móvil el contenedor es más cuadrado, así que una
 * foto muy panorámica se recorta a los costados.
 */
export function mobileRatioWarning(size: ImageSize, placement: string): string | null {
  const spec = mobileRatioSpec(placement);
  const ratio = aspectRatio(size);
  if (ratio <= 0) return null;
  const lo = spec.ideal * 0.75;
  const hi = spec.ideal * 1.35;
  if (ratio >= lo && ratio <= hi) return null;
  const detalle = ratio < lo ? "demasiado vertical" : "demasiado panorámica";
  return `Esta imagen es de ${size.width}×${size.height} (proporción ${ratio.toFixed(2)}:1): ${detalle} para móvil y se recortará. Ideal ${spec.label}.`;
}

/** Lee el tamaño natural de una imagen desde el navegador. */
export function loadImageSize(url: string): Promise<ImageSize | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}