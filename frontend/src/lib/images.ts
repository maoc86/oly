/**
 * Normaliza una URL de imagen para que funcione en cualquier entorno.
 *
 * Las imágenes nuevas se guardan con URL relativa (`/uploads/...`) y se
 * proxean al backend vía el rewrite de Next. Las antiguas pueden ser
 * absolutas (`http://localhost:8000/uploads/...` o
 * `https://api.ticketve.com/uploads/...`); en ese caso extraemos el path
 * `/uploads/...` para que el optimizador de Next y el navegador resuelvan
 * la URL contra el host actual.
 */
export function normalizeImageUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const u = new URL(trimmed);
    const idx = u.pathname.indexOf("/uploads/");
    if (idx >= 0) return u.pathname.slice(idx);
    return trimmed;
  } catch {
    return trimmed;
  }
}
