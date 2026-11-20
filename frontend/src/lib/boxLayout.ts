// Layout del box (mesa): perímetro con cabeceras (top/bottom) y lados (right/left).
// top + right + bottom + left === cantidad de sillas (group_size).

export interface BoxLayout {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function boxLayoutTotal(l: BoxLayout | null | undefined): number {
  if (!l) return 0;
  return (l.top || 0) + (l.right || 0) + (l.bottom || 0) + (l.left || 0);
}

export function isValidBoxLayout(l: BoxLayout | null | undefined, seatCount: number): l is BoxLayout {
  if (!l) return false;
  const parts = [l.top || 0, l.right || 0, l.bottom || 0, l.left || 0];
  return parts.every((x) => Number.isInteger(x) && x >= 0) && boxLayoutTotal(l) === seatCount && seatCount > 0;
}

// Mesa larga: sillas en los dos lados largos (sin cabeceras).
export function largaLayout(n: number): BoxLayout {
  const left = Math.ceil(n / 2);
  return { top: 0, right: n - left, bottom: 0, left };
}

// Mesa cuadrada: sillas repartidas en los 4 lados.
export function cuadradaLayout(n: number): BoxLayout {
  const base = Math.floor(n / 4);
  const rem = n % 4;
  return {
    top: base + (rem > 0 ? 1 : 0),
    right: base + (rem > 1 ? 1 : 0),
    bottom: base + (rem > 2 ? 1 : 0),
    left: base,
  };
}

// Mesa rectangular: una cabecera arriba, una abajo y el resto repartido en los lados.
export function rectangularLayout(n: number): BoxLayout {
  if (n <= 0) return { top: 0, right: 0, bottom: 0, left: 0 };
  const top = 1;
  const bottom = 1;
  const remaining = n - top - bottom;
  const left = Math.ceil(remaining / 2);
  return { top, right: remaining - left, bottom, left };
}

export type BoxLayoutPreset = "larga" | "cuadrada" | "rectangular";

export const BOX_PRESETS: { key: BoxLayoutPreset; label: string }[] = [
  { key: "larga", label: "Larga" },
  { key: "cuadrada", label: "Cuadrada" },
  { key: "rectangular", label: "Rectangular" },
];

export function presetLayout(key: BoxLayoutPreset, n: number): BoxLayout {
  if (key === "larga") return largaLayout(n);
  if (key === "cuadrada") return cuadradaLayout(n);
  return rectangularLayout(n);
}

// Convierte el layout a una grilla de posiciones (para renderear la mesa).
// Cada celda contiene el número de silla (seat_index) o null (espacio vacío / mesa).
// Orden de asignación (horario): cabecera superior → lado derecho → cabecera inferior → lado izquierdo.
export interface BoxGridCell {
  seatIndex: number | null;
}

export function boxLayoutToGrid(l: BoxLayout): { rows: number; cols: number; grid: BoxGridCell[][] } {
  const top = l.top || 0;
  const right = l.right || 0;
  const bottom = l.bottom || 0;
  const left = l.left || 0;

  const cols = Math.max(top, bottom) + 2; // columnas: borde izquierdo + cabeceras + borde derecho
  const rows = Math.max(left, right) + 2; // filas: cabecera superior + lados + cabecera inferior

  const grid: BoxGridCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ seatIndex: null })),
  );

  let idx = 1;

  // Cabecera superior (fila 0), centrada horizontalmente.
  const topStart = Math.floor((cols - 2 - top) / 2) + 1;
  for (let i = 0; i < top; i++) grid[0][topStart + i] = { seatIndex: idx++ };

  // Lado derecho (última columna), centrado verticalmente.
  const rightStart = Math.floor((rows - 2 - right) / 2) + 1;
  for (let i = 0; i < right; i++) grid[rightStart + i][cols - 1] = { seatIndex: idx++ };

  // Cabecera inferior (última fila), centrada horizontalmente.
  const bottomStart = Math.floor((cols - 2 - bottom) / 2) + 1;
  for (let i = 0; i < bottom; i++) grid[rows - 1][bottomStart + i] = { seatIndex: idx++ };

  // Lado izquierdo (columna 0), centrado verticalmente.
  const leftStart = Math.floor((rows - 2 - left) / 2) + 1;
  for (let i = 0; i < left; i++) grid[leftStart + i][0] = { seatIndex: idx++ };

  return { rows, cols, grid };
}
