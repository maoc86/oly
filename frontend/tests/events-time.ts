import { eventTimeState, isNotFinished, sortByRelevance, eventEnd } from "../src/lib/events.ts";

const now = new Date("2026-10-04T19:30:00");

const casos = [
  ["proximo", { start_date: "2026-11-01T19:00:00", end_date: "2026-11-01T23:00:00" }, "upcoming"],
  ["en curso", { start_date: "2026-10-04T18:00:00", end_date: "2026-10-04T23:00:00" }, "ongoing"],
  ["terminado", { start_date: "2026-10-01T19:00:00", end_date: "2026-10-01T23:00:00" }, "finished"],
  ["end antes de start (dato roto)", { start_date: "2026-10-01T19:00:00", end_date: "2026-10-01T12:00:00" }, "finished"],
  // end_date es NOT NULL en la BD: si falta, se asume que el evento dura lo que dura el inicio.
  ["sin end_date, ya empezo (fallback)", { start_date: "2026-10-04T18:00:00" }, "finished"],
  ["sin fechas", { start_date: "", end_date: "" }, "finished"],
];

let fallos = 0;
for (const [nombre, ev, esperado] of casos) {
  const got = eventTimeState(ev, now);
  const ok = got === esperado;
  if (!ok) fallos++;
  console.log(`${ok ? "OK   " : "FALLA"} ${nombre}: ${got} (esperado ${esperado})`);
}

console.log("\neventEnd con end<start ->", eventEnd({ start_date: "2026-10-01T19:00:00", end_date: "2026-10-01T12:00:00" })?.toISOString());

const lista = [
  { id: 1, title: "pasado", start_date: "2026-09-01T19:00:00", end_date: "2026-09-01T23:00:00" },
  { id: 2, title: "proximo lejano", start_date: "2026-12-01T19:00:00", end_date: "2026-12-01T23:00:00" },
  { id: 3, title: "en curso", start_date: "2026-10-04T18:00:00", end_date: "2026-10-04T23:00:00" },
  { id: 4, title: "proximo cercano", start_date: "2026-10-10T19:00:00", end_date: "2026-10-10T23:00:00" },
];

console.log("\nvisibles en el home (en orden):");
sortByRelevance(lista, now)
  .filter((e) => isNotFinished(e, now))
  .forEach((e) => console.log("  ", e.title));
console.log("esperado: en curso, proximo cercano, proximo lejano");

process.exit(fallos === 0 ? 0 : 1);