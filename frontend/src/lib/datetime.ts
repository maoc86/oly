/**
 * El backend serializa las fechas en UTC sin zona horaria (naive). Sin agregar
 * "Z", `new Date()` las interpretaría como hora local y los countdowns de
 * reserva quedarían desfasados por el huso horario.
 */
export function parseServerDate(value: string): number {
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTz ? value : `${value}Z`).getTime();
}
