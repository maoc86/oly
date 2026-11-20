"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { PosEvent } from "./types";

/** Evento elegido por el vendedor: se recuerda entre las pestañas del panel. */
const EVENT_KEY = "pos_event_id";

export function loadPosEventId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(EVENT_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isNaN(n) ? null : n;
}

export function savePosEventId(id: number | null) {
  if (typeof window === "undefined") return;
  if (id == null) window.localStorage.removeItem(EVENT_KEY);
  else window.localStorage.setItem(EVENT_KEY, String(id));
}

/**
 * Eventos que el vendedor puede atender, con el seleccionado persistido.
 * Si el guardado ya no existe (lo desasignaron), se cae al primero.
 */
export function usePosEvents() {
  const [events, setEvents] = useState<PosEvent[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<PosEvent[]>("/pos/events")
      .then((list) => {
        setEvents(list);
        const saved = loadPosEventId();
        const valid = saved != null && list.some((e) => e.id === saved) ? saved : list[0]?.id ?? null;
        setSelectedId(valid);
        if (valid != null) savePosEventId(valid);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  function select(id: number | null) {
    setSelectedId(id);
    savePosEventId(id);
  }

  return { events, selectedId, select, loading };
}
