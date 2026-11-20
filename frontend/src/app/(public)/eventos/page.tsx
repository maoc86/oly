"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Event } from "@/lib/types";
import EventCard from "@/components/events/EventCard";
import { Search, CalendarDays, Filter } from "lucide-react";

type FilterKey = "upcoming" | "today" | "week" | "past";

function EventosContent() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [filter, setFilter] = useState<FilterKey | "all">("all");

  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    api
      .get<Event[]>("/events?status=published&limit=100")
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const todayKey = now.toDateString();
  const weekEnd = new Date(now);
  weekEnd.setDate(now.getDate() + 7);

  const filtered = events.filter((e) => {
    const start = new Date(e.start_date);
    const matchesSearch =
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description?.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    switch (filter) {
      case "all":
        return true;
      case "upcoming":
        return start > now;
      case "today":
        return start.toDateString() === todayKey;
      case "week":
        return start > now && start <= weekEnd;
      case "past":
        return start <= now;
      default:
        return true;
    }
  });

  const chips: { key: FilterKey | "all"; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "upcoming", label: "Próximos" },
    { key: "today", label: "Hoy" },
    { key: "week", label: "Esta semana" },
    { key: "past", label: "Pasados" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Explorar eventos</h1>
          <p className="text-gray-500 mt-1">Encuentra tu próxima experiencia inolvidable</p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-4">{filtered.length} evento(s)</p>

      <div className="flex items-center gap-2 mb-6 text-sm flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        {chips.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                active
                  ? "bg-brand-500 text-ink-900 border-brand-500 font-semibold"
                  : "text-gray-700 hover:bg-brand-50 border-gray-200"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <CalendarDays className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">No se encontraron eventos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventosPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8 h-40 animate-pulse bg-gray-200 rounded-2xl" />}>
      <EventosContent />
    </Suspense>
  );
}