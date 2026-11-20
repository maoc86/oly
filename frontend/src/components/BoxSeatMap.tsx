"use client";

import { Fragment, useMemo, useState } from "react";
import { TicketSeats, Seat } from "@/lib/types";
import { rowLabel } from "@/components/SeatMapEditor";
import { BoxLayout, boxLayoutToGrid, isValidBoxLayout } from "@/lib/boxLayout";

interface BoxSeatMapProps {
  block: TicketSeats;
  myUserId: number | null;
  mode: "box" | "seat";
  selected: Record<string, boolean>;
  /** Reserva/libera todas las sillas de un box (modo box completo). */
  onToggleBox: (seatIds: number[]) => void;
  /** Reserva/libera una silla concreta (modo por silla). */
  onToggleSeat: (seatId: number) => void;
}

function boxLabelFromKey(key: string): string {
  const [r, n] = key.split("-").map(Number);
  return `Box ${rowLabel(r)}${n}`;
}

export default function BoxSeatMap({
  block,
  myUserId,
  mode,
  selected,
  onToggleBox,
  onToggleSeat,
}: BoxSeatMapProps) {
  const tt = block.ticket_type;
  const color = tt.color || "#7c3aed";
  const [focused, setFocused] = useState<string | null>(null);

  // Agrupa las sillas por casilla del mapa: cada casilla es un box.
  const { rows, cols, boxes } = useMemo(() => {
    const map = new Map<string, Seat[]>();
    for (const s of block.seats) {
      const key = `${s.row}-${s.number}`;
      const arr = map.get(key);
      if (arr) arr.push(s);
      else map.set(key, [s]);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.seat_index - b.seat_index);
    return { rows: block.rows, cols: block.cols, boxes: map };
  }, [block]);

  const isMine = (s: Seat) => !!selected[`${tt.id}-${s.id}`];
  const isBlocked = (s: Seat) =>
    s.status === "occupied" || s.status === "blocked" || (s.status === "reserved" && s.reserved_by !== myUserId);

  const focusedSeats = focused ? boxes.get(focused) || [] : [];

  return (
    <div className="space-y-3">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto">
        <div
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `16px repeat(${cols}, var(--seat-size))` }}
        >
          <div />
          {Array.from({ length: cols }, (_, i) => (
            <div key={`h-${i}`} className="text-center text-[10px] text-gray-400 leading-6">
              {i + 1}
            </div>
          ))}
          {Array.from({ length: rows }, (_, r) => (
            <Fragment key={r}>
              <div className="text-[10px] text-gray-500 leading-6 text-center">{rowLabel(r + 1)}</div>
              {Array.from({ length: cols }, (_, c) => {
                const key = `${r + 1}-${c + 1}`;
                const seats = boxes.get(key);
                if (!seats || seats.length === 0) return <div key={c} className="w-[var(--seat-size)] h-[var(--seat-size)]" />;

                const mineCount = seats.filter(isMine).length;
                const blocked = seats.some(isBlocked);
                const allMine = mineCount === seats.length;
                const label = boxLabelFromKey(key);

                if (mode === "box") {
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={blocked}
                      aria-label={label}
                      title={`${label} · ${seats.length} sillas`}
                      onClick={() => onToggleBox(seats.map((s) => s.id))}
                      className="rounded-sm transition-transform hover:scale-110 disabled:hover:scale-100 disabled:cursor-not-allowed flex items-center justify-center text-[9px] font-semibold"
                      style={{
                        width: "var(--seat-size)",
                        height: "var(--seat-size)",
                        backgroundColor: allMine ? color : blocked ? "#e5e7eb" : `${color}55`,
                        border: `1px solid ${blocked ? "#d1d5db" : color}`,
                        color: allMine ? "#fff" : color,
                        opacity: blocked ? 0.6 : 1,
                      }}
                    >
                      {seats.length}
                    </button>
                  );
                }

                const isFocused = focused === key;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Ver ${label}`}
                    title={`${label} · ${mineCount}/${seats.length} elegidas`}
                    onClick={() => setFocused((prev) => (prev === key ? null : key))}
                    className="rounded-sm transition-transform hover:scale-110 flex items-center justify-center text-[9px] font-semibold"
                    style={{
                      width: "var(--seat-size)",
                      height: "var(--seat-size)",
                      backgroundColor: allMine ? color : mineCount > 0 ? `${color}99` : blocked ? "#e5e7eb" : `${color}33`,
                      border: `1px solid ${isFocused ? "#111827" : blocked ? "#d1d5db" : color}`,
                      color: allMine ? "#fff" : color,
                    }}
                  >
                    {mineCount > 0 ? `${mineCount}/${seats.length}` : seats.length}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {mode === "seat" && (
        focused && focusedSeats.length > 0 ? (
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-700 mb-2">
              {boxLabelFromKey(focused)} · elegí las sillas
            </p>
            {(() => {
              const gs = focusedSeats.length;
              const layout: BoxLayout = block.ticket_type.box_layout && isValidBoxLayout(block.ticket_type.box_layout, gs)
                ? block.ticket_type.box_layout
                : { top: 0, right: 0, bottom: gs, left: 0 };
              const byIndex = new Map<number, Seat>();
              focusedSeats.forEach((s) => byIndex.set(s.seat_index, s));
              const { rows, cols, grid } = boxLayoutToGrid(layout);
              return (
                <div className="flex justify-center overflow-x-auto">
                  <div
                    className="inline-grid gap-1.5 p-2 bg-gray-50 rounded-lg"
                    style={{ gridTemplateColumns: `repeat(${cols}, 40px)` }}
                  >
                    {grid.map((row, r) =>
                      row.map((cell, c) => {
                        if (cell.seatIndex == null) {
                          return <div key={`${r}-${c}`} className="w-10 h-10" />;
                        }
                        const s = byIndex.get(cell.seatIndex);
                        if (!s) {
                          return <div key={`${r}-${c}`} className="w-10 h-10" />;
                        }
                        const mine = isMine(s);
                        const blocked = isBlocked(s);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={blocked}
                            aria-label={`${boxLabelFromKey(focused)} silla ${s.seat_index}`}
                            title={`Silla ${s.seat_index}${blocked ? " (ocupada)" : ""}`}
                            onClick={() => onToggleSeat(s.id)}
                            className="w-10 h-10 rounded-md text-xs font-semibold flex items-center justify-center disabled:cursor-not-allowed transition-transform hover:scale-105"
                            style={{
                              backgroundColor: mine ? color : blocked ? "#e5e7eb" : `${color}22`,
                              border: `1px solid ${blocked ? "#d1d5db" : color}`,
                              color: mine ? "#fff" : blocked ? "#9ca3af" : color,
                              opacity: blocked ? 0.6 : 1,
                            }}
                          >
                            {s.seat_index}
                          </button>
                        );
                      }),
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Elegí un box en el mapa para ver y elegir sus sillas.</p>
        )
      )}

      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${color}55` }} />
          {mode === "box" ? "Box disponible" : "Box sin elegir"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
          {mode === "box" ? "Box seleccionado" : "Silla(s) elegida(s)"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b" }} />
          Reservado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#e5e7eb" }} />
          Ocupado
        </span>
      </div>
    </div>
  );
}
