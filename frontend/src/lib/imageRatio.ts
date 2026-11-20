/**
 * Utilidades de proporción de imagen (stub simplificado para la tienda).
 *
 * Mantiene la misma firma que usaba el panel de configuración de imágenes, pero
 * sin las validaciones de proporción (que eran específicas de los banners/heroes
 * de la plataforma de eventos). Devuelven `null` para no mostrar avisos.
 */

export interface ImageSize {
  width: number;
  height: number;
}

export function aspectRatio(size: ImageSize): number {
  if (!size || !size.height) return 0;
  return size.width / size.height;
}

export async function loadImageSize(_url: string): Promise<ImageSize | null> {
  return null;
}

export function ratioWarning(_size: ImageSize, _placement?: string): string | null {
  return null;
}

export function mobileRatioWarning(_size: ImageSize, _placement?: string): string | null {
  return null;
}
