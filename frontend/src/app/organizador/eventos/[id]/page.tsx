"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, TrendingUp, Percent, Wallet, Ticket, Landmark, FileText, Mail, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { usePriceFormatter } from "@/lib/currency";
import { Button, Modal } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import SeatMap from "@/components/SeatMap";
import { OrganizerSeat, OrganizerSeats, GuestTicket, TicketSeats, Seat } from "@/lib/types";
import { BoxLayout, boxLayoutToGrid, isValidBoxLayout } from "@/lib/boxLayout";

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

const GUEST_STATUS_LABEL: Record<string, string> = {
  valid: "Vigente",
  used: "Usado",
  cancelled: "Cancelado",
};

const GUEST_STATUS_STYLE: Record<string, string> = {
  valid: "bg-emerald-50 text-emerald-700",
  used: "bg-brand-100 text-brand-800",
  cancelled: "bg-red-50 text-red-700",
};

interface TicketTypeSales {
  name: string;
  price: number;
  subtotal: number;
  platform_fee: number;
  municipal_tax: number;
  tax: number;
  organizer_gross: number;
  platform_gross: number;
  organizer_tax: number;
  platform_tax: number;
  net: number;
  tickets_sold: number;
  sold_stock: number;
  guest_stock: number;
  blocked_stock: number;
  total_stock: number;
}

interface EventDetail {
  event: {
    id: number;
    title: string;
    status: string;
    start_date: string;
    end_date: string;
    venue_name: string | null;
  };
  summary: {
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
  };
  ticket_types: TicketTypeSales[];
}

function InvitadosTab({
  eventId,
  guests,
  setGuests,
  ticketTypes,
  seats,
  setSeats,
}: {
  eventId: number;
  guests: GuestTicket[];
  setGuests: (g: GuestTicket[]) => void;
  ticketTypes: any[];
  seats: OrganizerSeats | null;
  setSeats: (s: OrganizerSeats) => void;
}) {
  const [selectedTicketTypeId, setSelectedTicketTypeId] = useState<number | "">("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedTicketType = ticketTypes.find((t) => t.id === Number(selectedTicketTypeId));
  const hasSeatMap = selectedTicketType?.has_seat_map;

  const handleCreate = async (sendEmail = false) => {
    if (!selectedTicketTypeId) return alert("Selecciona un tipo de entrada");
    if (!guestName.trim()) return alert("Ingresa el nombre del invitado");
    setLoading(true);
    try {
      const payload: any = {
        ticket_type_id: Number(selectedTicketTypeId),
        guest_name: guestName,
        guest_email: guestEmail || null,
        guest_phone: guestPhone || null,
        quantity: hasSeatMap ? selectedSeatIds.length : quantity,
        seat_ids: hasSeatMap ? selectedSeatIds : null,
      };
      const created = await api.createGuest(eventId, payload, sendEmail);
      setGuests([created, ...guests]);
      // Las sillas ocupadas/cortesías cambian: refresca el mapa y el selector.
      try {
        setSeats(await api.organizerEventSeats(eventId));
      } catch {
        /* el mapa se verá al recargar */
      }
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setQuantity(1);
      setSelectedSeatIds([]);
      alert(
        sendEmail
          ? "Invitado creado y correo con el boleto encolado"
          : "Invitado creado correctamente"
      );
    } catch (e: any) {
      alert(e.message || "Error al crear invitado");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (guestId: number) => {
    if (!confirm("¿Cancelar este invitado?")) return;
    try {
      await api.deleteGuest(eventId, guestId);
      setGuests(guests.filter((g) => g.id !== guestId));
      // Las sillas se liberan: refresca el mapa y el selector.
      try {
        setSeats(await api.organizerEventSeats(eventId));
      } catch {
        /* el mapa se verá al recargar */
      }
    } catch (e: any) {
      alert(e.message || "Error al cancelar invitado");
    }
  };

  const handleSendEmail = async (guestId: number) => {
    try {
      await api.sendGuestEmail(eventId, guestId);
      alert("Correo enviado");
      const g = await api.listGuests(eventId);
      setGuests(g);
    } catch (e: any) {
      alert(e.message || "Error al enviar correo");
    }
  };

  const handleViewPdf = async (guestId: number) => {
    try {
      await api.download(
        `/organizer/events/${eventId}/guests/${guestId}/pdf`,
        `invitacion_${guestId}.pdf`
      );
    } catch (e: any) {
      alert(e.message || "Error al descargar el PDF");
    }
  };

  const toggleSeat = (seatId: number) => {
    setSelectedSeatIds((prev) =>
      prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Crear invitado (cortesía)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de entrada</label>
            <select
              value={selectedTicketTypeId}
              onChange={(e) => {
                setSelectedTicketTypeId(e.target.value === "" ? "" : Number(e.target.value));
                setSelectedSeatIds([]);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white text-gray-900"
            >
              <option value="">Seleccionar</option>
              {ticketTypes.map((tt) => (
                <option key={tt.id} value={tt.id}>
                  {tt.name} {tt.has_seat_map ? "(con mapa)" : "(general)"} — total: {tt.total_stock || 0}, vendidos: {tt.sold_stock || 0}, cortesías: {tt.guest_stock || 0}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del invitado *</label>
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white text-gray-900"
            />
          </div>
          {!hasSeatMap && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white text-gray-900"
              />
            </div>
          )}
        </div>

        {hasSeatMap && selectedTicketType && seats && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">Selecciona sillas libres para asignar como cortesía</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-60 overflow-auto p-3 bg-gray-50 border border-gray-200 rounded-lg">
              {seats.areas
                .filter((a) => a.ticket_type.id === selectedTicketType.id)
                .flatMap((a) =>
                  a.seats
                    .filter((s) => s.status === "free" || s.status === "blocked")
                    .map((s) => (
                      <button
                        key={s.id}
                        onClick={() => toggleSeat(s.id)}
                        className={`px-2 py-1 rounded border text-xs transition-colors ${
                          selectedSeatIds.includes(s.id)
                            ? "bg-brand-500 border-brand-500 text-ink-900 font-semibold"
                            : "bg-white border-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {`${s.row}-${s.number}`}
                      </button>
                    ))
                )}
            </div>
            <p className="text-xs text-gray-500 mt-2">Seleccionadas: {selectedSeatIds.length}</p>
          </div>
        )}

        <div className="flex gap-2 mt-5">
          <button
            disabled={loading}
            onClick={() => handleCreate(false)}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {loading ? "Guardando..." : "Crear invitado"}
          </button>
          <button
            disabled={loading || !guestEmail}
            onClick={() => handleCreate(true)}
            className="px-4 py-2 rounded-lg bg-brand-500 text-sm font-semibold text-ink-900 hover:bg-brand-400 disabled:opacity-50 transition-colors"
          >
            Crear y enviar email
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <h2 className="text-lg font-bold text-gray-900 px-5 pt-5 pb-3">Invitados creados</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Invitado</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Cant./Sillas</th>
                <th className="px-5 py-3 font-medium">Email/Tel</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {guests.map((g) => {
                const tt = ticketTypes.find((t) => t.id === g.ticket_type_id);
                return (
                  <tr key={g.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">{g.guest_name}</td>
                    <td className="px-5 py-3 text-gray-600">{tt?.name || g.ticket_type_id}</td>
                    <td className="px-5 py-3 text-gray-600">
                      {g.seat_ids?.length ? `${g.seat_ids.length} silla(s)` : g.quantity}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {g.guest_email || "-"}
                      {g.guest_phone ? ` / ${g.guest_phone}` : ""}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          GUEST_STATUS_STYLE[g.status] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {GUEST_STATUS_LABEL[g.status] || g.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button
                          onClick={() => handleViewPdf(g.id)}
                          className="px-2 py-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-xs flex items-center gap-1 transition-colors"
                        >
                          <FileText className="h-3 w-3" /> PDF
                        </button>
                        {g.guest_email && g.status === "valid" && (
                          <button
                            onClick={() => handleSendEmail(g.id)}
                            className="px-2 py-1 rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-xs flex items-center gap-1 transition-colors"
                          >
                            <Mail className="h-3 w-3" /> Enviar
                          </button>
                        )}
                        {g.status === "valid" && (
                          <button
                            onClick={() => handleDelete(g.id)}
                            className="px-2 py-1 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs transition-colors"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {guests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                    No hay invitados creados aún
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OrganizadorEvento() {
  const params = useParams();
  const eventId = Number(params.id);
  const format = usePriceFormatter();

  const [loading, setLoading] = useState(true);
  const [eventDetail, setEventDetail] = useState<EventDetail | null>(null);
  const [seats, setSeats] = useState<OrganizerSeats | null>(null);
  const [guests, setGuests] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"mapa" | "invitados" | "finanzas">("mapa");
  const [blockMode, setBlockMode] = useState(false);
  const [blockGranularity, setBlockGranularity] = useState<"box" | "seat">("box");
  const [selectedSeats, setSelectedSeats] = useState<Record<string, boolean>>({});
  const [blockReason, setBlockReason] = useState("");
  const [blockLoading, setBlockLoading] = useState(false);
  const [expandedBox, setExpandedBox] = useState<{ ttId: number; ttName: string; color: string; seats: any[]; layout?: BoxLayout | null } | null>(null);
  const boxSeatIdsRef = useRef<Record<number, number[]>>({});

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [ev, st] = await Promise.all([
          api.organizerEvent(eventId),
          api.organizerEventSeats(eventId),
        ]);
        setEventDetail(ev);
        setSeats(st);
        try {
          const g = await api.listGuests(eventId);
          setGuests(g);
        } catch (e) {
          console.error(e);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  // Mapa: colapsa boxes (group_size > 1) en una casilla por box y adapta las
  // áreas al formato que espera SeatMap (TicketSeats).
  const mapBlocks: TicketSeats[] = [];
  const boxAreas: { groupSize: number; block: TicketSeats }[] = [];

  for (const a of seats?.areas || []) {
    if (!a.has_seat_map) continue;
    const groupSize = a.ticket_type.group_size || 1;
    const seatsInRange = (a.seats || []).filter(
      (s) => s.row >= 1 && s.row <= a.rows && s.number >= 1 && s.number <= a.cols
    );

    if (groupSize <= 1) {
      mapBlocks.push({
        ticket_type: a.ticket_type,
        rows: a.rows,
        cols: a.cols,
        free_count: a.free_count,
        occupied_count: a.occupied_count,
        seats: seatsInRange.map((s) => ({
          id: s.id,
          row: s.row,
          number: s.number,
          seat_index: s.seat_index,
          status: s.status,
        })),
      });
      continue;
    }

    // Box: agrupa sillas por celda (row, number)
    const byCell = new Map<string, OrganizerSeat[]>();
    for (const s of seatsInRange) {
      const key = `${s.row}-${s.number}`;
      const list = byCell.get(key) || [];
      list.push(s);
      byCell.set(key, list);
    }

    const collapsed: Seat[] = [];
    let freeBoxes = 0;
    let occupiedBoxes = 0;
    for (const list of byCell.values()) {
      const occupied = list.some((s) => s.status === "occupied");
      const reserved = !occupied && list.some((s) => s.status === "reserved");
      const status: Seat["status"] = occupied ? "occupied" : reserved ? "reserved" : "free";
      if (status === "occupied") occupiedBoxes++;
      else if (status !== "reserved") freeBoxes++;
      const first = list.reduce((min, s) => (s.seat_index < min.seat_index ? s : min), list[0]);
      boxSeatIdsRef.current[first.id] = list.map((s) => s.id);
      collapsed.push({
        id: first.id,
        row: first.row,
        number: first.number,
        seat_index: 1,
        status,
      });
    }

    boxAreas.push({
      groupSize,
      block: {
        ticket_type: a.ticket_type,
        rows: a.rows,
        cols: a.cols,
        free_count: freeBoxes,
        occupied_count: occupiedBoxes,
        seats: collapsed,
      },
    });
  }

  // Un mapa por cada tamaño de box distinto (el header de SeatMap usa un único boxSize).
  const boxGroups = boxAreas.reduce<Record<number, TicketSeats[]>>((acc, entry) => {
    (acc[entry.groupSize] = acc[entry.groupSize] || []).push(entry.block);
    return acc;
  }, {});

  if (loading) return <div className="h-32 bg-gray-200 rounded-2xl animate-pulse" />;

  if (!eventDetail) {
    return (
      <div>
        <Link
          href="/organizador"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-800"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a mis eventos
        </Link>
        <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          No se pudo cargar el evento
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/organizador"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-800"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a mis eventos
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">{eventDetail.event.title}</h1>
        <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {eventDetail.event.start_date ? new Date(eventDetail.event.start_date).toLocaleString() : "-"}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            {eventDetail.event.venue_name || "-"}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              STATUS_STYLE[eventDetail.event.status] || "bg-gray-100 text-gray-600"
            }`}
          >
            {STATUS_LABEL[eventDetail.event.status] || eventDetail.event.status}
          </span>
        </div>
      </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand-50 text-brand-700">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-medium">Recaudado (bruto)</p>
            </div>
            <p className="text-xl font-bold text-ink-900 mt-2">{format(eventDetail.summary.subtotal)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-blue-50 text-blue-700">
                <Receipt className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-medium">Precio base total</p>
            </div>
            <p className="text-xl font-bold text-blue-700 mt-2">{format(eventDetail.summary.base)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-red-50 text-red-600">
                <Percent className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-medium">Retención plataforma</p>
            </div>
            <p className="text-xl font-bold text-red-600 mt-2">-{format(eventDetail.summary.platform_gross)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-amber-50 text-amber-600">
                <Landmark className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-medium">Impuestos a remitir</p>
            </div>
            <p className="text-xl font-bold text-amber-600 mt-2">
              {format(eventDetail.summary.municipal_tax + eventDetail.summary.organizer_tax)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600">
                <Wallet className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-medium">A liquidar</p>
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-2">{format(eventDetail.summary.organizer_gross)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand-50 text-brand-700">
                <Ticket className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-medium">Entradas vendidas</p>
            </div>
            <p className="text-xl font-bold text-ink-900 mt-2">
              {eventDetail.summary.tickets_sold}
              <span className="text-sm font-normal text-gray-500"> / {eventDetail.summary.orders} órdenes</span>
            </p>
          </div>
        </div>

        <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden w-fit">
          <button
            onClick={() => setActiveTab("mapa")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "mapa" ? "bg-brand-500 text-ink-900" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Mapa de ventas
          </button>
          <button
            onClick={() => setActiveTab("invitados")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "invitados" ? "bg-brand-500 text-ink-900" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Invitados
          </button>
          <button
            onClick={() => setActiveTab("finanzas")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "finanzas" ? "bg-brand-500 text-ink-900" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Finanzas
          </button>
        </div>

        {activeTab === "mapa" && eventDetail && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-lg font-bold text-gray-900">Mapa de ventas</h2>
            <p className="text-sm text-gray-500 mb-4">
              Solo lectura. Muestra disponibilidad real (libres/reservados/ocupados). No expone datos de compradores.
            </p>
            {mapBlocks.length === 0 && Object.keys(boxGroups).length === 0 && (
              <div className="border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500">
                Este evento no tiene áreas con mapa de asientos.
              </div>
            )}
            {mapBlocks.length > 0 && (
              <SeatMap
                ticketSeatsList={mapBlocks}
                myUserId={null}
                selected={blockMode ? selectedSeats : {}}
                onToggle={blockMode ? (ttId, seatId) => {
                  const key = `${ttId}-${seatId}`;
                  setSelectedSeats((prev) => ({ ...prev, [key]: !prev[key] }));
                } : () => {}}
                readOnly={!blockMode}
                blockMode={blockMode}
                boxMode={blockGranularity === "box"}
              />
            )}
            {Object.entries(boxGroups).map(([size, blocks]) => (
              <SeatMap
                key={size}
                ticketSeatsList={blocks}
                myUserId={null}
                selected={blockMode ? selectedSeats : {}}
                onToggle={blockMode ? (ttId, seatId) => {
                  if (blockGranularity === "seat") {
                    const key = `${ttId}-${seatId}`;
                    setSelectedSeats((prev) => ({ ...prev, [key]: !prev[key] }));
                  } else {
                    const area = seats?.areas?.find((a: any) => a.ticket_type.id === ttId);
                    const clickedSeat = area?.seats?.find((s: any) => s.id === seatId);
                    const boxSeats = clickedSeat && area
                      ? area.seats.filter((s: any) => s.row === clickedSeat.row && s.number === clickedSeat.number)
                      : [];
                    const boxLayout = area?.ticket_type?.box_layout || null;
                    setExpandedBox({ ttId, ttName: area?.ticket_type?.name || "", color: area?.ticket_type?.color || "#7c3aed", seats: boxSeats, layout: boxLayout });
                  }
                } : () => {}}
                boxMode={blockGranularity === "box"}
                boxSize={Number(size)}
                readOnly={!blockMode}
                blockMode={blockMode}
              />
            ))}
          </div>
        )}

        {activeTab === "mapa" && eventDetail && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Bloqueo de sillas</h2>
                <p className="text-sm text-gray-500">
                  Bloqueá sillas o secciones para reservarlas. Solo vos (o un admin) podés asignarlas como cortesía.
                </p>
              </div>
              <button
                onClick={() => { setBlockMode((v) => !v); setSelectedSeats({}); }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  blockMode ? "bg-amber-500 border-amber-500 text-ink-900" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                {blockMode ? "Salir de modo bloqueo" : "Modo bloqueo"}
              </button>
            </div>

            {blockMode && (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500 font-medium">Modo de selección:</span>
                  <button
                    onClick={() => { setBlockGranularity("box"); setSelectedSeats({}); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      blockGranularity === "box" ? "bg-amber-500 border-amber-500 text-ink-900" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Box completo
                  </button>
                  <button
                    onClick={() => { setBlockGranularity("seat"); setSelectedSeats({}); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      blockGranularity === "seat" ? "bg-amber-500 border-amber-500 text-ink-900" : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Silla individual
                  </button>
                  <span className="text-xs text-gray-400 ml-2">
                    {blockGranularity === "box" ? "Click en un box selecciona las 4 sillas" : "Click en una silla individual"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Motivo (opcional)"
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <Button
                    onClick={async () => {
                      const ids = Object.keys(selectedSeats).filter((k) => selectedSeats[k]).map((k) => Number(k.split("-")[1]));
                      if (ids.length === 0) { alert("Seleccioná al menos una silla"); return; }
                      setBlockLoading(true);
                      try {
                        await api.post(`/organizer/events/${eventId}/seats/block`, { seat_ids: ids, reason: blockReason || undefined });
                        setSelectedSeats({});
                        const st = await api.organizerEventSeats(eventId);
                        setSeats(st);
                        toastSuccess(`${ids.length} silla(s) bloqueada(s).`);
                      } catch (e: any) {
                        toastError(e?.message || "Error al bloquear");
                      } finally {
                        setBlockLoading(false);
                      }
                    }}
                    disabled={blockLoading || Object.values(selectedSeats).filter(Boolean).length === 0}
                  >
                    {blockLoading ? "Bloqueando..." : "Bloquear seleccionadas"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const ids = Object.keys(selectedSeats).filter((k) => selectedSeats[k]).map((k) => Number(k.split("-")[1]));
                      if (ids.length === 0) { alert("Seleccioná al menos una silla"); return; }
                      setBlockLoading(true);
                      try {
                        await api.post(`/organizer/events/${eventId}/seats/unblock`, { seat_ids: ids });
                        setSelectedSeats({});
                        const st = await api.organizerEventSeats(eventId);
                        setSeats(st);
                        toastSuccess(`${ids.length} silla(s) desbloqueada(s).`);
                      } catch (e: any) {
                        toastError(e?.message || "Error al desbloquear");
                      } finally {
                        setBlockLoading(false);
                      }
                    }}
                    disabled={blockLoading || Object.values(selectedSeats).filter(Boolean).length === 0}
                  >
                    {blockLoading ? "Desbloqueando..." : "Desbloquear seleccionadas"}
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Seleccionadas: {Object.values(selectedSeats).filter(Boolean).length}
                </p>
              </>
            )}

            {/* Bloqueo por cantidad para áreas generales */}
            {eventDetail.ticket_types.some((t: any) => !t.has_seat_map) && (
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Bloquear por cantidad (áreas sin mapa)</p>
                <div className="flex flex-wrap items-end gap-3">
                  <select
                    id="block-tt"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    defaultValue=""
                  >
                    <option value="">Seleccionar área</option>
                    {eventDetail.ticket_types.filter((t: any) => !t.has_seat_map).map((t: any) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <input
                    id="block-qty"
                    type="number"
                    min="1"
                    placeholder="Cantidad"
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <Button
                    onClick={async () => {
                      const ttId = Number((document.getElementById("block-tt") as HTMLSelectElement)?.value);
                      const qty = Number((document.getElementById("block-qty") as HTMLInputElement)?.value);
                      if (!ttId || qty < 1) { alert("Seleccioná un área y una cantidad válida"); return; }
                      setBlockLoading(true);
                      try {
                        await api.post(`/organizer/events/${eventId}/seats/block`, { ticket_type_id: ttId, quantity: qty, reason: blockReason || undefined });
                        const st = await api.organizerEventSeats(eventId);
                        setSeats(st);
                        toastSuccess(`${qty} entrada(s) bloqueada(s).`);
                      } catch (e: any) {
                        toastError(e?.message || "Error al bloquear");
                      } finally {
                        setBlockLoading(false);
                      }
                    }}
                    disabled={blockLoading}
                  >
                    Bloquear
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      const ttId = Number((document.getElementById("block-tt") as HTMLSelectElement)?.value);
                      const qty = Number((document.getElementById("block-qty") as HTMLInputElement)?.value);
                      if (!ttId || qty < 1) { alert("Seleccioná un área y una cantidad válida"); return; }
                      setBlockLoading(true);
                      try {
                        await api.post(`/organizer/events/${eventId}/seats/unblock`, { ticket_type_id: ttId, quantity: qty });
                        const st = await api.organizerEventSeats(eventId);
                        setSeats(st);
                        toastSuccess(`${qty} entrada(s) desbloqueada(s).`);
                      } catch (e: any) {
                        toastError(e?.message || "Error al desbloquear");
                      } finally {
                        setBlockLoading(false);
                      }
                    }}
                    disabled={blockLoading}
                  >
                    Desbloquear
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <Modal open={!!expandedBox} onClose={() => setExpandedBox(null)} title={`Bloquear sillas — ${expandedBox?.ttName || ""}`} size="lg">
          {expandedBox && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Seleccioná las sillas del box que querés bloquear o desbloquear. Cada silla es independiente.
              </p>
              {(() => {
                const gs = expandedBox.seats.length;
                const layout: BoxLayout = expandedBox.layout && isValidBoxLayout(expandedBox.layout, gs)
                  ? expandedBox.layout
                  : { top: 0, right: 0, bottom: gs, left: 0 };
                const seatsByIndex = new Map<number, any>();
                [...expandedBox.seats]
                  .sort((a: any, b: any) => (a.seat_index || 0) - (b.seat_index || 0))
                  .forEach((s: any) => seatsByIndex.set(s.seat_index || 1, s));
                const { rows, cols, grid } = boxLayoutToGrid(layout);
                return (
                  <div className="flex justify-center overflow-x-auto">
                    <div className="inline-grid gap-2 p-3 bg-gray-50 rounded-xl" style={{ gridTemplateColumns: `repeat(${cols}, 64px)` }}>
                      {grid.map((row, r) =>
                        row.map((cell, c) => {
                          if (cell.seatIndex == null) {
                            return <div key={`${r}-${c}`} className="w-16 h-16" />;
                          }
                          const seat = seatsByIndex.get(cell.seatIndex);
                          if (!seat) {
                            return <div key={`${r}-${c}`} className="w-16 h-16" />;
                          }
                          const key = `${expandedBox.ttId}-${seat.id}`;
                          const isSelected = !!selectedSeats[key];
                          const isBlocked = seat.status === "blocked";
                          return (
                            <button
                              key={seat.id}
                              type="button"
                              onClick={() => setSelectedSeats((prev) => ({ ...prev, [key]: !prev[key] }))}
                              title={`Silla ${seat.seat_index} — ${isBlocked ? "Bloqueada" : "Libre"}`}
                              className={`w-16 h-16 rounded-xl border-2 flex flex-col items-center justify-center transition-all ${
                                isSelected
                                  ? "border-amber-500 bg-amber-50"
                                  : isBlocked
                                  ? "border-gray-400 bg-gray-200"
                                  : "border-gray-300 bg-white hover:border-gray-400"
                              }`}
                            >
                              <span className="text-lg font-bold text-gray-900 leading-none">{seat.seat_index}</span>
                              <span className={`text-[10px] mt-0.5 ${isBlocked ? "text-gray-500" : "text-emerald-600"}`}>
                                {isBlocked ? "Bloqueada" : "Libre"}
                              </span>
                            </button>
                          );
                        }),
                      )}
                    </div>
                  </div>
                );
              })()}
              <p className="text-xs text-gray-500">
                Seleccionadas: {Object.values(selectedSeats).filter(Boolean).length}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="Motivo (opcional)"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <Button
                  onClick={async () => {
                    const ids = Object.keys(selectedSeats).filter((k) => selectedSeats[k]).map((k) => Number(k.split("-")[1]));
                    if (ids.length === 0) { alert("Seleccioná al menos una silla"); return; }
                    setBlockLoading(true);
                    try {
                      await api.post(`/organizer/events/${eventId}/seats/block`, { seat_ids: ids, reason: blockReason || undefined });
                      setSelectedSeats({});
                      setExpandedBox(null);
                      const st = await api.organizerEventSeats(eventId);
                      setSeats(st);
                      toastSuccess(`${ids.length} silla(s) bloqueada(s).`);
                    } catch (e: any) {
                      toastError(e?.message || "Error al bloquear");
                    } finally {
                      setBlockLoading(false);
                    }
                  }}
                  disabled={blockLoading || Object.values(selectedSeats).filter(Boolean).length === 0}
                >
                  {blockLoading ? "Bloqueando..." : "Bloquear seleccionadas"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    const ids = Object.keys(selectedSeats).filter((k) => selectedSeats[k]).map((k) => Number(k.split("-")[1]));
                    if (ids.length === 0) { alert("Seleccioná al menos una silla"); return; }
                    setBlockLoading(true);
                    try {
                      await api.post(`/organizer/events/${eventId}/seats/unblock`, { seat_ids: ids });
                      setSelectedSeats({});
                      setExpandedBox(null);
                      const st = await api.organizerEventSeats(eventId);
                      setSeats(st);
                      toastSuccess(`${ids.length} silla(s) desbloqueada(s).`);
                    } catch (e: any) {
                      toastError(e?.message || "Error al desbloquear");
                    } finally {
                      setBlockLoading(false);
                    }
                  }}
                  disabled={blockLoading || Object.values(selectedSeats).filter(Boolean).length === 0}
                >
                  {blockLoading ? "Desbloqueando..." : "Desbloquear seleccionadas"}
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {activeTab === "invitados" && eventDetail && (

          <InvitadosTab
            eventId={eventId}
            guests={guests}
            setGuests={setGuests}
            ticketTypes={(seats?.areas || []).map((a) => a.ticket_type)}
            seats={seats}
            setSeats={setSeats}
          />
        )}

        {activeTab === "finanzas" && eventDetail && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <h2 className="text-lg font-bold text-gray-900 px-5 pt-5 pb-3">Finanzas</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-5 py-3 font-medium">Tipo de entrada</th>
                    <th className="px-5 py-3 font-medium text-right">Precio</th>
                    <th className="px-5 py-3 font-medium text-right">Vendidas</th>
                    <th className="px-5 py-3 font-medium text-right">Subtotal</th>
                    <th className="px-5 py-3 font-medium text-right">Precio base</th>
                    <th className="px-5 py-3 font-medium text-right">Retención plat.</th>
                    <th className="px-5 py-3 font-medium text-right">Impuestos a remitir</th>
                    <th className="px-5 py-3 font-medium text-right">A liquidar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {eventDetail.ticket_types.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-gray-500">
                        Todavía no hay ventas para este evento
                      </td>
                    </tr>
                  )}
                  {eventDetail.ticket_types.map((tt, idx) => (
                    <tr key={idx}>
                      <td className="px-5 py-3 font-medium text-gray-900">{tt.name}</td>
                      <td className="px-5 py-3 text-right">{format(tt.price)}</td>
                      <td className="px-5 py-3 text-right">{tt.tickets_sold}</td>
                      <td className="px-5 py-3 text-right">{format(tt.subtotal)}</td>
                      <td className="px-5 py-3 text-right text-blue-700">{format(tt.organizer_gross - tt.municipal_tax - tt.organizer_tax)}</td>
                      <td className="px-5 py-3 text-right text-red-600">-{format(tt.platform_gross)}</td>
                      <td className="px-5 py-3 text-right text-amber-600">{format(tt.municipal_tax + tt.organizer_tax)}</td>
                      <td className="px-5 py-3 text-right font-semibold text-emerald-600">{format(tt.organizer_gross)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-gray-200 bg-gray-50">
                  <tr className="font-semibold text-gray-900">
                    <td className="px-5 py-3" colSpan={3}>Total</td>
                    <td className="px-5 py-3 text-right">{format(eventDetail.summary.subtotal)}</td>
                    <td className="px-5 py-3 text-right text-blue-700">{format(eventDetail.summary.base)}</td>
                    <td className="px-5 py-3 text-right text-red-600">-{format(eventDetail.summary.platform_gross)}</td>
                    <td className="px-5 py-3 text-right text-amber-600">{format(eventDetail.summary.municipal_tax + eventDetail.summary.organizer_tax)}</td>
                    <td className="px-5 py-3 text-right text-emerald-600">{format(eventDetail.summary.organizer_gross)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
    </div>
  );
}

export default OrganizadorEvento;