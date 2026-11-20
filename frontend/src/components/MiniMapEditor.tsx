"use client";

import { useEffect, useMemo, useState } from "react";
import { TicketMap } from "@/lib/types";
import { api } from "@/lib/api";
import { defaultStage, defaultZoneLayouts, normalizeMapConfig, ZoneLayout } from "@/components/MiniMap";
import { Button } from "@/components/ui";
import { Save, RefreshCw, Plus, Eye, EyeOff, X, Trash2 } from "lucide-react";

interface AreaInput {
  id?: number;
  event_id: number;
  name: string;
  group_size?: number;
  map_rows?: number;
  map_cols?: number;
  color?: string;
  clientKey?: string;
}

interface MiniMapEditorProps {
  ticketTypes: AreaInput[];
  value: Record<string, unknown> | null | undefined;
  onChange: (config: Record<string, unknown>) => void;
}

type Corner = "nw" | "ne" | "sw" | "se";
type Mode = "move" | Corner;

const MIN_W = 8;
const MIN_H = 5;

export default function MiniMapEditor({ ticketTypes, value, onChange }: MiniMapEditorProps) {
  const normalized = normalizeMapConfig(value);

  const keyOf = (t: AreaInput, index: number) => String(t.id ?? t.clientKey ?? `__new_${index}`);
  const keys = ticketTypes.map(keyOf);

  // Disposición por defecto para áreas nuevas (sin layout todavía)
  const defaults = useMemo(() => defaultZoneLayouts(keys), [keys]);

  const [stages, setStages] = useState<ZoneLayout[]>(() => normalized.stages);
  const [layouts, setLayouts] = useState<Record<string, ZoneLayout>>(() => {
    const l = { ...normalized.zones };
    for (const k of keys) if (!l[k] && defaults[k]) l[k] = defaults[k];
    return l;
  });
  const [dead, setDead] = useState<ZoneLayout[]>(() => normalized.dead);

  const [seatMaps, setSeatMaps] = useState<Record<number, TicketMap>>({});

  useEffect(() => {
    const savedIds = ticketTypes
      .filter((t) => t.id)
      .map((t) => t.id!);
    if (savedIds.length === 0) return;

    let cancelled = false;
    Promise.all(
      savedIds.map((ttId) =>
        api.get<TicketMap>(`/admin/events/${ticketTypes[0].event_id}/tickets/${ttId}/map`).catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const maps: Record<number, TicketMap> = {};
      results.forEach((m, i) => { if (m) maps[savedIds[i]] = m; });
      setSeatMaps(maps);
    });
    return () => { cancelled = true; };
  }, [ticketTypes]);

  function handleStart(
    e: React.PointerEvent<HTMLDivElement>,
    orig: ZoneLayout,
    apply: (patch: Partial<ZoneLayout>) => void,
    mode: Mode
  ) {
    e.preventDefault();
    e.stopPropagation();
    const container = document.getElementById("minimap-canvas");
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const startX = ((e.clientX - rect.left) / rect.width) * 100;
    const startY = ((e.clientY - rect.top) / rect.height) * 100;

    const onMove = (ev: PointerEvent) => {
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      const y = ((ev.clientY - rect.top) / rect.height) * 100;
      const dx = x - startX;
      const dy = y - startY;

      if (mode === "move") {
        const nx = Math.max(0, Math.min(100 - orig.w, orig.x + dx));
        const ny = Math.max(0, Math.min(100 - orig.h, orig.y + dy));
        apply({ x: nx, y: ny });
      } else {
        let nx = orig.x;
        let ny = orig.y;
        let nw = orig.w;
        let nh = orig.h;
        if (mode.includes("e")) nw = orig.w + dx;
        if (mode.includes("s")) nh = orig.h + dy;
        if (mode.includes("w")) {
          nw = orig.w - dx;
          nx = orig.x + dx;
        }
        if (mode.includes("n")) {
          nh = orig.h - dy;
          ny = orig.y + dy;
        }
        nw = Math.max(MIN_W, Math.min(100 - nx, nw));
        nh = Math.max(MIN_H, Math.min(100 - ny, nh));
        apply({ x: nx, y: ny, w: nw, h: nh });
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const cornerStyle: Record<Corner, React.CSSProperties> = {
    nw: { left: -3, top: -3 },
    ne: { right: -3, top: -3 },
    sw: { left: -3, bottom: -3 },
    se: { right: -3, bottom: -3 },
  };
  const cornerCursor: Record<Corner, string> = {
    nw: "nwse-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    se: "nwse-resize",
  };

  const renderHandles = (orig: ZoneLayout, apply: (patch: Partial<ZoneLayout>) => void) => (
    <>
      {(["nw", "ne", "sw", "se"] as Corner[]).map((corner) => (
        <div
          key={corner}
          onPointerDown={(e) => handleStart(e, orig, apply, corner)}
          className="absolute w-3 h-3 bg-white border border-gray-400 rounded-sm shadow-sm"
          style={{ ...cornerStyle[corner], cursor: cornerCursor[corner], touchAction: "none" }}
        />
      ))}
    </>
  );

  function reset() {
    setStages([defaultStage()]);
    setDead([]);
    setLayouts({ ...defaults });
  }

  function save() {
    const zones: Record<string, ZoneLayout> = {};
    for (const k of keys) if (layouts[k]) zones[k] = layouts[k];
    onChange({ stages, zones, dead });
  }

  if (ticketTypes.length === 0) {
    return <p className="text-sm text-gray-400">No hay entradas configuradas para este evento.</p>;
  }

  const applyStage = (i: number, patch: Partial<ZoneLayout>) =>
    setStages((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const applyDead = (i: number, patch: Partial<ZoneLayout>) =>
    setDead((prev) => prev.map((z, j) => (j === i ? { ...z, ...patch } : z)));

  const toggleVisibility = (key: string) => {
    setLayouts((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else if (defaults[key]) {
        next[key] = defaults[key];
      }
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs text-gray-500">
          Arrastrá cada elemento para moverlo y usá las asas para redimensionarlo. El escenario y las zonas muertas no son
          compra desde el mapa.
        </p>
        <div className="flex gap-1.5">
          <Button variant="secondary" onClick={() => setStages((p) => [...p, defaultStage()])}>
            <Plus className="w-4 h-4" /> Escenario
          </Button>
          <Button variant="secondary" onClick={() => setDead((p) => [...p, { x: 10, y: 25, w: 20, h: 14 }])}>
            <Plus className="w-4 h-4" /> Zona muerta
          </Button>
        </div>
      </div>

      <div
        id="minimap-canvas"
        className="relative w-full border border-gray-300 rounded-2xl bg-gradient-to-b from-gray-50 to-gray-100 overflow-hidden touch-none"
        style={{ aspectRatio: "16/9", minHeight: 360 }}
      >
        {/* Escenario(s) */}
        {stages.map((st, i) => (
          <div
            key={`stage-${i}`}
            onPointerDown={(e) => handleStart(e, st, (p) => applyStage(i, p), "move")}
            className="absolute bg-gradient-to-b from-gray-800 to-gray-700 rounded-t-lg flex items-center justify-center text-white text-sm font-semibold cursor-grab active:cursor-grabbing select-none"
            style={{ left: `${st.x}%`, top: `${st.y}%`, width: `${st.w}%`, height: `${st.h}%` }}
          >
            <span className="pointer-events-none">{stages.length > 1 ? `Escenario ${i + 1}` : "Escenario"}</span>
            {stages.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setStages((p) => p.filter((_, j) => j !== i)); }}
                className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600"
                title="Quitar escenario"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            {renderHandles(st, (p) => applyStage(i, p))}
          </div>
        ))}

        {/* Zonas muertas */}
        {dead.map((z, i) => (
          <div
            key={`dead-${i}`}
            onPointerDown={(e) => handleStart(e, z, (p) => applyDead(i, p), "move")}
            className="absolute rounded-lg flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
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
            <span className="pointer-events-none text-xs font-semibold">Zona muerta</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDead((p) => p.filter((_, j) => j !== i)); }}
              className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600"
              title="Quitar zona muerta"
            >
              <X className="w-3 h-3" />
            </button>
            {renderHandles(z, (p) => applyDead(i, p))}
          </div>
        ))}

        {/* Áreas (ticket types) */}
        {ticketTypes.map((t, idx) => {
          const key = keyOf(t, idx);
          const layout = layouts[key];
          if (!layout) return null;
          const color = t.color || "#7c3aed";
          const map = seatMaps[t.id ?? -1];
          const cols = map?.cols || t.map_cols || 14;
          const rows = map?.rows || t.map_rows || 12;
          const activeSet = new Set<string>();
          if (map) {
            for (const cell of map.cells) if (cell.has_seat) activeSet.add(`${cell.row},${cell.col}`);
          }
          const apply = (patch: Partial<ZoneLayout>) =>
            setLayouts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
          return (
            <div
              key={key}
              onPointerDown={(e) => handleStart(e, layout, apply, "move")}
              className="absolute rounded-lg border cursor-grab active:cursor-grabbing select-none"
              style={{
                left: `${layout.x}%`,
                top: `${layout.y}%`,
                width: `${layout.w}%`,
                height: `${layout.h}%`,
                backgroundColor: `${color}44`,
                borderColor: color,
                color: color,
              }}
            >
              {map ? (
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div
                    className="grid gap-[1px] overflow-hidden rounded-sm"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, 1fr)`,
                      gridTemplateRows: `repeat(${rows}, 1fr)`,
                      aspectRatio: `${cols} / ${rows}`,
                    }}
                  >
                    {Array.from({ length: rows }, (_, r) =>
                      Array.from({ length: cols }, (_, c) => (
                        <div
                          key={`${r}-${c}`}
                          style={{ backgroundColor: activeSet.has(`${r + 1},${c + 1}`) ? `${color}b0` : "rgba(0,0,0,0)" }}
                        />
                      ))
                    )}
                  </div>
                </div>
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center font-bold text-sm pointer-events-none">
                {t.name}
                <span className="ml-1 text-[10px] font-medium opacity-70">({t.group_size || 1} plazas)</span>
              </div>
              {renderHandles(layout, apply)}
            </div>
          );
        })}
      </div>

      {/* Selector de zonas visibles */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Trash2 className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-600 mr-1">Áreas en el mapa:</span>
        {ticketTypes.map((t, idx) => {
          const key = keyOf(t, idx);
          const visible = !!layouts[key];
          const color = t.color || "#7c3aed";
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleVisibility(key)}
              title={visible ? "Ocultar del mapa" : "Mostrar en el mapa"}
              className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border transition ${
                visible ? "border-gray-300 bg-white text-gray-700 hover:border-gray-400" : "border-dashed border-gray-300 bg-gray-100 text-gray-400 line-through hover:bg-gray-200"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              {t.name}
              {visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={reset}>
          <RefreshCw className="w-4 h-4" /> Restablecer
        </Button>
        <Button onClick={save}>
          <Save className="w-4 h-4" /> Guardar disposición
        </Button>
      </div>
    </div>
  );
}