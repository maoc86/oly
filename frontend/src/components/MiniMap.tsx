"use client";

import { TicketSeats, Seat, TicketType } from "@/lib/types";

export interface ZoneLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EventMapConfig {
  stages: ZoneLayout[];
  zones: Record<string, ZoneLayout>;
  dead: ZoneLayout[];
}

export function defaultStage(): ZoneLayout {
  return { x: 25, y: 2, w: 50, h: 8 };
}

/**
 * Distribuye las claves en una grilla de 2 columnas dentro del lienzo (16/9).
 * Devuelve Record<string, ZoneLayout> con las claves como string.
 */
export function defaultZoneLayouts(keys: (string | number)[]): Record<string, ZoneLayout> {
  const n = keys.length || 1;
  const cols = n <= 2 ? n : 2;
  const rows = Math.ceil(n / cols);
  const cellW = 90 / cols;
  const cellH = 80 / rows;
  const out: Record<string, ZoneLayout> = {};
  keys.forEach((id, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    out[String(id)] = {
      x: 5 + c * cellW,
      y: 17 + r * cellH,
      w: cellW - 4,
      h: cellH - 4,
    };
  });
  return out;
}

/** Normaliza cualquier map_config guardado (nuevo o legacy {stage, zones}) a EventMapConfig. */
export function normalizeMapConfig(raw: Record<string, unknown> | null | undefined): EventMapConfig {
  const cfg = raw as Partial<EventMapConfig> | null | undefined;
  const legacyStage = (cfg as unknown as { stage?: ZoneLayout } | undefined)?.stage;
  const stages = Array.isArray(cfg?.stages) && cfg!.stages!.length
    ? cfg!.stages!
    : legacyStage
      ? [legacyStage]
      : [defaultStage()];
  const zones = cfg?.zones && typeof cfg.zones === "object" ? { ...cfg.zones } : {};
  const dead = Array.isArray(cfg?.dead) ? [...cfg.dead] : [];
  return { stages, zones, dead };
}

interface ZoneGrid {
  rows: number;
  cols: number;
  seats: Seat[];
}

/** Margen (en celdas) alrededor de los asientos para que no toquen el borde del área. */
const VIEW_PAD = 0.35;
/** Separación entre asientos dentro de la grilla. */
const SEAT_PAD = 0.12;

interface MiniMapProps {
  ticketTypes: TicketType[];
  ticketSeatsList: TicketSeats[];
  mapConfig?: Record<string, unknown> | null;
  onSelectArea: (ticketTypeId: number) => void;
  /** Muestra un esqueleto mientras cargan los asientos. */
  loading?: boolean;
  /** Id del área a la que se hizo zoom (null = mapa completo). */
  focusedAreaId?: number | null;
  /** Vuelve al mapa completo (quita el zoom). */
  onResetFocus?: () => void;
  /** Asientos elegidos, con clave `${ticketTypeId}-${seatId}`. */
  selectedSeats?: Record<string, boolean>;
  /** Usuario actual: distingue reservas propias de las ajenas. */
  myUserId?: number | null;
  /** Formatea el precio base (USD) en la moneda activa. */
  formatPrice?: (amount: number) => string;
}

function isOnSale(t: TicketType, now: Date): boolean {
  if (t.sale_start && now < new Date(t.sale_start)) return false;
  if (t.sale_end && now > new Date(t.sale_end)) return false;
  return true;
}

export default function MiniMap({
  ticketTypes,
  ticketSeatsList,
  mapConfig,
  onSelectArea,
  loading = false,
  focusedAreaId = null,
  onResetFocus,
  selectedSeats = {},
  myUserId = null,
  formatPrice,
}: MiniMapProps) {
  const format = formatPrice ?? ((v: number) => String(v));

  const zoneGrids: Record<number, ZoneGrid> = {};
  for (const ts of ticketSeatsList) {
    const id = ts.ticket_type.id;
    const g = zoneGrids[id] ?? (zoneGrids[id] = { rows: 0, cols: 0, seats: [] });
    g.seats.push(...ts.seats);
    g.rows = Math.max(g.rows, ts.rows);
    g.cols = Math.max(g.cols, ts.cols);
  }

  const cfg = normalizeMapConfig(mapConfig);
  const hasSavedZones = cfg.zones && Object.keys(cfg.zones).length > 0;
  const layouts = hasSavedZones
    ? cfg.zones
    : defaultZoneLayouts(ticketTypes.map((t) => String(t.id)));

  const areas = ticketTypes.filter((t) => {
    const g = zoneGrids[t.id];
    const hasSeats = g && g.rows > 0 && g.cols > 0;
    const hasStock = (t.total_stock || 0) - (t.sold_stock || 0) - (t.guest_stock || 0) > 0;
    return !!layouts[String(t.id)] && (hasSeats || hasStock);
  });

  if (loading) {
    return (
      <div
        className="w-full rounded-2xl border border-gray-100 bg-gray-50 animate-pulse min-h-[280px] sm:min-h-0"
        style={{ aspectRatio: "16/9" }}
        aria-hidden
      />
    );
  }

  if (areas.length === 0) {
    return (
      <div className="border border-dashed border-gray-300 rounded-2xl p-8 text-center text-sm text-gray-500">
        Mapa no disponible para este evento.
      </div>
    );
  }

  // Zoom a la sección elegida (centra y amplía el área enfocada).
  const focusLayout = focusedAreaId != null ? layouts[String(focusedAreaId)] : undefined;
  const scale = focusLayout ? Math.min(100 / focusLayout.w, 100 / focusLayout.h) * 0.82 : 1;
  const tx = focusLayout ? 50 - (focusLayout.x + focusLayout.w / 2) * scale : 0;
  const ty = focusLayout ? 50 - (focusLayout.y + focusLayout.h / 2) * scale : 0;
  // Mantiene las etiquetas legibles (tamaño fijo en pantalla) aunque el mapa esté ampliado.
  const uiScale = scale > 1 ? 1 / scale : 1;

  const now = new Date();

  return (
    <div>
      <div
        className="relative w-full border border-gray-200 rounded-2xl bg-gradient-to-b from-gray-50 to-gray-100 overflow-hidden min-h-[280px] sm:min-h-0"
        style={{ aspectRatio: "16/9" }}
      >
        <div
          className="absolute inset-0 transition-transform duration-500 ease-out"
          style={{ transformOrigin: "0 0", transform: `translate(${tx}%, ${ty}%) scale(${scale})` }}
        >
          {/* Escenario(s) */}
          {cfg.stages.map((st, i) => (
            <div
              key={i}
              className="absolute bg-gradient-to-b from-gray-800 to-gray-700 rounded-t-lg flex items-center justify-center text-white text-sm font-semibold"
              style={{ left: `${st.x}%`, top: `${st.y}%`, width: `${st.w}%`, height: `${st.h}%` }}
            >
              <span className="px-2 truncate">{cfg.stages.length > 1 ? `Escenario ${i + 1}` : "Escenario"}</span>
            </div>
          ))}

          {/* Zonas muertas */}
          {cfg.dead.map((z, i) => (
            <div
              key={`dead-${i}`}
              className="absolute rounded-lg flex items-center justify-center select-none"
              style={{
                left: `${z.x}%`,
                top: `${z.y}%`,
                width: `${z.w}%`,
                height: `${z.h}%`,
                backgroundColor: "rgba(107,114,128,0.18)",
                border: "1px dashed #9ca3af",
                color: "#6b7280",
              }}
            >
              <span className="text-xs font-semibold">Zona muerta</span>
            </div>
          ))}

          {/* Áreas con su forma interna real (asientos programados) */}
          {areas.map((t) => {
            const layout = layouts[String(t.id)];
            const g = zoneGrids[t.id];
            const seats = g?.seats ?? [];
            const color = t.color || "#7c3aed";
            const available = Math.max(0, (t.total_stock || 0) - (t.sold_stock || 0) - (t.guest_stock || 0));
            const soldOut = available <= 0;
            const onSale = isOnSale(t, now);
            // Áreas por box: mostrar "desde <precio por silla>" como gancho de marketing.
            const hasIndividual = Math.max(1, t.group_size || 1) > 1 && t.individual_price != null;
            const displayPrice = hasIndividual ? Number(t.individual_price) : Number(t.price);

            // En áreas tipo box varias sillas comparten la misma celda (row/number):
            // se agrupan para dibujar una sola casilla por celda del mapa.
            const cells = new Map<string, { row: number; number: number; seats: Seat[] }>();
            for (const s of seats) {
              const key = `${s.row}-${s.number}`;
              const cell = cells.get(key) ?? { row: s.row, number: s.number, seats: [] };
              cell.seats.push(s);
              cells.set(key, cell);
            }
            const cellList = Array.from(cells.values());
            const selectedCount = cellList.filter((c) =>
              c.seats.some((s) => selectedSeats[`${t.id}-${s.id}`])
            ).length;
            const isFocused = focusedAreaId === t.id;

            let minRow = Infinity;
            let maxRow = -Infinity;
            let minCol = Infinity;
            let maxCol = -Infinity;
            for (const c of cellList) {
              if (c.row < minRow) minRow = c.row;
              if (c.row > maxRow) maxRow = c.row;
              if (c.number < minCol) minCol = c.number;
              if (c.number > maxCol) maxCol = c.number;
            }
            const hasSeats = cellList.length > 0 && Number.isFinite(minRow);
            const rows = hasSeats ? maxRow - minRow + 1 : Math.max(1, t.map_rows || 1);
            const cols = hasSeats ? maxCol - minCol + 1 : Math.max(1, t.map_cols || 1);

            // Tramos contiguos por fila: la silueta respeta los huecos del mapa.
            const spans: { row: number; start: number; end: number }[] = [];
            const numsByRow = new Map<number, number[]>();
            for (const c of cellList) {
              const arr = numsByRow.get(c.row) ?? [];
              arr.push(c.number);
              numsByRow.set(c.row, arr);
            }
            for (const [row, nums] of numsByRow) {
              nums.sort((a, b) => a - b);
              let start = nums[0];
              let prev = nums[0];
              for (let i = 1; i < nums.length; i++) {
                const n = nums[i];
                if (n === prev + 1) {
                  prev = n;
                  continue;
                }
                spans.push({ row, start, end: prev });
                start = n;
                prev = n;
              }
              spans.push({ row, start, end: prev });
            }

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectArea(t.id)}
                title={`${t.name} · ${soldOut ? "Agotado" : `${available} disponibles`} · ${hasIndividual ? "desde " : ""}${format(displayPrice)}`}
                className={`absolute group rounded-lg border text-left transition-shadow hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 ${
                  isFocused ? "ring-2 ring-brand-500" : ""
                }`}
                style={{
                  left: `${layout.x}%`,
                  top: `${layout.y}%`,
                  width: `${layout.w}%`,
                  height: `${layout.h}%`,
                  backgroundColor: `${color}12`,
                  borderColor: `${color}80`,
                  color,
                }}
              >
                {hasSeats && (
                  <svg
                    viewBox={`${-VIEW_PAD} ${-VIEW_PAD} ${cols + VIEW_PAD * 2} ${rows + VIEW_PAD * 2}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    aria-hidden
                  >
                    {/* Silueta por tramos: sigue la forma programada (respeta huecos).
                        Se mantiene visible también en móvil para conservar la forma. */}
                    {spans.map((s, i) => (
                      <rect
                        key={`span-${i}`}
                        x={s.start - minCol}
                        y={s.row - minRow}
                        width={s.end - s.start + 1}
                        height={1}
                        rx={0.28}
                        fill={`${color}26`}
                        stroke={`${color}55`}
                        strokeWidth={0.05}
                      />
                    ))}
                    {/* Asientos reales con su estado. En móvil se ocultan (quedan
                        de 1-2 px y parecen puntos); el detalle se ve en el modal. */}
                    <g className="hidden sm:block">
                      {cellList.map((c) => {
                        const anySelected = c.seats.some((s) => selectedSeats[`${t.id}-${s.id}`]);
                        const anyOccupied = c.seats.some((s) => s.status === "occupied");
                        const anyBlocked = c.seats.some((s) => s.status === "blocked");
                        const anyReservedOther = c.seats.some(
                          (s) => s.status === "reserved" && s.reserved_by !== myUserId
                        );
                        let fill = `${color}b0`;
                        if (anyOccupied || anyBlocked) fill = "#d1d5db";
                        else if (anySelected) fill = color;
                        else if (anyReservedOther) fill = "#f59e0b";
                        return (
                          <rect
                            key={`${c.row}-${c.number}`}
                            x={c.number - minCol + SEAT_PAD}
                            y={c.row - minRow + SEAT_PAD}
                            width={1 - SEAT_PAD * 2}
                            height={1 - SEAT_PAD * 2}
                            rx={0.18}
                            fill={fill}
                          />
                        );
                      })}
                    </g>
                  </svg>
                )}

                {/* Nombre de la sección */}
                <div
                  className="absolute inset-x-0 bottom-0 flex justify-center p-1 pointer-events-none"
                  style={{ transform: `scale(${uiScale})`, transformOrigin: "center bottom" }}
                >
                  <span
                    className="max-w-full truncate text-[10px] sm:text-[11px] font-bold bg-white/85 rounded px-1.5 py-0.5 shadow-sm"
                    style={{ color }}
                  >
                    {t.name}
                  </span>
                </div>

                {/* Precio por zona */}
                {!soldOut && onSale && (
                  <div
                    className="absolute inset-x-0 top-0 flex justify-center p-1 pointer-events-none"
                    style={{ transform: `scale(${uiScale})`, transformOrigin: "center top" }}
                  >
                    <span className="text-[9px] sm:text-[10px] font-semibold bg-white/80 rounded px-1.5 py-0.5 shadow-sm" style={{ color }}>
                      {hasIndividual ? "desde " : ""}{format(displayPrice)}
                    </span>
                  </div>
                )}

                {/* Contador de elegidas */}
                {selectedCount > 0 && (
                  <div
                    className="absolute top-1 right-1 pointer-events-none"
                    style={{ transform: `scale(${uiScale})`, transformOrigin: "top right" }}
                  >
                    <span className="text-[9px] font-bold text-white bg-brand-600 rounded-full px-1.5 py-0.5">
                      {selectedCount}
                    </span>
                  </div>
                )}

                {soldOut && (
                  <div className="absolute inset-0 rounded-lg bg-black/45 flex items-center justify-center">
                    <span
                      className="text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded-full"
                      style={{ transform: `scale(${uiScale})` }}
                    >
                      Agotado
                    </span>
                  </div>
                )}
                {!soldOut && !onSale && (
                  <div className="absolute inset-0 rounded-lg bg-white/65 flex items-center justify-center">
                    <span
                      className="text-gray-600 text-xs font-semibold bg-white/80 px-2 py-1 rounded-full"
                      style={{ transform: `scale(${uiScale})` }}
                    >
                      Venta no disponible
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {focusLayout && onResetFocus && (
          <button
            type="button"
            onClick={onResetFocus}
            className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 text-xs font-semibold bg-white/90 text-gray-700 rounded-full px-3 py-1.5 shadow hover:bg-white"
          >
            ← Ver mapa completo
          </button>
        )}
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-brand-500/70" /> Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#f59e0b" }} /> Reservado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#d1d5db" }} /> Ocupado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-brand-700" /> Elegido
        </span>
        <span className="text-gray-400">Tocá una sección para ver y elegir sus asientos.</span>
      </div>
    </div>
  );
}
