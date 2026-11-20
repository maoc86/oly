"use client";

import Link from "next/link";
import { CalendarDays, MapPin, ArrowRight, TicketX } from "lucide-react";
import { Event } from "@/lib/types";
import { usePriceFormatter } from "@/lib/currency";
import { eventTimeBadge, formatEventDate, formatEventTime } from "@/lib/events";
import CoverImage from "@/components/CoverImage";

export default function EventCard({ event }: { event: Event }) {
  const format = usePriceFormatter();
  const prices = (event.ticket_types || []).map((t) => Number(t.price)).filter((p) => !Number.isNaN(p));
  const minPrice = prices.length ? Math.min(...prices) : null;

  // El stock de las áreas con asientos ya cuenta sillas físicas.
  const totalAvailable = (event.ticket_types || []).reduce(
    (s, t) => s + Math.max(0, (t.total_stock || 0) - (t.sold_stock || 0) - (t.guest_stock || 0)),
    0
  );
  const soldOut = totalAvailable <= 0;
  const fewLeft = !soldOut && totalAvailable < 20;
  const time = eventTimeBadge(event);

  return (
    <Link
      href={`/evento/${event.id}`}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all border border-gray-100"
    >
      <div className="relative aspect-[16/9] sm:aspect-[4/1] overflow-hidden bg-gray-100">
        {event.image_url || event.mobile_image_url ? (
          <CoverImage
            desktopSrc={event.image_url}
            mobileSrc={event.mobile_image_url}
            alt={event.title}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand-500 to-accent-500">
            <CalendarDays className="w-12 h-12 text-ink-900/70" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/45 to-transparent" />

        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
          {event.category && (
            <span className="px-2.5 py-1 text-xs font-medium bg-white/90 backdrop-blur rounded-full shadow-sm text-gray-800">
              {event.category.name}
            </span>
          )}
          <span className={`px-2.5 py-1 text-xs font-medium rounded-full shadow-sm ${time.className}`}>
            {time.label}
          </span>
        </div>

        {fewLeft && (
          <span className="absolute top-3 right-3 px-2.5 py-1 text-xs font-semibold bg-amber-400 text-amber-950 rounded-full shadow-sm">
            Quedan pocas
          </span>
        )}
        {soldOut && (
          <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-800 text-sm font-semibold rounded-full">
              <TicketX className="w-4 h-4" /> Agotado
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <p className="text-xs font-medium text-brand-800 flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          {formatEventDate(event.start_date)}
          <span className="text-gray-400 font-normal">· {formatEventTime(event.start_date)}</span>
        </p>
        <h3 className="mt-1.5 font-semibold text-gray-900 group-hover:text-brand-800 transition-colors line-clamp-2">
          {event.title}
        </h3>
        {event.venue && (
          <p className="mt-1.5 text-sm text-gray-500 flex items-center gap-1 truncate">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{event.venue.city || event.venue.name}</span>
          </p>
        )}

        <div className="mt-auto pt-4 border-t border-dashed border-gray-200 flex items-center justify-between">
          <span className="text-sm font-bold text-ink-900">
            {minPrice !== null ? `Desde ${format(minPrice)}` : "Gratis"}
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-800 group-hover:gap-2 transition-all">
            Ver <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}