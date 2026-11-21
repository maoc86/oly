/**
 * Utilidades de proporción de imagen para el panel de configuración.
 *
 * Cargan las dimensiones de una imagen en el navegador y validan que su
 * proporción se acerque a la recomendada para la ubicación (hero o banner).
 */

export interface ImageSize {
  width: number;
  height: number;
}

export function aspectRatio(size: ImageSize): number {
  if (!size || !size.height) return 0;
  return size.width / size.height;
}

export async function loadImageSize(url: string): Promise<ImageSize | null> {
  if (typeof window === "undefined" || typeof Image === "undefined") return null;
  if (!url) return null;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Proporción recomendada por ubicación (escritorio). */
function expectedRatio(placement: string): number {
  return placement === "hero" ? 1920 / 600 : 1600 / 400;
}

export function ratioWarning(size: ImageSize | null, placement: string): string | null {
  if (!size || !size.width || !size.height) return null;
  const ratio = size.width / size.height;
  const expected = expectedRatio(placement);
  const diff = Math.abs(ratio - expected) / expected;
  if (diff > 0.2) {
    return `La proporción ${ratio.toFixed(2)}:1 es distinta a la recomendada (${expected.toFixed(2)}:1).`;
  }
  return null;
}

export function mobileRatioWarning(size: ImageSize | null, placement: string): string | null {
  if (!size || !size.width || !size.height) return null;
  const ratio = size.width / size.height;
  const expected = placement === "hero" ? 4 / 5 : 16 / 9;
  const diff = Math.abs(ratio - expected) / expected;
  if (diff > 0.2) {
    return `La proporción móvil ${ratio.toFixed(2)}:1 es distinta a la recomendada (${expected.toFixed(2)}:1).`;
  }
  return null;
}
