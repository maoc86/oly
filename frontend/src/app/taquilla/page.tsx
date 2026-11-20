"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { usePosEvents } from "@/lib/pos";
import {
  CashSession, Order, OrganizerSeats, PaymentMethod, PosCatalog, PosSaleItem, TicketSeats, TicketType,
} from "@/lib/types";
import { Button, EmptyState, Input, Modal, Select } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { toastError, toastSuccess } from "@/lib/toast";
import SeatMap from "@/components/SeatMap";
import BoxSeatMap from "@/components/BoxSeatMap";
import { Minus, Plus, Armchair, AlertTriangle, CheckCircle2, Wallet, Loader2 } from "lucide-react";

const EMPTY_BUYER = { name: "", cedula: "", phone: "", email: "" };

type AreaModes = Record<number, "box" | "seat">;

function seatKey(ticketTypeId: number, seatId: number) {
  return `${ticketTypeId}-${seatId}`;
}

/** Modo de venta y tamaño de grupo de un tipo de entrada. */
function typeMeta(t: TicketType, areaModes: AreaModes) {
  const groupSize = Math.max(1, t.group_size || 1);
  const isBox = groupSize > 1;
  const hasIndividual = !!t.has_seat_map && isBox && t.individual_price != null;
  const mode: "box" | "seat" = hasIndividual ? areaModes[t.id] ?? "seat" : "box";
  return { groupSize, isBox, hasIndividual, mode };
}

export default function TaquillaVenderPage() {
  const { user } = useAuth();
  const { events, selectedId, select, loading: loadingEvents } = usePosEvents();

  const [catalog, setCatalog] = useState<PosCatalog | null>(null);
  const [seatsByType, setSeatsByType] = useState<Record<number, TicketSeats>>({});
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [session, setSession] = useState<CashSession | null>(null);

  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [selectedSeats, setSelectedSeats] = useState<Record<string, boolean>>({});
  const [areaModes, setAreaModes] = useState<AreaModes>({});
  const [pickerTypeId, setPickerTypeId] = useState<number | null>(null);

  const [buyer, setBuyer] = useState(EMPTY_BUYER);
  const [methodId, setMethodId] = useState<string>("");
  const [reference, setReference] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<Order | null>(null);

  useEffect(() => {
    api.get<PaymentMethod[]>("/pos/payment-methods").then(setMethods).catch(() => setMethods([]));
  }, []);

  const refreshSeats = useCallback((eventId: number) => {
    return api
      .get<OrganizerSeats>(`/pos/events/${eventId}/seats`)
      .then((s) => {
        const map: Record<number, TicketSeats> = {};
        s.areas.forEach((a) => (map[a.ticket_type.id] = a));
        setSeatsByType(map);
      })
      .catch(() => undefined);
  }, []);

  const refreshSession = useCallback((eventId: number) => {
    return api
      .get<CashSession | null>(`/pos/cash/current?event_id=${eventId}`)
      .then(setSession)
      .catch(() => setSession(null));
  }, []);

  // Al cambiar de evento se recargan catálogo, asientos y caja. El reseteo de la
  // venta en curso se hace en `changeEvent` (handler), no dentro del efecto.
  useEffect(() => {
    if (selectedId == null) return;
    let cancelled = false;
    api
      .get<PosCatalog>(`/pos/events/${selectedId}/catalog`)
      .then((c) => {
        if (!cancelled) setCatalog(c);
      })
      .catch(() => {
        if (!cancelled) setCatalog(null);
      });
    refreshSeats(selectedId);
    refreshSession(selectedId);
    return () => {
      cancelled = true;
    };
  }, [selectedId, refreshSeats, refreshSession]);

  function changeEvent(id: number | null) {
    setCatalog(null);
    setSeatsByType({});
    setSession(null);
    setQuantities({});
    setSelectedSeats({});
    setAreaModes({});
    setLastSale(null);
    setPickerTypeId(null);
    select(id);
  }

  const ticketTypes = useMemo(() => catalog?.ticket_types ?? [], [catalog]);
  const loadingCatalog = selectedId != null && catalog?.event.id !== selectedId;
  const paymentOptions = useMemo(
    () => methods.map((m) => ({ value: m.id, label: `${m.name} (${m.currency})` })),
    [methods]
  );

  const selectedCount = useMemo(
    () => Object.values(quantities).reduce((a, b) => a + (b || 0), 0),
    [quantities]
  );

  const previewTotal = useMemo(() => {
    let total = 0;
    for (const t of ticketTypes) {
      const qty = quantities[t.id] || 0;
      if (qty <= 0) continue;
      const { groupSize, hasIndividual, mode } = typeMeta(t, areaModes);
      if (hasIndividual && mode === "seat") total += qty * Number(t.individual_price || 0);
      else total += (qty / groupSize) * Number(t.price || 0);
    }
    return total;
  }, [ticketTypes, quantities, areaModes]);

  function seatIdsFor(ticketTypeId: number): number[] {
    return Object.keys(selectedSeats)
      .filter((k) => k.startsWith(`${ticketTypeId}-`))
      .map((k) => Number(k.split("-")[1]))
      .filter((n) => !Number.isNaN(n));
  }

  function availability(t: TicketType) {
    if (t.has_seat_map) return seatsByType[t.id]?.free_count ?? 0;
    return Math.max(0, t.total_stock - t.sold_stock - (t.guest_stock || 0));
  }

  function addQuantity(t: TicketType, delta: number) {
    const { groupSize } = typeMeta(t, areaModes);
    const step = t.has_seat_map ? 1 : groupSize;
    const limit = availability(t);
    setQuantities((prev) => {
      const current = prev[t.id] || 0;
      const next = Math.max(0, Math.min(current + delta * step, Math.max(limit, current)));
      return { ...prev, [t.id]: next };
    });
  }

  function clearType(ticketTypeId: number) {
    setQuantities((prev) => ({ ...prev, [ticketTypeId]: 0 }));
    setSelectedSeats((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (k.startsWith(`${ticketTypeId}-`)) delete next[k];
      });
      return next;
    });
  }

  function toggleSeat(ticketTypeId: number, seatId: number) {
    const key = seatKey(ticketTypeId, seatId);
    const isSelected = !!selectedSeats[key];
    setSelectedSeats((prev) => {
      const next = { ...prev };
      if (isSelected) delete next[key];
      else next[key] = true;
      return next;
    });
    setQuantities((prev) => ({
      ...prev,
      [ticketTypeId]: Math.max(0, (prev[ticketTypeId] || 0) + (isSelected ? -1 : 1)),
    }));
  }

  function toggleBox(ticketTypeId: number, seatIds: number[]) {
    const allMine = seatIds.every((id) => selectedSeats[seatKey(ticketTypeId, id)]);
    setSelectedSeats((prev) => {
      const next = { ...prev };
      if (allMine) seatIds.forEach((id) => delete next[seatKey(ticketTypeId, id)]);
      else seatIds.forEach((id) => (next[seatKey(ticketTypeId, id)] = true));
      return next;
    });
    setQuantities((prev) => ({
      ...prev,
      [ticketTypeId]: Math.max(0, (prev[ticketTypeId] || 0) + (allMine ? -seatIds.length : seatIds.length)),
    }));
  }

  async function submit() {
    if (selectedId == null) return;
    if (!session) {
      toastError("Abrí la caja del evento antes de vender.");
      return;
    }
    const items: PosSaleItem[] = [];
    for (const t of ticketTypes) {
      const qty = quantities[t.id] || 0;
      if (qty <= 0) continue;
      const { isBox, hasIndividual, mode } = typeMeta(t, areaModes);
      let itemMode: "box" | "seat" | undefined;
      if (t.has_seat_map) itemMode = hasIndividual ? mode : isBox ? "box" : undefined;
      items.push({
        ticket_type_id: t.id,
        quantity: qty,
        seat_ids: seatIdsFor(t.id),
        ...(itemMode ? { mode: itemMode } : {}),
      });
    }
    if (items.length === 0) {
      toastError("Elegí al menos una entrada.");
      return;
    }
    if (!methodId) {
      toastError("Elegí el método de pago.");
      return;
    }

    setSubmitting(true);
    try {
      const order = await api.post<Order>("/pos/sales", {
        event_id: selectedId,
        items,
        payment_method_id: Number(methodId),
        reference: reference.trim() || undefined,
        buyer: {
          name: buyer.name.trim(),
          cedula: buyer.cedula.trim(),
          phone: buyer.phone.trim(),
          email: buyer.email.trim(),
        },
        send_email: sendEmail && !!buyer.email.trim(),
      });
      setLastSale(order);
      setQuantities({});
      setSelectedSeats({});
      setAreaModes({});
      setBuyer(EMPTY_BUYER);
      setReference("");
      setSendEmail(false);
      toastSuccess(`Venta #${order.id} cobrada.`);
      await Promise.allSettled([refreshSeats(selectedId), refreshSession(selectedId)]);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "No se pudo cobrar la venta.");
      await refreshSeats(selectedId);
    } finally {
      setSubmitting(false);
    }
  }

  const pickerType = pickerTypeId != null ? ticketTypes.find((t) => t.id === pickerTypeId) || null : null;
  const pickerBlock = pickerTypeId != null ? seatsByType[pickerTypeId] : null;

  if (loadingEvents) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vender</h1>
          <p className="text-sm text-gray-500 mt-1">Venta presencial cobrada en el momento.</p>
        </div>
        <div className="sm:w-80">
          <Select
            label="Evento"
            value={selectedId ?? ""}
            onChange={(e) => changeEvent(e.target.value ? Number(e.target.value) : null)}
            options={events.map((e) => ({ value: e.id, label: e.title }))}
            placeholder={events.length ? "Elegí un evento" : "Sin eventos asignados"}
            disabled={events.length === 0}
          />
        </div>
      </div>

      {events.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <EmptyState message="No tenés eventos asignados. Pedile a un administrador que te asigne alguno." />
        </div>
      )}

      {selectedId != null && !session && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="flex-1 text-sm">
            La caja está cerrada. Para empezar a vender tenés que <strong>abrir la caja</strong> del evento.
          </p>
          <Link
            href="/taquilla/caja"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-400"
          >
            <Wallet className="w-4 h-4" /> Ir a Caja
          </Link>
        </div>
      )}

      {lastSale && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-green-900">
                Venta #{lastSale.id} cobrada por {formatPrice(lastSale.total)}
              </p>
              <p className="text-sm text-green-800 mt-0.5">
                {lastSale.items.reduce((a, i) => a + (i.quantity || 0), 0)} boleto(s) emitido(s)
                {lastSale.payment_method_name ? ` · ${lastSale.payment_method_name}` : ""}.
              </p>
            </div>
            <button
              onClick={() => setLastSale(null)}
              className="text-sm font-medium text-green-800 hover:underline shrink-0"
            >
              Nueva venta
            </button>
          </div>
        </div>
      )}

      {selectedId != null && (
        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Tipos de entrada */}
          <div className="lg:col-span-2 space-y-4">
            {loadingCatalog ? (
              <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
            ) : ticketTypes.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                <EmptyState message="Este evento todavía no tiene tipos de entrada." />
              </div>
            ) : (
              ticketTypes.map((t) => {
                const { isBox, groupSize, hasIndividual, mode } = typeMeta(t, areaModes);
                const free = availability(t);
                const qty = quantities[t.id] || 0;
                const soldOut = free <= 0 && qty === 0;
                return (
                  <div
                    key={t.id}
                    className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${soldOut ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {t.color && (
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                          )}
                          <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {formatPrice(t.price)}
                          {isBox && ` · box de ${groupSize}`}
                          {hasIndividual && ` · silla ${formatPrice(t.individual_price)}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{free} disponible(s)</p>
                      </div>

                      {t.has_seat_map ? (
                        <Button
                          variant={qty > 0 ? "primary" : "secondary"}
                          onClick={() => setPickerTypeId(t.id)}
                          disabled={soldOut}
                        >
                          <Armchair className="w-4 h-4" />
                          {qty > 0 ? `${qty} elegida(s)` : "Elegir sillas"}
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => addQuantity(t, -1)}
                            disabled={qty <= 0}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                            aria-label="Quitar"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-semibold text-gray-900">{qty}</span>
                          <button
                            type="button"
                            onClick={() => addQuantity(t, 1)}
                            disabled={qty >= free}
                            className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                            aria-label="Agregar"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {t.has_seat_map && qty > 0 && (
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          {isBox && mode === "box" ? `${qty / groupSize} box(es)` : `${qty} silla(s)`}
                        </span>
                        <button onClick={() => clearType(t.id)} className="text-gray-400 hover:text-red-600">
                          Quitar todas
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Cobro */}
          <div className="lg:sticky lg:top-24 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Cobro</h2>

            <div className="space-y-3">
              <Input
                label="Comprador (opcional)"
                placeholder="Nombre y apellido"
                value={buyer.name}
                onChange={(e) => setBuyer({ ...buyer, name: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Cédula" value={buyer.cedula} onChange={(e) => setBuyer({ ...buyer, cedula: e.target.value })} />
                <Input label="Teléfono" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} />
              </div>
              <Input
                label="Correo"
                type="email"
                value={buyer.email}
                onChange={(e) => setBuyer({ ...buyer, email: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  disabled={!buyer.email.trim()}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-4 h-4"
                />
                Enviar los boletos por correo
              </label>
            </div>

            <Select
              label="Método de pago"
              value={methodId}
              onChange={(e) => setMethodId(e.target.value)}
              options={paymentOptions}
              placeholder={paymentOptions.length ? "Elegí un método" : "Sin métodos habilitados"}
              disabled={paymentOptions.length === 0}
            />

            <Input
              label="Referencia (opcional)"
              placeholder="Nº de transferencia, etc."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />

            <div className="border-t border-gray-100 pt-4 space-y-1">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>Entradas</span>
                <span>{selectedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-gray-900">{formatPrice(previewTotal)}</span>
              </div>
            </div>

            <Button
              className="w-full justify-center"
              onClick={submit}
              disabled={submitting || !session || selectedCount === 0 || !methodId}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {submitting ? "Cobrando..." : "Cobrar y emitir"}
            </Button>
            {!session && <p className="text-xs text-amber-700 text-center">Abrí la caja para poder vender.</p>}
          </div>
        </div>
      )}

      {/* Selector de asientos */}
      <Modal
        open={pickerType != null}
        onClose={() => setPickerTypeId(null)}
        title={pickerType ? `Elegir sillas · ${pickerType.name}` : ""}
        size="4xl"
      >
        {pickerType && (
          <div className="space-y-4">
            {!pickerBlock ? (
              <p className="text-sm text-gray-500">Cargando el mapa de asientos...</p>
            ) : (
              (() => {
                const { isBox, hasIndividual, mode } = typeMeta(pickerType, areaModes);
                const qty = quantities[pickerType.id] || 0;
                return (
                  <>
                    {hasIndividual && (
                      <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setAreaModes((prev) => ({ ...prev, [pickerType.id]: "seat" }))}
                          className={`px-3 py-2 text-sm font-medium ${
                            mode === "seat" ? "bg-brand-500 text-ink-900" : "bg-white text-gray-600"
                          }`}
                        >
                          Por silla ({formatPrice(pickerType.individual_price)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAreaModes((prev) => ({ ...prev, [pickerType.id]: "box" }))}
                          className={`px-3 py-2 text-sm font-medium border-l border-gray-300 ${
                            mode === "box" ? "bg-brand-500 text-ink-900" : "bg-white text-gray-600"
                          }`}
                        >
                          Box completo ({formatPrice(pickerType.price)})
                        </button>
                      </div>
                    )}

                    {isBox ? (
                      <BoxSeatMap
                        block={pickerBlock}
                        myUserId={user?.id ?? null}
                        mode={mode}
                        selected={selectedSeats}
                        onToggleBox={(seatIds) => toggleBox(pickerType.id, seatIds)}
                        onToggleSeat={(seatId) => toggleSeat(pickerType.id, seatId)}
                      />
                    ) : (
                      <SeatMap
                        ticketSeatsList={[pickerBlock]}
                        myUserId={user?.id ?? null}
                        selected={selectedSeats}
                        onToggle={toggleSeat}
                      />
                    )}

                    <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                      <span className="text-sm text-gray-600">
                        {qty} elegida(s) ·{" "}
                        {hasIndividual && mode === "seat"
                          ? formatPrice(qty * Number(pickerType.individual_price || 0))
                          : formatPrice(
                              (qty / typeMeta(pickerType, areaModes).groupSize) * Number(pickerType.price || 0)
                            )}
                      </span>
                      <Button onClick={() => setPickerTypeId(null)}>Listo</Button>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
