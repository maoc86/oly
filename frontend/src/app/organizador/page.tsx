"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Ticket, TrendingUp, Wallet, Percent, Landmark, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { usePriceFormatter } from "@/lib/currency";

interface OrganizerEvent {
  id: number;
  title: string;
  status: string;
  start_date: string;
  venue_name: string | null;
  capacity: number;
  subtotal: number;
  base: number;
  platform_fee: number;
  municipal_tax: number;
  tax: number;
  organizer_gross: number;
  platform_gross: number;
  organizer_tax: number;
  platform_tax: number;
  net: number;
  tickets_sold: number;
  orders: number;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  published: "Publicado",
  finished: "Finalizado",
  cancelled: "Cancelado",
};

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-brand-100 text-brand-800",
  finished: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

export default function OrganizerEventsPage() {
  const format = usePriceFormatter();
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<OrganizerEvent[]>("/organizer/events")
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los eventos"))
      .finally(() => setLoading(false));
  }, []);

  const totals = events.reduce(
    (acc, e) => ({
      subtotal: acc.subtotal + e.subtotal,
      base: acc.base + e.base,
      platform_fee: acc.platform_fee + e.platform_fee,
      taxes: acc.taxes + e.municipal_tax + e.organizer_tax,
      platform_gross: acc.platform_gross + e.platform_gross,
      organizer_gross: acc.organizer_gross + e.organizer_gross,
      net: acc.net + e.organizer_gross,
      tickets: acc.tickets + e.tickets_sold,
    }),
    { subtotal: 0, base: 0, platform_fee: 0, taxes: 0, platform_gross: 0, organizer_gross: 0, net: 0, tickets: 0 }
  );

  if (loading) return <div className="h-32 bg-gray-200 rounded-2xl animate-pulse" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Mis eventos</h1>
      <p className="text-sm text-gray-500 mt-1">
        Cómo va la venta de cada evento. "A liquidar" es lo que te corresponde cobrar (incluye la porción de impuestos del evento); la retención es lo que gana la plataforma.
      </p>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-4 mt-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand-50 text-brand-700">
              <TrendingUp className="w-3.5 h-3.5" />
            </span>
            <p className="text-xs font-medium">Vendido bruto</p>
          </div>
          <p className="text-xl font-bold text-ink-900 mt-2">{format(totals.subtotal)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700">
              <Receipt className="w-3.5 h-3.5" />
            </span>
            <p className="text-xs font-medium">Precio base total</p>
          </div>
          <p className="text-xl font-bold text-blue-700 mt-2">{format(totals.base)}</p>
          <p className="text-[10px] text-gray-400 mt-1">Sin comisión ni impuestos</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-red-50 text-red-600">
              <Percent className="w-3.5 h-3.5" />
            </span>
            <p className="text-xs font-medium">Retención de la plataforma</p>
          </div>
          <p className="text-xl font-bold text-red-600 mt-2">-{format(totals.platform_gross)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-amber-50 text-amber-600">
              <Landmark className="w-3.5 h-3.5" />
            </span>
            <p className="text-xs font-medium">Impuestos a remitir</p>
          </div>
          <p className="text-xl font-bold text-amber-600 mt-2">{format(totals.taxes)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600">
              <Wallet className="w-3.5 h-3.5" />
            </span>
            <p className="text-xs font-medium">A liquidar</p>
          </div>
          <p className="text-xl font-bold text-emerald-600 mt-2">{format(totals.organizer_gross)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 text-gray-500">
            <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand-50 text-brand-700">
              <Ticket className="w-3.5 h-3.5" />
            </span>
            <p className="text-xs font-medium">Boletos vendidos</p>
          </div>
          <p className="text-xl font-bold text-ink-900 mt-2">{totals.tickets}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 mt-6 overflow-hidden">
        {events.length === 0 ? (
          <p className="p-8 text-center text-gray-500 text-sm">
            Todavía no tenés eventos asignados.
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {events.map((e) => (
              <div key={e.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-gray-900">{e.title}</h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        STATUS_STYLE[e.status] || "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {STATUS_LABEL[e.status] || e.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="w-3.5 h-3.5" />
                      {new Date(e.start_date).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                    {e.venue_name && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {e.venue_name}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Ticket className="w-3.5 h-3.5" />
                      {e.tickets_sold}/{e.capacity} boletos
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-6 text-right sm:flex sm:items-center sm:gap-8">
                  <div>
                    <p className="text-xs text-gray-500">Vendido</p>
                    <p className="font-semibold text-gray-900">{format(e.subtotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Precio base</p>
                    <p className="font-semibold text-blue-700">{format(e.base)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Retención plat.</p>
                    <p className="font-semibold text-red-600">-{format(e.platform_gross)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Impuestos</p>
                    <p className="font-semibold text-amber-600">{format(e.municipal_tax + e.organizer_tax)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">A liquidar</p>
                    <p className="font-bold text-emerald-600">{format(e.organizer_gross)}</p>
                  </div>
                  <Link
                    href={`/organizador/eventos/${e.id}`}
                    className="text-sm font-medium text-brand-800 hover:text-brand-600 whitespace-nowrap"
                  >
                    Ver detalle
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <Link
          href="/organizador/liquidaciones"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink-900 bg-brand-500 rounded-lg hover:bg-brand-400 transition-colors"
        >
          <Wallet className="w-4 h-4" />
          Ver liquidaciones
        </Link>
      </div>
    </div>
  );
}
