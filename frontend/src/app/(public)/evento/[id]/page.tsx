"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePriceFormatter } from "@/lib/currency";
import { useCart } from "@/lib/cart";
import { Event, EventSeats, TicketType, Seat } from "@/lib/types";
import { parseServerDate } from "@/lib/datetime";
import SeatMap from "@/components/SeatMap";
import BoxSeatMap from "@/components/BoxSeatMap";
import MiniMap from "@/components/MiniMap";
import CoverImage from "@/components/CoverImage";
import { Modal, Button } from "@/components/ui";
import {
  CalendarDays, MapPin, Clock, Users, ShoppingCart, ChevronLeft, CheckCircle, X,
} from "lucide-react";

interface ReserveResponse {
  reserved: Seat[];
  failed: Seat[];
}

export default function EventoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const format = usePriceFormatter();
  const { setCart } = useCart();
  const [event, setEvent] = useState<Event | null>(null);
  const [eventSeats, setEventSeats] = useState<EventSeats | null>(null);
  const [loading, setLoading] = useState(true);
  const [seatsLoading, setSeatsLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [selectedSeats, setSelectedSeats] = useState<Record<string, boolean>>({});
  const [areaModes, setAreaModes] = useState<Record<number, "box" | "seat">>({});
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [focusedAreaId, setFocusedAreaId] = useState<number | null>(null);
  const [reservationExpiresAt, setReservationExpiresAt] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [added, setAdded] = useState(false);

  const ticketBlocks = eventSeats?.ticket_types || [];

  useEffect(() => {
    api
      .get<Event>(`/events/${params.id}`)
      .then((data) => {
        setEvent(data);
        const qty: Record<number, number> = {};
        data.ticket_types.forEach((t) => (qty[t.id] = 0));
        setQuantities(qty);
      })
      .catch(() => setError("No se pudo cargar el evento"))
      .finally(() => setLoading(false));
    api
      .get<EventSeats>(`/events/${params.id}/seats`)
      .then(setEventSeats)
      .catch(() => setEventSeats(null))
      .finally(() => setSeatsLoading(false));
  }, [params.id]);

  // Cuenta regresiva de la reserva temporal; al expirar libera la selección local.
  useEffect(() => {
    if (!reservationExpiresAt || !event) return;
    const ids = event.ticket_types.filter((t) => t.has_seat_map !== false).map((t) => t.id);
    const handle = window.setInterval(() => {
      if (reservationExpiresAt - Date.now() <= 0) {
        setSelectedSeats({});
        setQuantities((prev) => {
          const next = { ...prev };
          for (const id of ids) next[id] = 0;
          return next;
        });
        setReservationExpiresAt(null);
        setError("Tu reserva de asientos expiró. Elegí los asientos otra vez.");
        api.get<EventSeats>(`/events/${params.id}/seats`).then(setEventSeats).catch(() => {});
        window.clearInterval(handle);
        return;
      }
      setNowTs(Date.now());
    }, 1000);
    return () => window.clearInterval(handle);
  }, [reservationExpiresAt, params.id, event]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl h-96 animate-pulse" />
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center text-gray-500">
        <p>{error || "Evento no encontrado"}</p>
        <button onClick={() => router.push("/eventos")} className="mt-4 text-brand-800">
          ← Volver a eventos
        </button>
      </div>
    );
  }

  if (!event) return null;

  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);
  const total = event.ticket_types.reduce((sum, t) => {
    const qty = quantities[t.id] || 0;
    if (!qty) return sum;
    // En modo por silla se cobra el precio individual; el resto es por entrada/box.
    if (areaModes[t.id] === "seat") {
      return sum + qty * Number(t.individual_price ?? t.price);
    }
    const gs = Math.max(1, t.group_size || 1);
    return sum + (qty / gs) * Number(t.price);
  }, 0);

  const selectedAreaObj = selectedAreaId ? event.ticket_types.find((t) => t.id === selectedAreaId) || null : null;
  const selectedAreaBlock = selectedAreaId ? ticketBlocks.find((ts) => ts.ticket_type.id === selectedAreaId) || null : null;

  // Áreas con asientos numerados vs. entradas generales (asignación libre por capacidad).
  const seatAreas = event.ticket_types.filter((t) => t.has_seat_map !== false);
  const freeAreas = event.ticket_types.filter((t) => t.has_seat_map === false);

  const now = new Date();
  const areaOnSale = (t: TicketType) => {
    if (t.sale_start && now < new Date(t.sale_start)) return false;
    if (t.sale_end && now > new Date(t.sale_end)) return false;
    return true;
  };
  const totalPlazas = event.ticket_types.reduce((s, t) => s + (t.total_stock || 0), 0);

  const selectedTypes = event.ticket_types.filter((t) => (quantities[t.id] || 0) > 0);
  const remainingMs = reservationExpiresAt ? Math.max(0, reservationExpiresAt - nowTs) : 0;
  const remainingMm = Math.floor(remainingMs / 60000);
  const remainingSs = Math.floor((remainingMs % 60000) / 1000);

  /** Cantidad, etiqueta y subtotal de una línea de compra. */
  function lineInfo(t: TicketType) {
    const gs = Math.max(1, t.group_size || 1);
    const qty = quantities[t.id] || 0;
    const isSeat = gs > 1 && areaModes[t.id] === "seat";
    const lineTotal = isSeat ? qty * Number(t.individual_price ?? t.price) : (qty / gs) * Number(t.price);
    const label = isSeat ? `${qty} silla(s)` : gs > 1 ? `${qty / gs} box(es)` : `${qty} entrada(s)`;
    return { gs, qty, isSeat, lineTotal, label };
  }

  function registerReservation(reserved: Seat[]) {
    let max = 0;
    for (const s of reserved) {
      if (s.reserved_until) {
        const ts = parseServerDate(s.reserved_until);
        if (ts > max) max = ts;
      }
    }
    if (max > 0) {
      setReservationExpiresAt(max);
      setNowTs(Date.now());
    }
  }

  function changeFreeQty(tt: TicketType, delta: number) {
    if (!areaOnSale(tt)) return;
    const max = Math.max(0, (tt.total_stock || 0) - (tt.sold_stock || 0) - (tt.guest_stock || 0));
    setQuantities((prev) => ({
      ...prev,
      [tt.id]: Math.max(0, Math.min(max, (prev[tt.id] || 0) + delta)),
    }));
  }

  function handleSelectArea(id: number) {
    if (!event) return;
    const tt = event.ticket_types.find((t) => t.id === id);
    if (tt && !areaOnSale(tt)) {
      setError(`La venta de "${tt.name}" todavía no está disponible.`);
      return;
    }
    const available = tt ? Math.max(0, (tt.total_stock || 0) - (tt.sold_stock || 0) - (tt.guest_stock || 0)) : 0;
    if (available <= 0) {
      setError(tt ? `La zona "${tt.name}" está agotada. Elegí otra área.` : "Esa zona está agotada.");
      return;
    }
    setError("");
    setFocusedAreaId(id);
    setSelectedAreaId(id);
  }

  async function refreshSeats() {
    setEventSeats(await api.get<EventSeats>(`/events/${event!.id}/seats`));
  }

  /** Sillas seleccionadas de un área (para saber si quedan reservas propias). */
  function selectedSeatCount(ticketTypeId: number) {
    const prefix = `${ticketTypeId}-`;
    return Object.keys(selectedSeats).filter((k) => k.startsWith(prefix)).length;
  }

  async function handleSeatToggle(ticketTypeId: number, seatId: number) {
    const key = `${ticketTypeId}-${seatId}`;
    if (!event) return;
    if (!isAuthenticated) {
      router.push(`/login?redirect=/evento/${event.id}`);
      return;
    }

    if (selectedSeats[key]) {
      const wasLast = selectedSeatCount(ticketTypeId) <= 1;
      setSelectedSeats((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setQuantities((prev) => ({ ...prev, [ticketTypeId]: Math.max(0, (prev[ticketTypeId] || 0) - 1) }));
      api.post(`/events/${event.id}/seats/release`, { seat_ids: [seatId] }).catch(() => refreshSeats());
      if (wasLast && totalItems <= 1) setReservationExpiresAt(null);
    } else {
      try {
        const res = await api.post<ReserveResponse>(
          `/events/${event.id}/seats/reserve`,
          { seat_ids: [seatId] }
        );
        if (res.failed && res.failed.some((f) => f.id === seatId)) {
          setError("Esa silla acaba de ser tomada. Elegí otra.");
          await refreshSeats();
          return;
        }
        setSelectedSeats((prev) => ({ ...prev, [key]: true }));
        setQuantities((prev) => ({ ...prev, [ticketTypeId]: (prev[ticketTypeId] || 0) + 1 }));
        registerReservation(res.reserved || []);
      } catch {
        setError("No se pudo reservar la silla. Intentá de nuevo.");
      }
    }
  }

  // Modo box completo: reserva/libera todas las sillas de la casilla elegida.
  async function handleBoxToggle(ticketTypeId: number, seatIds: number[]) {
    if (!event) return;
    if (!isAuthenticated) {
      router.push(`/login?redirect=/evento/${event.id}`);
      return;
    }
    const tt = event.ticket_types.find((t) => t.id === ticketTypeId);
    const gs = Math.max(1, tt?.group_size || 1);
    const allMine = seatIds.every((id) => selectedSeats[`${ticketTypeId}-${id}`]);

    if (allMine) {
      const wasLast = selectedSeatCount(ticketTypeId) <= seatIds.length;
      setSelectedSeats((prev) => {
        const next = { ...prev };
        seatIds.forEach((id) => delete next[`${ticketTypeId}-${id}`]);
        return next;
      });
      setQuantities((prev) => ({ ...prev, [ticketTypeId]: Math.max(0, (prev[ticketTypeId] || 0) - gs) }));
      api.post(`/events/${event.id}/seats/release`, { seat_ids: seatIds }).catch(() => refreshSeats());
      if (wasLast && totalItems <= gs) setReservationExpiresAt(null);
    } else {
      try {
        const res = await api.post<ReserveResponse>(
          `/events/${event.id}/seats/reserve`,
          { seat_ids: seatIds }
        );
        if (res.failed && res.failed.length) {
          setError("Ese box acaba de ser tomado. Elegí otro.");
          await refreshSeats();
          return;
        }
        setSelectedSeats((prev) => {
          const next = { ...prev };
          seatIds.forEach((id) => {
            next[`${ticketTypeId}-${id}`] = true;
          });
          return next;
        });
        setQuantities((prev) => ({ ...prev, [ticketTypeId]: (prev[ticketTypeId] || 0) + gs }));
        registerReservation(res.reserved || []);
      } catch {
        setError("No se pudo reservar el box. Intentá de nuevo.");
      }
    }
  }

  // Los modos no se mezclan: al cambiarlo se libera lo elegido en esa área.
  async function changeAreaMode(ticketTypeId: number, mode: "box" | "seat") {
    if (!event) return;
    if ((areaModes[ticketTypeId] ?? "box") === mode) return;
    const prefix = `${ticketTypeId}-`;
    const seatIds = Object.keys(selectedSeats)
      .filter((k) => k.startsWith(prefix))
      .map((k) => Number(k.split("-")[1]))
      .filter((n) => !Number.isNaN(n));
    if (seatIds.length) {
      api.post(`/events/${event.id}/seats/release`, { seat_ids: seatIds }).catch(() => refreshSeats());
      setSelectedSeats((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (k.startsWith(prefix)) delete next[k];
        });
        return next;
      });
      setQuantities((prev) => ({ ...prev, [ticketTypeId]: 0 }));
      if (totalItems <= seatIds.length) setReservationExpiresAt(null);
    }
    setAreaModes((prev) => ({ ...prev, [ticketTypeId]: mode }));
  }

  // Quita del resumen todas las reservas/entradas de un área.
  async function clearArea(t: TicketType) {
    if (!event) return;
    const prefix = `${t.id}-`;
    const seatIds = Object.keys(selectedSeats)
      .filter((k) => k.startsWith(prefix))
      .map((k) => Number(k.split("-")[1]))
      .filter((n) => !Number.isNaN(n));
    if (seatIds.length) {
      api.post(`/events/${event.id}/seats/release`, { seat_ids: seatIds }).catch(() => refreshSeats());
    }
    setSelectedSeats((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith(prefix)) delete next[k];
      });
      return next;
    });
    setQuantities((prev) => ({ ...prev, [t.id]: 0 }));
    if (totalItems <= (quantities[t.id] || 0)) setReservationExpiresAt(null);
  }

  function openConfirm() {
    if (!event) return;
    if (!isAuthenticated) {
      router.push(`/login?redirect=/evento/${event.id}`);
      return;
    }
    const hasItems = event.ticket_types.some((t) => (quantities[t.id] || 0) > 0);
    if (!hasItems) {
      setError("Elegí al menos un asiento o una entrada");
      return;
    }
    setError("");
    setConfirmOpen(true);
  }

  function handleConfirmCheckout() {
    if (!event) return;
    const items: Record<number, { quantity: number; seat_ids: number[]; mode?: "box" | "seat" }> = {};
    event.ticket_types.forEach((t) => {
      const qty = quantities[t.id] || 0;
      if (qty <= 0) return;
      const seatIds = Object.keys(selectedSeats)
        .filter((k) => k.startsWith(`${t.id}-`))
        .map((k) => Number(k.split("-")[1]))
        .filter((n) => !Number.isNaN(n));
      const isBox = Math.max(1, t.group_size || 1) > 1;
      items[t.id] = { quantity: qty, seat_ids: seatIds, mode: isBox ? areaModes[t.id] ?? "box" : undefined };
    });
    setCart({ event, items });
    setConfirmOpen(false);
    setAdded(true);
  }

  const headerMeta = (
    <div className="mt-3 flex flex-wrap gap-4 text-sm">
      <span className="flex items-center gap-1.5">
        <CalendarDays className="w-4 h-4" />
        {new Date(event.start_date).toLocaleString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </span>
      <span className="flex items-center gap-1.5">
        <Clock className="w-4 h-4" />
        {new Date(event.start_date).toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
      {event.venue && (
        <span className="flex items-center gap-1.5">
          <MapPin className="w-4 h-4" />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              [event.venue.name, event.venue.address, event.venue.city].filter(Boolean).join(", ")
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
          >
            {event.venue.name} {event.venue.city ? `- ${event.venue.city}` : ""}
          </a>
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <Users className="w-4 h-4" />
        {totalPlazas || "N/A"} plazas
      </span>
    </div>
  );

  const summary = (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h3 className="font-bold text-gray-900 flex items-center gap-2">
        <ShoppingCart className="w-4 h-4" /> Tu compra
      </h3>
      {selectedTypes.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">
          Elegí asientos en el mapa o la cantidad de entradas generales para continuar.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {selectedTypes.map((t) => {
            const info = lineInfo(t);
            return (
              <div key={t.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                  <p className="text-gray-500">{info.label}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-semibold text-gray-900">{format(info.lineTotal)}</span>
                  <button
                    type="button"
                    onClick={() => clearArea(t)}
                    aria-label={`Quitar ${t.name}`}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {remainingMs > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>
                Tu reserva expira en{" "}
                <span className="font-semibold tabular-nums">
                  {remainingMm}:{String(remainingSs).padStart(2, "0")}
                </span>
              </span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-brand-800">{format(total)}</span>
          </div>
          <p className="text-xs text-gray-400">
            Los cargos por servicio e impuestos se calculan en el checkout.
          </p>
          <button
            type="button"
            onClick={openConfirm}
            className="w-full inline-flex items-center justify-center gap-2 bg-brand-500 text-ink-900 px-5 py-3 rounded-xl font-semibold hover:bg-brand-400"
          >
            <ShoppingCart className="w-4 h-4" /> Comprar
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-12">
      <button
        onClick={() => router.push("/eventos")}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-800"
      >
        <ChevronLeft className="w-4 h-4" /> Volver a eventos
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
        {/* Portada 4:1 en escritorio y 16:9 en móvil (usa la imagen móvil si existe). */}
        <div className="relative aspect-[16/9] sm:aspect-[4/1] bg-gradient-to-br from-brand-500 to-accent-500 overflow-hidden">
          <CoverImage desktopSrc={event.image_url} mobileSrc={event.mobile_image_url} alt={event.title} eager priority sizes="100vw" />
          {/* En pantallas amplias el título va sobre la banda. */}
          <div className="hidden md:flex absolute inset-0 bg-gradient-to-t from-black/70 to-transparent items-end">
            <div className="p-6 sm:p-8 text-white">
              {event.category && (
                <span className="px-2.5 py-1 text-xs font-medium bg-white/20 rounded-full inline-block mb-2">
                  {event.category.name}
                </span>
              )}
              <h1 className="text-3xl sm:text-4xl font-bold">{event.title}</h1>
              {headerMeta}
            </div>
          </div>
        </div>

        {/* En móvil la banda es más baja: los datos van debajo. */}
        <div className="md:hidden px-6 pt-5">
          {event.category && (
            <span className="px-2.5 py-1 text-xs font-medium bg-brand-50 text-brand-800 rounded-full inline-block mb-2">
              {event.category.name}
            </span>
          )}
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
          <div className="text-gray-500">{headerMeta}</div>
        </div>

        <div className="p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Acerca del evento</h2>
          <p className="text-gray-600 whitespace-pre-line">{event.description || "Sin descripción disponible."}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="space-y-6 min-w-0">
          {/* Mapa del evento con la forma interna de cada sección */}
          {seatAreas.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="font-bold text-gray-900 mb-1">Mapa del evento</h3>
              <p className="text-sm text-gray-500 mb-4">
                Elegí una sección para ver y seleccionar sus asientos.
              </p>
              <MiniMap
                ticketTypes={seatAreas}
                ticketSeatsList={ticketBlocks}
                mapConfig={event.map_config}
                loading={seatsLoading}
                focusedAreaId={focusedAreaId}
                onResetFocus={() => setFocusedAreaId(null)}
                selectedSeats={selectedSeats}
                myUserId={user?.id ?? null}
                formatPrice={format}
                onSelectArea={handleSelectArea}
              />
            </div>
          )}

          {/* Entradas generales (asignación libre por capacidad) */}
          {freeAreas.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-1">Entradas generales</h3>
              <p className="text-sm text-gray-500 mb-4">
                Elegí la cantidad de entradas. No requieren elegir asiento.
              </p>
              <div className="space-y-3">
                {freeAreas.map((t) => {
                  const color = t.color || "#ffb800";
                  const available = Math.max(0, (t.total_stock || 0) - (t.sold_stock || 0) - (t.guest_stock || 0));
                  const qty = quantities[t.id] || 0;
                  const onSale = areaOnSale(t);
                  const soldOut = available <= 0;
                  const lowStock = available > 0 && available <= 10;
                  return (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-xl"
                      style={{ borderColor: color }}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          {t.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {soldOut ? (
                            "Agotado"
                          ) : !onSale ? (
                            "Venta no disponible"
                          ) : lowStock ? (
                            <span className="text-amber-700 font-medium">¡Quedan {available}!</span>
                          ) : (
                            `${available} disponibles`
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-lg" style={{ color }}>
                          {format(Number(t.price))}
                        </span>
                        {!soldOut && onSale ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => changeFreeQty(t, -1)}
                              disabled={qty === 0}
                              className="w-9 h-9 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-40"
                              aria-label="Quitar una entrada"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-semibold">{qty}</span>
                            <button
                              onClick={() => changeFreeQty(t, 1)}
                              disabled={qty >= available}
                              className="w-9 h-9 rounded-lg border border-gray-300 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-40"
                              aria-label="Agregar una entrada"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">{soldOut ? "Agotado" : "No disponible"}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sin entradas configuradas */}
          {!seatsLoading && seatAreas.length === 0 && freeAreas.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center text-gray-500">
              <p className="font-medium text-gray-700">Todavía no hay entradas disponibles</p>
              <p className="text-sm mt-1">Volvé a intentarlo más tarde o revisá otros eventos.</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Resumen de compra (escritorio) */}
        <aside className="hidden lg:block lg:sticky lg:top-24">{summary}</aside>
      </div>

      {/* Barra inferior fija (móvil) */}
      {totalItems > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg z-40">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {selectedTypes.map((t) => (
                  <span key={t.id} className="text-sm text-gray-700">
                    <span className="font-semibold">{t.name}</span> × {quantities[t.id]}
                  </span>
                ))}
              </div>
              <div className="text-sm text-gray-600 mt-0.5 flex items-center gap-3">
                <span className="font-bold text-brand-800">{format(total)}</span>
                {remainingMs > 0 && (
                  <span className="text-amber-800 tabular-nums">
                    expira {remainingMm}:{String(remainingSs).padStart(2, "0")}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={openConfirm}
              className="inline-flex items-center gap-2 bg-brand-500 text-ink-900 px-5 py-3 rounded-xl font-semibold hover:bg-brand-400 disabled:opacity-50 flex-shrink-0"
            >
              <ShoppingCart className="w-4 h-4" />
              Comprar
            </button>
          </div>
        </div>
      )}

      {added && (
        <div className="fixed bottom-24 inset-x-0 z-50 flex justify-center px-4">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 max-w-md w-full">
            <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600" /> Agregado al carrito
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAdded(false)}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Seguir comprando
              </button>
              <button
                onClick={() => router.push("/checkout")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-ink-900 bg-brand-500 rounded-lg hover:bg-brand-400"
              >
                <ShoppingCart className="w-4 h-4" /> Ir al checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de selección de área */}
      <Modal
        open={!!selectedAreaObj}
        onClose={() => setSelectedAreaId(null)}
        title={selectedAreaObj?.name || ""}
        size="4xl"
        fullScreenOnMobile
      >
        {selectedAreaObj && (() => {
          const tt = selectedAreaObj;
          const groupSize = Math.max(1, tt.group_size || 1);
          const isBox = groupSize > 1;
          const mode = areaModes[tt.id] ?? "box";
          const hasIndividual = isBox && tt.individual_price != null;
          const available = (tt.total_stock || 0) - (tt.sold_stock || 0) - (tt.guest_stock || 0);
          const freeSeats = selectedAreaBlock ? selectedAreaBlock.free_count : available;
          const boxesAvailable = Math.floor(freeSeats / groupSize);
          const current = quantities[tt.id] || 0;
          const selectedUnits = mode === "seat" ? current : current / groupSize;
          const unitPrice = mode === "seat" ? Number(tt.individual_price) : Number(tt.price);
          const color = tt.color || "#ffb800";

          return (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-xl" style={{ borderColor: color }}>
                <div>
                  <p className="font-semibold text-gray-900">{tt.name}</p>
                  <p className="text-sm text-gray-500">
                    {isBox
                      ? mode === "seat"
                        ? `${freeSeats} silla(s) disponibles · ${groupSize} por box`
                        : `${boxesAvailable} box(es) disponibles · ${groupSize} entradas por box`
                      : `${available} disponibles`}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-lg" style={{ color }}>
                    {format(unitPrice)}
                    {isBox ? (mode === "seat" ? " / silla" : " / box") : ""}
                  </span>
                  {current > 0 && (
                    <span className="text-sm text-gray-500">
                      {mode === "seat"
                        ? `${selectedUnits} silla(s) elegidas`
                        : isBox
                          ? `${selectedUnits} box(es) seleccionados`
                          : ""}
                    </span>
                  )}
                </div>
              </div>

              {hasIndividual && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-600">¿Cómo querés comprar?</span>
                  <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => changeAreaMode(tt.id, "box")}
                      className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
                        mode === "box" ? "bg-brand-500 text-ink-900" : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Box completo
                    </button>
                    <button
                      type="button"
                      onClick={() => changeAreaMode(tt.id, "seat")}
                      className={`px-3 py-1.5 text-sm font-semibold border-l border-gray-300 transition-colors ${
                        mode === "seat" ? "bg-brand-500 text-ink-900" : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Por silla
                    </button>
                  </div>
                </div>
              )}

              {seatsLoading && !selectedAreaBlock && (
                <div className="h-64 rounded-xl bg-gray-50 border border-gray-100 animate-pulse" />
              )}

              {selectedAreaBlock && (isBox ? (
                <BoxSeatMap
                  block={selectedAreaBlock}
                  myUserId={user?.id ?? null}
                  mode={mode}
                  selected={selectedSeats}
                  onToggleBox={(ids) => handleBoxToggle(tt.id, ids)}
                  onToggleSeat={(id) => handleSeatToggle(tt.id, id)}
                />
              ) : (
                <SeatMap
                  ticketSeatsList={[selectedAreaBlock]}
                  myUserId={user?.id ?? null}
                  selected={selectedSeats}
                  onToggle={handleSeatToggle}
                />
              ))}

              {isBox && mode === "box" && (
                <p className="text-sm text-gray-500">
                  Elegí los boxes que quieras. Cada box incluye {groupSize} entradas.
                </p>
              )}
              {isBox && mode === "seat" && (
                <p className="text-sm text-gray-500">
                  Elegí un box en el mapa y luego las sillas individuales que quieras.
                </p>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Modal de confirmación de compra */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirmá tu selección" size="lg">
        <div className="space-y-5">
          <div className="space-y-2">
            {selectedTypes.map((t) => {
              const info = lineInfo(t);
              return (
                <div key={t.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-xl">
                  <div>
                    <p className="font-semibold text-gray-900">{t.name}</p>
                    <p className="text-sm text-gray-500">
                      {info.isSeat ? info.label : `Cantidad: ${info.qty}`}
                    </p>
                  </div>
                  <span className="font-bold text-gray-900">{format(info.lineTotal)}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 pt-3">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-brand-800">{format(total)}</span>
          </div>
          {seatAreas.some((t) => (quantities[t.id] || 0) > 0) && (
            <p className="text-xs text-gray-400">
              Tu reserva de asientos es temporal y expira si no completás la compra a tiempo.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end pt-1">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              Volver
            </Button>
            <Button onClick={handleConfirmCheckout}>
              <ShoppingCart className="w-4 h-4" /> Agregar al carrito
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
