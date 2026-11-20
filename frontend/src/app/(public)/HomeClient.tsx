"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ticket, ArrowRight, CalendarX2 } from "lucide-react";
import { Event, Category } from "@/lib/types";
import { isNotFinished, sortByRelevance } from "@/lib/events";
import EventCard from "@/components/events/EventCard";

export default function HomeClient({
  events,
  categories,
}: {
  events: Event[];
  categories: Category[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const now = useMemo(() => new Date(), []);

  const visible = useMemo(() => {
    const alive = events.filter((e) => isNotFinished(e, now));
    const list = selectedCategory === null ? alive : alive.filter((e) => e.category_id === selectedCategory);
    return sortByRelevance(list, now).slice(0, 9);
  }, [events, selectedCategory, now]);

  const hasAnyEvent = events.length > 0;

  return (
    <>
      {/* Categorias */}
      {categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === null
                  ? "bg-brand-500 text-ink-900 shadow-sm font-semibold"
                  : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              Todos
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === c.id
                    ? "bg-brand-500 text-ink-900 shadow-sm font-semibold"
                    : "bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Eventos destacados */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2.5">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-brand-50 text-brand-700">
                <Ticket className="w-5 h-5" />
              </span>
              {selectedCategory ? "Eventos filtrados" : "Eventos destacados"}
            </h2>
            <p className="text-gray-500 mt-1.5 text-sm">
              {visible.length > 0
                ? `${visible.length} ${visible.length === 1 ? "evento disponible" : "eventos disponibles"}`
                : "Proximamente te contaremos de los nuevos eventos"}
            </p>
          </div>
          <Link
            href="/eventos"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-brand-800 hover:text-brand-600 whitespace-nowrap"
          >
            Ver todos
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-200">
            <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-gray-100 text-gray-400">
              <CalendarX2 className="w-7 h-7" />
            </span>
            <p className="mt-4 font-semibold text-gray-900">
              {selectedCategory
                ? "No hay eventos en esta categoria"
                : hasAnyEvent
                  ? "No hay eventos proximos por ahora"
                  : "Todavia no hay eventos publicados"}
            </p>
            <p className="mt-1.5 text-sm text-gray-500 max-w-md mx-auto">
              {hasAnyEvent
                ? "Los eventos que ya terminaron no se muestran aquí. Vuelve pronto para ver los nuevos."
                : "Apenas se publiquen eventos van a aparecer en esta seccion."}
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Ver todas las categorias
                </button>
              )}
              <Link
                href="/eventos"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink-900 bg-brand-500 rounded-lg hover:bg-brand-400 transition-colors"
              >
                Explorar eventos
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        <div className="mt-8 sm:hidden">
          <Link
            href="/eventos"
            className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-gray-900 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Ver todos los eventos
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
