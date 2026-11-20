"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import { api } from "@/lib/api";
import { Button, Input } from "@/components/ui";
import { MapCell, TicketMap } from "@/lib/types";
import { Map as MapIcon, Save, RefreshCw } from "lucide-react";

export function rowLabel(row: number): string {
  return String.fromCharCode(64 + row);
}

export function seatLabel(seat: { row: number; number: number }): string {
  return `${rowLabel(seat.row)}${seat.number}`;
}

const LOCK_COLOR = "#d1d5db";
const ACTIVE_COLOR = "#7c3aed";
const EMPTY_COLOR = "#f3f4f6";

interface SeatMapEditorProps {
  eventId: number;
  ticketTypeId: number;
  onSaved?: () => void;
}

export default function SeatMapEditor({ eventId, ticketTypeId, onSaved }: SeatMapEditorProps) {
  const [map, setMap] = useState<TicketMap | null>(null);
  const [rows, setRows] = useState<string>("");
  const [cols, setCols] = useState<string>("");
  const [active, setActive] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const applyMap = (data: TicketMap) => {
    setMap(data);
    setRows(String(data.rows));
    setCols(String(data.cols));
    const a = new Set<string>();
    for (const cell of data.cells) if (cell.has_seat) a.add(`${cell.row},${cell.col}`);
    setActive(a);
  };

  useEffect(() => {
    let cancelled = false;
    api
      .get<TicketMap>(`/admin/events/${eventId}/tickets/${ticketTypeId}/map`)
      .then((data) => {
        if (!cancelled) applyMap(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar el mapa");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketTypeId]);

  const isLocked = (cell: MapCell) => cell.has_seat && (cell.status === "reserved" || cell.status === "occupied");

  async function reload() {
    setLoading(true);
    setError("");
    try {
      const data = await api.get<TicketMap>(`/admin/events/${eventId}/tickets/${ticketTypeId}/map`);
      applyMap(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el mapa");
    } finally {
      setLoading(false);
    }
  }

  const cells = useMemo(() => {
    const rowsNum = Math.max(1, Number(rows) || 1);
    const colsNum = Math.max(1, Number(cols) || 1);
    const byKey = new Map<string, MapCell>();
    if (map) for (const cell of map.cells) byKey.set(`${cell.row},${cell.col}`, cell);
    const out: MapCell[] = [];
    for (let row = 1; row <= rowsNum; row++) {
      for (let col = 1; col <= colsNum; col++) {
        const existing = byKey.get(`${row},${col}`);
        out.push(
          existing ?? {
            row,
            col,
            has_seat: false,
            seat_id: null,
            status: null,
            reserved_by: null,
            reserved_until: null,
          }
        );
      }
    }
    return out;
  }, [rows, cols, map]);

  function toggleCell(cell: MapCell) {
    const key = `${cell.row},${cell.col}`;
    if (isLocked(cell)) return;
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const activeList: [number, number][] = [];
    for (const key of active) {
      const [r, c] = key.split(",").map(Number);
      activeList.push([r, c]);
    }
    try {
      const data = await api.put<TicketMap>(`/admin/events/${eventId}/tickets/${ticketTypeId}/map`, {
        rows: Math.max(1, Number(rows) || 1),
        cols: Math.max(1, Number(cols) || 1),
        active: activeList,
      });
      setMap(data);
      setRows(String(data.rows));
      setCols(String(data.cols));
      const a = new Set<string>();
      for (const cell of data.cells) if (cell.has_seat) a.add(`${cell.row},${cell.col}`);
      setActive(a);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el mapa");
    } finally {
      setSaving(false);
    }
  }

  function renderCells() {
    const r = Math.max(1, Number(rows) || 1);
    const cc = Math.max(1, Number(cols) || 1);
    return (
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `16px repeat(${cc}, 24px)` }}>
        <div />
        {Array.from({ length: cc }, (_, i) => (
          <div key={`h-${i}`} className="text-center text-[10px] text-gray-400 leading-6">
            {i + 1}
          </div>
        ))}
        {Array.from({ length: r }, (_, rowIdx) => {
          const row = rowIdx + 1;
          return (
            <Fragment key={row}>
              <div className="text-[10px] text-gray-500 leading-6 text-center">{rowLabel(row)}</div>
              {Array.from({ length: cc }, (_, colIdx) => {
                const col = colIdx + 1;
                const cell = cells.find((c) => c.row === row && c.col === col);
                if (!cell) return <div key={col} className="w-6 h-6" />;
                const on = active.has(`${cell.row},${cell.col}`);
                const locked = isLocked(cell);
                let bg = EMPTY_COLOR;
                if (locked) bg = LOCK_COLOR;
                else if (on) bg = ACTIVE_COLOR;
                return (
                  <button
                    key={col}
                    type="button"
                    disabled={locked}
                    onClick={() => toggleCell(cell)}
                    className="w-6 h-6 rounded-sm transition-transform hover:scale-110 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    style={{ backgroundColor: bg, border: `1px solid ${on ? ACTIVE_COLOR : "#d1d5db"}` }}
                    title={on ? seatLabel({ row, number: col }) : "(vacío)"}
                    aria-label={on ? seatLabel({ row, number: col }) : `Celda ${rowLabel(row)}${col} vacía`}
                  />
                );
              })}
            </Fragment>
          );
        })}
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-sm text-gray-400">Cargando mapa...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <MapIcon className="w-4 h-4" /> {map?.name || "Mapa"}
        </div>
        <div className="text-xs text-gray-400">{active.size} asiento(s)</div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex items-end gap-3">
        <Input
          label="Filas"
          type="number"
          min="1"
          value={rows}
          onChange={(e) => setRows(e.target.value)}
        />
        <Input
          label="Asientos por fila"
          type="number"
          min="1"
          value={cols}
          onChange={(e) => setCols(e.target.value)}
        />
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-x-auto">
        {renderCells()}
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: ACTIVE_COLOR }} /> Asiento activo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-gray-300" style={{ backgroundColor: EMPTY_COLOR }} /> Vacío
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: LOCK_COLOR }} /> Bloqueado (reservado/ocupado)
        </span>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={reload}>
          <RefreshCw className="w-4 h-4" /> Recargar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar mapa"}
        </Button>
      </div>
    </div>
  );
}