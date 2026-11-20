import { isNotFinished, sortByRelevance, eventTimeBadge } from "../src/lib/events.ts";

const res = await fetch("http://localhost:8000/events?limit=100");
const eventos = await res.json();

const now = new Date();
const visibles = sortByRelevance(eventos.filter((e) => isNotFinished(e, now)), now);

console.log(`eventos publicados: ${eventos.length}`);
console.log(`visibles en el home: ${visibles.length}`);
for (const e of visibles) {
  const t = eventTimeBadge(e, now);
  const min = Math.min(...e.ticket_types.map((x) => Number(x.price)));
  console.log(`  [${t.label}] ${e.title}`);
  console.log(`      ${new Date(e.start_date).toLocaleString("es-ES")} | ${e.category?.name ?? "sin categoría"} | desde ${min}`);
}

const ocultos = eventos.filter((e) => !isNotFinished(e, now));
if (ocultos.length) {
  console.log(`ocultos: ${ocultos.map((e) => `${e.title} (${eventTimeBadge(e, now).label})`).join(", ")}`);
}