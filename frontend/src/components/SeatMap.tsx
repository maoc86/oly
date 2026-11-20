"use client";

import { Fragment } from "react";
import { TicketSeats, Seat } from "@/lib/types";
import { rowLabel } from "@/components/SeatMapEditor";

interface SeatMapProps {
  ticketSeatsList: TicketSeats[];
  myUserId: number | null;
  selected: Record<string, boolean>;
  onToggle: (ticketTypeId: number, seatId: number) => void;
  boxMode?: boolean;
  boxSize?: number;
  showHeader?: boolean;
  /** Solo lectura: sin selección ni clics (para el panel del organizador). */
  readOnly?: boolean;
  /** Modo bloqueo: permite seleccionar y bloquear/desbloquear sillas. */
  blockMode?: boolean;
}

type Cell = Seat | null;

function buildGrid(rows: number, cols: number, seats: Seat[]): Cell[][] {
  const grid: Cell[][] = Array.from({ length: rows }, () => Array(cols).fill(null));
  for (const s of seats) {
    if (s.row >= 1 && s.row <= rows && s.number >= 1 && s.number <= cols) {
      grid[s.row - 1][s.number - 1] = s;
    }
  }
  return grid;
}

export default function SeatMap({ ticketSeatsList, myUserId, selected, onToggle, boxMode = false, boxSize = 1, readOnly = false, blockMode = false }: SeatMapProps) {
  const renderCell = (ts: TicketSeats, color: string, name: string, row: number, cell: Cell) => {
    if (!cell) {
      return <div key={row} className="w-[var(--seat-size)] h-[var(--seat-size)]" />;
    }
    const seatId = `${ts.ticket_type.id}-${cell.id}`;
    const isSelected = !readOnly && !!selected[seatId];
    const isBlocked = cell.status === "blocked";
    const occupied =
      cell.status === "occupied" ||
      (cell.status === "reserved" && myUserId !== null && cell.reserved_by !== myUserId);

    let backgroundColor = `${color}55`;
    let borderColor = color;
    if (isBlocked) {
      backgroundColor = "#9ca3af";
      borderColor = "#6b7280";
    } else if (cell.status === "occupied") {
      backgroundColor = "#e5e7eb";
      borderColor = "#d1d5db";
    } else if (isSelected) {
      backgroundColor = color;
    } else if (cell.status === "reserved") {
      backgroundColor = "#fef3c7";
      borderColor = "#f59e0b";
    }

    const label = boxMode ? `Box ${rowLabel(cell.row)}${cell.number}` : `${rowLabel(cell.row)}${cell.number}`;

    return (
      <button
        key={row}
        type="button"
        disabled={(occupied || isBlocked) && !blockMode}
        aria-label={`${name} ${label}`}
        title={label}
        onClick={readOnly && !blockMode ? undefined : () => onToggle(ts.ticket_type.id, cell.id)}
        className={`rounded-sm transition-transform ${
          readOnly && !blockMode ? "cursor-default" : "hover:scale-110 disabled:hover:scale-100 disabled:cursor-not-allowed"
        }`}
        style={{
          width: "var(--seat-size)",
          height: "var(--seat-size)",
          backgroundColor,
          border: `1px solid ${borderColor}`,
          opacity: occupied ? 0.6 : 1,
        }}
      />
    );
  };

  return (
    <div className="mt-6">
      {ticketSeatsList.length === 0 && (
        <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500">
          Mapa no disponible para este evento.
        </div>
      )}
      <div className="space-y-6">
        {ticketSeatsList.map((ts) => {
          const color = ts.ticket_type.color || "#7c3aed";
          const name = ts.ticket_type.name;
          const grid = buildGrid(ts.rows, ts.cols, ts.seats);
          return (
            <div key={ts.ticket_type.id} className="border border-gray-200 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-semibold text-gray-900">{name}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {boxMode
                    ? `${ts.free_count} box(es) disponibles · ${boxSize} entradas por box`
                    : `${ts.free_count} disponibles`}
                </span>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto">
                <div
                  className="inline-grid gap-1"
                  style={{ gridTemplateColumns: `16px repeat(${ts.cols}, var(--seat-size))` }}
                >
                  <div />
                  {Array.from({ length: ts.cols }, (_, i) => (
                    <div key={`h-${i}`} className="text-center text-[10px] text-gray-400 leading-6">
                      {i + 1}
                    </div>
                  ))}
                  {grid.map((row, rowIdx) => (
                    <Fragment key={rowIdx}>
                      <div className="text-[10px] text-gray-500 leading-6 text-center">{rowLabel(rowIdx + 1)}</div>
                      {row.map((cell, i) => renderCell(ts, color, name, i, cell))}
                    </Fragment>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${color}55` }} /> {boxMode ? "Box disponible" : "Disponible"}
                </span>
                {!readOnly && boxMode ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} /> Box seleccionado
                  </span>
                ) : !readOnly ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} /> Seleccionado
                  </span>
                ) : null}
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#fef3c7", border: "1px solid #f59e0b" }} /> Reservado
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#e5e7eb" }} /> Ocupado
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}