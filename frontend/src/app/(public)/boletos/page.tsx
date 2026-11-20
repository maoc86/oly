"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import BrandLogo from "@/components/BrandLogo";
import { Order, OrderItem, PaymentMethod, Ticket, TicketDesign } from "@/lib/types";
import { formatAmount, type Currency } from "@/lib/currency";
import { paymentDataPoints } from "@/lib/paymentMethods";
import {
  Download,
  Ticket as TicketIcon,
  CalendarDays,
  MapPin,
  Receipt,
  Clock,
  Landmark,
  Ban,
  CheckCircle2,
  XCircle,
  ScanLine,
  Maximize2,
  X,
  Armchair,
  ShieldCheck,
} from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

/** Estado visual de un boleto (válido / usado / anulado). */
function ticketStatusMeta(status: Ticket["status"]) {
  if (status === "used") {
    return { label: "Usado", className: "bg-gray-200 text-gray-600", Icon: XCircle };
  }
  if (status === "cancelled") {
    return { label: "Anulado", className: "bg-red-100 text-red-700", Icon: Ban };
  }
  return { label: "Válido", className: "bg-emerald-100 text-emerald-700", Icon: CheckCircle2 };
}

function StatusBadge({ status, className = "" }: { status: Ticket["status"]; className?: string }) {
  const { label, className: tone, Icon } = ticketStatusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${tone} ${className}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </span>
  );
}

interface OpenTicket {
  ticket: Ticket;
  orderId: number;
  eventId?: number;
  eventTitle: string;
  eventStart?: string;
  eventVenue?: string;
  eventImage?: string;
  ticketTypeName?: string;
}

function TicketQr({
  value,
  size,
  dimmed = false,
}: {
  value: string;
  size: number;
  dimmed?: boolean;
}) {
  if (!value) {
    return (
      <div
        className="flex items-center justify-center text-center text-[10px] text-gray-400 bg-gray-50 rounded-lg"
        style={{ width: size, height: size }}
      >
        QR no disponible
      </div>
    );
  }
  return (
    <div className={dimmed ? "opacity-40 grayscale" : ""}>
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        bgColor="#ffffff"
        fgColor="#0f0f13"
        title="Código QR del boleto"
      />
    </div>
  );
}

/** Vista previa del boleto en HTML: mitad izquierda (info + fondo) y talón con QR. */
function TicketPreview({
  ticket,
  design,
  eventTitle,
  eventStart,
  ticketTypeName,
}: {
  ticket: Ticket;
  design: TicketDesign | null;
  eventTitle: string;
  eventStart?: string;
  ticketTypeName?: string;
}) {
  const brand = design?.brand_color || "#ffb800";
  const accent = design?.accent_color || "#ff8a00";
  const bg = design?.background_image_url || undefined;
  const dimmed = ticket.status === "used" || ticket.status === "cancelled";

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-sm flex flex-col sm:flex-row min-h-[250px] bg-white">
      {/* Mitad izquierda: fondo + datos del evento */}
      <div
        className="relative flex-1 p-5 text-white min-w-0"
        style={{
          backgroundImage: bg ? `url(${bg})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: "#111827",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/25" />
        <div className="relative flex flex-col h-full">
          <div className="flex items-center justify-between gap-3">
            {/* Logo TicketV bien visible sobre el fondo oscuro. */}
            <BrandLogo variant="dark" className="h-9 sm:h-10" />
            <p className="text-[10px] tracking-widest font-bold shrink-0" style={{ color: brand }}>
              BOLETO ELECTRÓNICO
            </p>
          </div>
          <p className="text-lg font-bold mt-2.5 leading-tight line-clamp-2">{eventTitle}</p>
          {eventStart && (
            <p className="text-xs mt-2 text-gray-200">
              📅 {formatDate(eventStart)} · {formatTime(eventStart)}
            </p>
          )}
          {design?.venue_name && (
            <p className="text-xs mt-1 text-gray-200">📍 {design.venue_name}</p>
          )}
          <div className="mt-auto pt-3 flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <p className="text-[9px] tracking-wider text-gray-300">ÁREA</p>
              <p className="text-sm font-bold">{ticket.area_name || ticketTypeName || "Entrada"}</p>
            </div>
            {ticket.seat_label && (
              <div>
                <p className="text-[9px] tracking-wider text-gray-300">ASIENTO</p>
                <p className="text-sm font-bold">{ticket.seat_label}</p>
              </div>
            )}
            <div>
              <p className="text-[9px] tracking-wider text-gray-300">BOLETO</p>
              <p className="text-sm font-bold">#{ticket.id}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Talón derecho: QR enmarcado en la marca */}
      <div className="w-full sm:w-44 shrink-0 bg-gray-50 border-t sm:border-t-0 sm:border-l border-dashed border-gray-300 flex flex-col items-center justify-center p-4">
        <span
          className="rounded-full px-3 py-1 text-[10px] font-bold tracking-wide mb-3"
          style={
            dimmed
              ? { backgroundColor: "#e5e7eb", color: "#4b5563" }
              : ticket.status === "cancelled"
                ? { backgroundColor: "#fee2e2", color: "#b91c1c" }
                : { backgroundColor: brand, color: "#0f0f13" }
          }
        >
          {dimmed ? "USADO" : ticket.status === "cancelled" ? "ANULADO" : "VÁLIDO"}
        </span>
        <div className="rounded-xl p-1.5" style={{ backgroundColor: brand }}>
          <div className="bg-white rounded-md p-1.5">
            <TicketQr value={ticket.qr_code || ""} size={96} dimmed={dimmed} />
          </div>
        </div>
        <p className="text-[10px] text-gray-500 mt-2 text-center">
          {design?.footer_text || "Escaneá en el acceso"}
        </p>
        <p className="text-[9px] text-gray-400 font-mono mt-1 truncate max-w-full">
          {(ticket.qr_code || "").slice(0, 12).toUpperCase()}
        </p>
        <span className="mt-2 h-1 w-10 rounded-full" style={{ backgroundColor: accent }} />
        {/* Logo TicketV sobre el fondo claro del talón. */}
        <div className="mt-3 pt-3 w-full border-t border-gray-200 flex justify-center">
          <BrandLogo variant="light" className="h-7" />
        </div>
      </div>
    </div>
  );
}

/** Tarjeta de un boleto dentro de la orden, con acceso al visor. */
function TicketCard({
  ticket,
  ticketTypeName,
  onOpen,
  onDownload,
}: {
  ticket: Ticket;
  ticketTypeName?: string;
  onOpen: () => void;
  onDownload: () => void;
}) {
  const used = ticket.status === "used";
  const cancelled = ticket.status === "cancelled";
  const faded = used || cancelled;

  return (
    <div
      className={`group rounded-2xl border overflow-hidden transition-all ${
        faded
          ? "border-gray-200 bg-gray-50"
          : "border-gray-200 bg-white hover:border-brand-400 hover:shadow-md"
      }`}
    >
      <div className="flex gap-3 p-3">
        <button
          type="button"
          onClick={onOpen}
          className="relative shrink-0 rounded-xl bg-white border border-gray-200 p-2 transition group-hover:border-brand-400"
          aria-label={`Ver boleto #${ticket.id}`}
        >
          <TicketQr value={ticket.qr_code || ""} size={88} dimmed={faded} />
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <span className="rounded-full bg-ink-900/80 p-1.5 text-white">
              <Maximize2 className="w-3.5 h-3.5" />
            </span>
          </span>
          {used && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rotate-[-12deg] rounded-md bg-gray-900/80 text-white text-xs font-bold px-2 py-1 tracking-wide">
                USADO
              </span>
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <StatusBadge status={ticket.status} />
            <span className="text-[11px] font-mono text-gray-400">#{ticket.id}</span>
          </div>
          <p className="mt-1.5 text-sm font-semibold text-gray-900 truncate">
            {ticket.area_name || ticketTypeName || "Entrada"}
          </p>
          {ticket.seat_label ? (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Armchair className="w-3 h-3 shrink-0" />
              <span className="truncate">{ticket.seat_label}</span>
            </p>
          ) : null}
          {used && ticket.scanned_at && (
            <p className="text-[11px] text-gray-400">Validado el {formatDate(ticket.scanned_at)}</p>
          )}

          <div className="mt-auto pt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-ink-900 bg-brand-500 rounded-lg hover:bg-brand-400 transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Ver boleto
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MisBoletosPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [error, setError] = useState("");
  const [openTicket, setOpenTicket] = useState<OpenTicket | null>(null);
  // Diseño del boleto del evento (colores, fondo, logo) para la vista previa.
  const [design, setDesign] = useState<TicketDesign | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(`/login?redirect=/boletos`);
      return;
    }
    api
      .get<Order[]>("/orders")
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar tus boletos"))
      .finally(() => setOrders((s) => s ?? []));
    api
      .get<PaymentMethod[]>("/payment-methods")
      .then(setMethods)
      .catch(() => setMethods([]));
  }, [isAuthenticated, router]);

  // Cerrar el visor con la tecla Escape.
  useEffect(() => {
    if (!openTicket) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenTicket(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openTicket]);

  // Carga el diseño del boleto del evento abierto (colores/fondo/logo).
  useEffect(() => {
    if (!openTicket?.eventId) return;
    let active = true;
    api
      .get<TicketDesign>(`/events/${openTicket.eventId}/ticket-design`)
      .then((d) => {
        if (active) setDesign(d);
      })
      .catch(() => {
        if (active) setDesign(null);
      });
    return () => {
      active = false;
    };
  }, [openTicket?.eventId]);

  const handleDownload = useCallback(
    (orderId: number, ticketId: number, name: string) => {
      api
        .download(`/orders/${orderId}/ticket/${ticketId}/pdf`, `${name}-boleto.pdf`)
        .catch((e) => setError(e instanceof Error ? e.message : "Error al descargar el boleto"));
    },
    []
  );

  // Abre el visor reseteando el diseño (evita arrastrar el boleto anterior).
  const openViewer = useCallback((payload: OpenTicket) => {
    setDesign(null);
    setOpenTicket(payload);
  }, []);

  const totalTickets = useMemo(
    () => orders?.reduce((acc, o) => acc + o.items.reduce((n, it) => n + it.tickets.length, 0), 0) ?? 0,
    [orders]
  );

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  if (orders === null) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-start gap-4">
        <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-brand-500 items-center justify-center shrink-0">
          <TicketIcon className="w-7 h-7 text-ink-900" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <TicketIcon className="w-7 h-7 text-brand-700 sm:hidden" /> Mis boletos
          </h1>
          <p className="text-gray-500 mt-1">
            Mostrá el código QR o el boleto completo directo desde esta página. No hace falta descargar el PDF.
          </p>
          {totalTickets > 0 && (
            <p className="text-xs font-medium text-brand-800 bg-brand-50 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mt-2">
              <ShieldCheck className="w-3.5 h-3.5" /> {totalTickets} {totalTickets === 1 ? "boleto" : "boletos"} disponibles
            </p>
          )}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-500">Aún no tenés boletos.</p>
          <button
            onClick={() => router.push("/eventos")}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-ink-900 rounded-xl font-semibold hover:bg-brand-400"
          >
            Explorar eventos
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const firstItem = order.items[0];
            const eventTitle = firstItem?.event_title || "";
            const eventStart = firstItem?.event_start || "";
            const method = methods.find((m) => m.id === order.payment_method_id);
            const points = method ? paymentDataPoints(method) : [];
            // Importe cobrado, con la moneda y la tasa que quedaron fijadas al comprar.
            const orderCurrency: Currency = order.payment_currency === "VES" ? "VES" : "USD";
            const chargedTotal = Number(order.payment_total ?? order.total);
            // Boletos emitidos de esta orden (se crean al confirmarse el pago).
            const holders = order.items.flatMap((item: OrderItem) =>
              item.tickets.map((ticket) => ({ item, ticket }))
            );
            const isPending = order.status === "pending";
            const isCancelled = order.status === "cancelled";
            const accent = isCancelled
              ? "bg-gray-400"
              : isPending
                ? "bg-amber-400"
                : "bg-brand-500";

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Franja de estado a la izquierda: reemplaza la foto que se perdía. */}
                <div className="flex">
                  <span className={`w-1.5 shrink-0 ${accent}`} aria-hidden />
                  <div className="flex-1 p-5 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
                          Compra #{order.id}
                        </p>
                        <h2 className="text-lg font-bold text-gray-900 truncate">
                          {eventTitle || `Pedido #${order.id}`}
                        </h2>
                        {eventStart && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {formatDate(eventStart)} · {formatTime(eventStart)}
                            </span>
                            {firstItem?.event_id ? (
                              <button
                                type="button"
                                onClick={() => router.push(`/evento/${firstItem.event_id}`)}
                                className="flex items-center gap-1.5 text-brand-700 hover:text-brand-800 font-medium"
                              >
                                <MapPin className="w-3.5 h-3.5" /> Ver evento
                              </button>
                            ) : null}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-sm font-bold text-ink-900 whitespace-nowrap">
                          {formatAmount(chargedTotal, orderCurrency)}
                        </span>
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                            <Clock className="w-3 h-3" /> Pendiente de pago
                          </span>
                        )}
                        {isCancelled && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-xs font-medium">
                            <Ban className="w-3 h-3" /> Cancelada
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {order.items.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-brand-50 text-brand-800 rounded-full"
                        >
                          <TicketIcon className="w-3.5 h-3.5" />
                          {item.ticket_type_name || `Entrada`} × {item.quantity}
                        </span>
                      ))}
                    </div>

                    {isPending && (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <p className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1">
                          <Landmark className="w-3.5 h-3.5" /> Para completar el pago
                        </p>
                        {points.length > 0 ? (
                          <div className="text-xs text-gray-500 space-y-0.5">
                            {points.map((d) => (
                              <p key={d.label}>
                                {d.label}: <span className="font-medium text-gray-700">{d.value}</span>
                              </p>
                            ))}
                            {method?.account_note && <p className="mt-1">{method.account_note}</p>}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500">El organizador te contactará con los datos de pago.</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          Usá el número de pedido <strong>#{order.id}</strong> como referencia. Tus códigos QR aparecerán
                          acá cuando se confirme el pago.
                        </p>
                      </div>
                    )}

                    {isCancelled ? (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <p className="text-xs text-gray-500">Esta orden fue cancelada. Si tenés dudas, contactanos.</p>
                      </div>
                    ) : holders.length > 0 ? (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        <p className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-3">
                          <ScanLine className="w-3.5 h-3.5" /> Tus boletos ({holders.length})
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {holders.map(({ item, ticket }) => (
                            <TicketCard
                              key={ticket.id}
                              ticket={ticket}
                              ticketTypeName={item.ticket_type_name}
                              onOpen={() =>
                                openViewer({
                                  ticket,
                                  orderId: order.id,
                                  eventId: item.event_id,
                                  eventTitle: eventTitle || `Pedido #${order.id}`,
                                  eventStart,
                                  ticketTypeName: item.ticket_type_name,
                                })
                              }
                              onDownload={() => handleDownload(order.id, ticket.id, eventTitle || "evento")}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openTicket && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setOpenTicket(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Boleto"
        >
          <div
            className="relative bg-white rounded-3xl w-full max-w-4xl max-h-[94vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera del visor */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-gray-900 truncate">{openTicket.eventTitle}</h3>
                {openTicket.eventStart && (
                  <p className="text-sm text-gray-500">
                    {formatDate(openTicket.eventStart)} · {formatTime(openTicket.eventStart)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpenTicket(null)}
                className="shrink-0 p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 sm:p-5 bg-gray-50">
              {/* Vista previa del boleto (HTML, igual al diseño del admin). */}
              <TicketPreview
                ticket={openTicket.ticket}
                design={design}
                eventTitle={openTicket.eventTitle}
                eventStart={openTicket.eventStart}
                ticketTypeName={openTicket.ticketTypeName}
              />

              {/* QR grande + acciones */}
              <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-5 flex flex-col sm:flex-row items-center gap-5">
                <div className="rounded-2xl bg-white p-3 border border-gray-200 shadow-sm shrink-0">
                  <TicketQr
                    value={openTicket.ticket.qr_code || ""}
                    size={180}
                    dimmed={openTicket.ticket.status === "used"}
                  />
                </div>

                <div className="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left">
                  <StatusBadge status={openTicket.ticket.status} />
                  <p className="mt-2 text-base font-bold text-gray-900">
                    {openTicket.ticket.area_name || openTicket.ticketTypeName || "Entrada"}
                  </p>
                  {openTicket.ticket.seat_label ? (
                    <p className="mt-1 text-sm text-gray-600 flex items-center gap-1.5">
                      <Armchair className="w-4 h-4" /> {openTicket.ticket.seat_label}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-gray-400">Boleto #{openTicket.ticket.id}</p>
                  {openTicket.ticket.status === "used" && openTicket.ticket.scanned_at && (
                    <p className="mt-1 text-xs text-gray-400">
                      Validado el {formatDate(openTicket.ticket.scanned_at)}.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      handleDownload(
                        openTicket.orderId,
                        openTicket.ticket.id,
                        openTicket.eventTitle || "evento"
                      )
                    }
                    className="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink-900 bg-brand-500 rounded-xl hover:bg-brand-400 w-full sm:w-auto"
                  >
                    <Download className="w-4 h-4" /> Descargar PDF
                  </button>
                  <p className="mt-2 text-[11px] text-gray-400">
                    Subí el brillo de la pantalla para facilitar el escaneo en el acceso.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
