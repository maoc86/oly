import type { Event } from "./types";

type TimeState = "upcoming" | "ongoing" | "finished";

function parse(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Fin real del evento. Si `end_date` falta o es anterior a `start_date`
 * (datos inconsistentes), se usa la fecha de inicio.
 */
export function eventEnd(event: Pick<Event, "start_date" | "end_date">) {
  const start = parse(event.start_date);
  if (!start) return null;
  const end = parse(event.end_date);
  if (!end || end <= start) return start;
  return end;
}

export function eventTimeState(
  event: Pick<Event, "start_date" | "end_date">,
  now = new Date()
): TimeState {
  const start = parse(event.start_date);
  if (!start) return "finished";
  if (now < start) return "upcoming";
  const end = eventEnd(event) as Date;
  return now < end ? "ongoing" : "finished";
}

/** Visible en el home: lo que todavia no termino (aun no empieza o esta en curso). */
export function isNotFinished(event: Pick<Event, "start_date" | "end_date">, now = new Date()) {
  return eventTimeState(event, now) !== "finished";
}

/** Proximos primero; a igual fecha, los que ya empezaron van despues. */
export function sortByRelevance<T extends Pick<Event, "start_date" | "end_date">>(
  list: T[],
  now = new Date()
) {
  const rank = (e: T) => (eventTimeState(e, now) === "ongoing" ? 0 : 1);
  return [...list].sort((a, b) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return parse(a.start_date)!.getTime() - parse(b.start_date)!.getTime();
  });
}

const TIME_LABEL: Record<TimeState, string> = {
  upcoming: "Próximo",
  ongoing: "En curso",
  finished: "Finalizado",
};

const TIME_STYLE: Record<TimeState, string> = {
  upcoming: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-100",
  ongoing: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100",
  finished: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
};

export function eventTimeBadge(event: Pick<Event, "start_date" | "end_date">, now = new Date()) {
  const state = eventTimeState(event, now);
  return { label: TIME_LABEL[state], className: TIME_STYLE[state] };
}

export function formatEventDate(iso?: string | null) {
  const d = parse(iso);
  if (!d) return "";
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatEventTime(iso?: string | null) {
  const d = parse(iso);
  if (!d) return "";
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}