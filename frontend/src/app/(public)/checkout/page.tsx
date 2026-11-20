"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { formatAmount, formatMoney, useCurrency, type Currency } from "@/lib/currency";
import { useSiteConfig, round2 } from "@/lib/siteConfig";
import { breakdownPrice } from "@/lib/pricing";
import { paymentDataPoints } from "@/lib/paymentMethods";
import { EventSeats, Order, PaymentMethod, User } from "@/lib/types";
import { parseServerDate } from "@/lib/datetime";
import { Button, EmptyState, Modal } from "@/components/ui";
import {
  ChevronLeft, CreditCard, Lock, Ticket, CheckCircle, Clock, Landmark,
  Copy, Check, Upload, X, FileText, Paperclip, User as UserIcon, ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  startCheckoutAttempt,
  updateCheckoutAttemptStep,
  logCheckoutAttemptError,
  completeCheckoutAttempt,
} from "@/lib/checkout-attempts";

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, user, updateUser } = useAuth();
  const { bsRate, setCurrency } = useCurrency();
  const { cart, clearCart, setCart } = useCart();
  const { config } = useSiteConfig();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId, setMethodId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [checkingSeats, setCheckingSeats] = useState(true);
  const [reference, setReference] = useState("");
  // Datos de contacto que se exigen y se guardan en el perfil al comprar.
  const [phone, setPhone] = useState("");
  const [cedula, setCedula] = useState("");
  // Comprobante de pago (solo para métodos que lo requieren).
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptName, setReceiptName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [terms, setTerms] = useState(false);
  const [copied, setCopied] = useState("");
  const [reservedUntil, setReservedUntil] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [checkoutAttemptId, setCheckoutAttemptId] = useState<number | null>(null);
  // Cupón de descuento aplicado en el checkout.
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [couponError, setCouponError] = useState("");
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cualquier cambio en el carrito invalida el descuento calculado.
  const cartSignature = JSON.stringify(cart.items);
  useEffect(() => {
    setAppliedCoupon(null);
    setCouponMessage("");
    setCouponError("");
  }, [cartSignature]);

  const event = cart.event;
  const selectedMethod = methods.find((m) => m.id === methodId) || null;
  const orderMethod = order ? methods.find((m) => m.id === order.payment_method_id) || null : null;

  // El importe se muestra en la moneda del método de pago elegido; si el método
  // cobra en Bs. convertimos con la tasa activa, si no mostramos USD.
  const displayCurrency: Currency = ((order ? orderMethod : selectedMethod)?.currency === "VES" ? "VES" : "USD");
  const format = (usdAmount: number) => formatMoney(usdAmount, displayCurrency, bsRate);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(`/login?redirect=/checkout`);
      return;
    }
    if (!event) return;
    api
      .get<PaymentMethod[]>("/payment-methods")
      .then((data) => {
        const active = data.filter((m) => m.is_active);
        setMethods(active);
        if (active.length) setMethodId(active[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los métodos de pago"));
  }, [isAuthenticated, event, router]);

  useEffect(() => {
    if (!isAuthenticated || !event) return;
    const itemsSnapshot = Object.entries(cart.items)
      .filter(([, item]) => item.quantity > 0)
      .map(([ticketTypeId, item]) => ({
        ticket_type_id: Number(ticketTypeId),
        quantity: item.quantity,
        seat_ids: item.seat_ids,
        mode: item.mode,
      }));
    let total = 0;
    try {
      for (const it of itemsSnapshot) {
        const block = (event as any).ticket_types?.find((t: any) => t.id === it.ticket_type_id);
        if (block) total += Number(block.price_usd || 0) * it.quantity;
      }
    } catch {}
    (async () => {
      const attempt = await startCheckoutAttempt({ event_id: event.id, items: itemsSnapshot, estimated_total: total });
      if (attempt?.id) setCheckoutAttemptId(attempt.id);
    })();
  }, [isAuthenticated, event]);

  // La moneda global (barra de navegación y resto del sitio) sigue al método de
  // pago elegido: si el método cobra en Bs. pasamos a VES y si no, a USD. Así el
  // checkout y el selector de la barra quedan siempre alineados.
  useEffect(() => {
    const active = orderMethod ?? selectedMethod;
    if (!active) return;
    setCurrency(active.currency === "VES" ? "VES" : "USD");
  }, [selectedMethod, orderMethod, setCurrency]);

  // Precarga los datos de contacto desde el perfil una sola vez, apenas el usuario
  // está disponible. Se hace durante el render (patrón recomendado por React para
  // "ajustar estado cuando cambia una prop") en vez de un efecto, y no pisa lo que
  // el comprador ya haya escrito.
  const [loadedUserId, setLoadedUserId] = useState<number | null>(null);
  if (user && user.id !== loadedUserId) {
    setLoadedUserId(user.id);
    setPhone((prev) => prev || user.phone || "");
    setCedula((prev) => prev || user.cedula || "");
  }

  // Reloj para la cuenta atrás de la reserva de asientos.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Verifica que los asientos reservados sigan vigentes: la reserva expira a los
  // 10 minutos y el backend la libera al pedir el mapa de asientos, así que un
  // asiento propio que vuelve como "free" ya no está reservado.
  useEffect(() => {
    if (!isAuthenticated || !event) return;
    let cancelled = false;
    (async () => {
      try {
        const seats = await api.get<EventSeats>(`/events/${event.id}/seats`);
        if (cancelled) return;
        const lost = seats.ticket_types.some((block) =>
          block.seats.some((s) => {
            if (!cart.items[block.ticket_type.id]?.seat_ids.includes(s.id)) return false;
            return s.status === "free" || s.reserved_by !== user?.id;
          })
        );
        if (lost) {
          setError("Algunas reservas de asientos vencieron. Volvé al evento para elegirlas de nuevo.");
        }
        // Solo cuentan las sillas que están en este carrito (no otras reservas
        // viejas del usuario) y el backend las manda en UTC sin zona horaria.
        const cartSeatIds = new Set(Object.values(cart.items).flatMap((item) => item.seat_ids));
        const untils = seats.ticket_types
          .flatMap((block) => block.seats)
          .filter((s) => cartSeatIds.has(s.id) && s.reserved_by === user?.id && s.reserved_until)
          .map((s) => parseServerDate(s.reserved_until as string));
        setReservedUntil(untils.length ? Math.min(...untils) : null);
      } catch {
        /* si no se puede verificar, dejamos que el backend valide al confirmar */
      } finally {
        if (!cancelled) setCheckingSeats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, event, cart.items, user?.id]);

  async function copyToClipboard(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* el navegador puede bloquear el portapapeles; sin acción */
    }
  }

  async function handleReceiptFile(file: File | undefined | null) {
    if (!file) return;
    setError("");
    if (file.size > 5 * 1024 * 1024) {
      setError("El comprobante no puede superar los 5 MB.");
      logCheckoutAttemptError(checkoutAttemptId, "upload_failed", "size_exceeded");
      updateCheckoutAttemptStep(checkoutAttemptId, { step: "upload_receipt" });
      return;
    }
    setUploading(true);
    updateCheckoutAttemptStep(checkoutAttemptId, { step: "upload_receipt", payment_method_id: methodId });
    try {
      const { url } = await api.upload<{ url: string }>("/orders/receipt", file);
      setReceiptUrl(url);
      setReceiptName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el comprobante");
      logCheckoutAttemptError(checkoutAttemptId, "upload_failed", e instanceof Error ? e.message : "unknown");
    } finally {
      setUploading(false);
    }
  }

  /** Libera sillas reservadas; si falla, el backend las libera al vencer el TTL. */
  async function releaseSeats(seatIds: number[]) {
    if (!event || seatIds.length === 0) return;
    try {
      await api.post(`/events/${event.id}/seats/release`, { seat_ids: seatIds });
    } catch {
      /* la reserva expira sola a los 10 minutos */
    }
  }

  async function removeLine(ticketTypeId: number) {
    if (!event || removingId != null) return;
    const item = cart.items[ticketTypeId];
    if (!item) return;
    setRemovingId(ticketTypeId);
    await releaseSeats(item.seat_ids);
    const nextItems = { ...cart.items };
    delete nextItems[ticketTypeId];
    if (Object.keys(nextItems).length === 0) clearCart();
    else setCart({ event, items: nextItems });
    setRemovingId(null);
  }

  async function emptyCart() {
    if (!event) return;
    setConfirmClear(false);
    const seatIds = Object.values(cart.items).flatMap((item) => item.seat_ids);
    await releaseSeats(seatIds);
    clearCart();
  }

  async function handlePay() {
    if (!event) return;
    if (!methodId) {
      setError("Elegí un método de pago");
      return;
    }
    const method = methods.find((m) => m.id === methodId);
    if (!phone.trim()) {
      setError("Ingresá tu teléfono: lo usamos para contactarte por esta compra.");
      return;
    }
    if (!cedula.trim()) {
      setError("Ingresá tu cédula: la necesitamos para emitir tus boletos.");
      return;
    }
    if (method?.requires_reference && !reference.trim()) {
      setError("Este método de pago requiere una referencia. Ingresala para continuar.");
      return;
    }
    if (method?.requires_receipt && !receiptUrl) {
      setError("Este método de pago requiere que adjuntes el comprobante de pago.");
      return;
    }
    if (!terms) {
      setError("Debés aceptar los términos y condiciones para continuar.");
      return;
    }
    const items = Object.entries(cart.items)
      .filter(([, item]) => item.quantity > 0)
      .map(([ticketTypeId, item]) => ({
        ticket_type_id: Number(ticketTypeId),
        quantity: item.quantity,
        ...(item.seat_ids.length ? { seat_ids: item.seat_ids } : {}),
        ...(item.mode ? { mode: item.mode } : {}),
      }));

    setSubmitting(true);
    setError("");
    updateCheckoutAttemptStep(checkoutAttemptId, { step: method?.requires_receipt ? "upload_receipt" : "payment", payment_method_id: methodId });
    try {
      // Los datos de contacto quedan guardados en el perfil para próximas compras.
      if (user && (phone.trim() !== (user.phone || "") || cedula.trim() !== (user.cedula || ""))) {
        const updated = await api.patch<User>("/auth/me", { phone: phone.trim(), cedula: cedula.trim() });
        updateUser(updated);
      }
      const created = await api.post<Order>("/orders", {
        items,
        payment_method_id: methodId,
        reference: reference.trim() || undefined,
        receipt_url: receiptUrl || undefined,
        coupon_code: appliedCoupon?.code || undefined,
        terms_accepted: terms,
      });
      setOrder(created);
      completeCheckoutAttempt(checkoutAttemptId, created.id);
      clearCart();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo completar la compra");
      logCheckoutAttemptError(checkoutAttemptId, "order_create_failed", e instanceof Error ? e.message : "unknown");
    } finally {
      setSubmitting(false);
    }
  }

  if (!event) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20">
        <EmptyState message="Tu carrito está vacío." />
        <div className="text-center">
          <Button onClick={() => router.push("/eventos")}>Ver eventos</Button>
        </div>
      </div>
    );
  }

  if (order) {
    const isPending = order.status === "pending";
    const orderMethod = methods.find((m) => m.id === order.payment_method_id) || null;
    const orderPoints = orderMethod ? paymentDataPoints(orderMethod) : [];
    // Lo que se cobró quedó fijado en la orden: usamos el snapshot y no la tasa
    // de ahora, así el número que ve el comprador es el que registró el servidor.
    const orderCurrency: Currency = order.payment_currency === "VES" ? "VES" : "USD";
    const orderBsRate = order.payment_rate != null ? Number(order.payment_rate) : bsRate;
    const orderFormat = (usd: number) => formatMoney(usd, orderCurrency, orderBsRate);
    const chargedTotal = Number(order.payment_total ?? order.total);
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          {isPending ? (
            <Clock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          ) : (
            <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isPending ? "Pedido recibido · pendiente de pago" : "¡Compra realizada!"}
          </h1>
          <p className="text-gray-600 mb-1">
            Tu pedido <span className="font-semibold">#{order.id}</span>{" "}
            {isPending ? "quedó registrado, pero aún no está pagado." : "fue confirmado."}
          </p>
          <p className="text-gray-600 mb-6">
            {isPending ? "Total a pagar" : "Total pagado"}:{" "}
            <span className="font-bold text-ink-900">{formatAmount(chargedTotal, orderCurrency)}</span>
          </p>

          {isPending && orderMethod && orderPoints.length > 0 && (
            <div className="max-w-sm mx-auto text-left text-sm bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
              <p className="flex items-center gap-2 font-semibold text-gray-900 mb-3">
                <Landmark className="w-4 h-4" /> {orderMethod.name}
              </p>
              {orderPoints.map((d) => (
                <p key={d.label} className="text-gray-600">
                  {d.label}: <span className="font-medium text-gray-900">{d.value}</span>
                </p>
              ))}
              {orderMethod.account_note && <p className="text-gray-600 mt-2">{orderMethod.account_note}</p>}
              <p className="text-xs text-gray-500 mt-3 border-t border-gray-200 pt-2">
                Usá el número de pedido <strong>#{order.id}</strong> como referencia.
              </p>
            </div>
          )}

          {order.payment_receipt_url && (
            <p className="text-sm text-emerald-700 mb-4 flex items-center justify-center gap-1.5">
              <Paperclip className="w-4 h-4" /> Comprobante adjunto
            </p>
          )}

          {config.show_breakdown &&
            (Number(order.service_fee) > 0 ||
              Number(order.tax) > 0 ||
              Number(order.municipal_tax) > 0) && (
              <div className="max-w-xs mx-auto text-sm text-gray-500 mb-6">
                <div className="flex justify-between">
                  <span>Precio base</span>
                  <span>{orderFormat(Number(order.subtotal))}</span>
                </div>
                {Number(order.service_fee) > 0 && (
                  <div className="flex justify-between">
                    <span>Servicio</span>
                    <span>{orderFormat(Number(order.service_fee))}</span>
                  </div>
                )}
                {Number(order.municipal_tax) > 0 && (
                  <div className="flex justify-between">
                    <span>Impuesto municipal</span>
                    <span>{orderFormat(Number(order.municipal_tax))}</span>
                  </div>
                )}
                {Number(order.tax) > 0 && (
                  <div className="flex justify-between">
                    <span>IVA</span>
                    <span>{orderFormat(Number(order.tax))}</span>
                  </div>
                )}
              </div>
            )}
          <p className="text-sm text-gray-500 mb-6">
            {isPending
              ? "Cuando confirmemos tu pago, tus boletos con código QR aparecerán en la sección de boletos."
              : "Ya podés descargar tus boletos con su código QR desde la sección de boletos."}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-center">
            <Button variant="secondary" onClick={() => router.push("/eventos")}>
              Seguir explorando
            </Button>
            <Button onClick={() => router.push("/boletos")}>
              <Ticket className="w-4 h-4" /> Ver mis boletos
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const lines = event.ticket_types
    .map((tt) => {
      const item = cart.items[tt.id];
      if (!item || item.quantity <= 0) return null;
      const gs = Math.max(1, tt.group_size || 1);
      const lineTotal =
        item.mode === "seat"
          ? item.quantity * Number(tt.individual_price ?? tt.price)
          : (item.quantity / gs) * Number(tt.price);
      return {
        tt,
        quantity: item.quantity,
        seatCount: item.seat_ids.length,
        lineTotal,
      };
    })
    .filter(Boolean) as Array<{
    tt: (typeof event.ticket_types)[number];
    quantity: number;
    seatCount: number;
    lineTotal: number;
  }>;

  const priceTotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const selectedPoints = selectedMethod ? paymentDataPoints(selectedMethod) : [];

  // Mismo cálculo que hace el servidor en orders.py: el precio publicado ya incluye
  // el servicio, el impuesto municipal y el IVA; se descompone en base + cargos. El
  // servicio y el impuesto municipal se pueden personalizar por evento; el IVA no.
  const tickets = lines.reduce((sum, l) => sum + l.quantity, 0);
  const servicePercent = event.platform_fee_percent ?? config.platform_fee_percent;
  const municipalPercent = event.municipal_tax_percent ?? config.municipal_tax_percent;
  // El cupón reduce el precio final; el desglose se recalcula sobre el total con
  // descuento (igual que lo hace el backend al crear la orden).
  const couponDiscount = appliedCoupon ? Math.min(appliedCoupon.discount, priceTotal) : 0;
  const discountedPriceTotal = round2(Math.max(0, priceTotal - couponDiscount));
  const { subtotal, serviceFee, tax, municipalTax, total: grandTotal } = breakdownPrice(
    discountedPriceTotal,
    servicePercent,
    municipalPercent,
    config.tax_percent
  );

  const maxTickets = config.max_tickets_per_order;
  const overTicketLimit = maxTickets > 0 && tickets > maxTickets;
  const belowMinTotal = config.min_order_total > 0 && priceTotal < config.min_order_total;
  const overMaxTotal = config.max_order_total > 0 && priceTotal > config.max_order_total;
  const limitMessage = overTicketLimit
    ? `Solo se permiten ${maxTickets} boletos por orden.`
    : belowMinTotal
      ? `La compra mínima es ${format(config.min_order_total)}.`
      : overMaxTotal
        ? `La compra máxima es ${format(config.max_order_total)}.`
        : null;
  const blocked = !!limitMessage;

  // Cuenta atrás de la reserva (solo si el carrito tiene asientos reservados).
  const hasSeats = lines.some((l) => l.seatCount > 0);
  const msLeft = reservedUntil != null ? reservedUntil - now : null;
  const reservationExpired = msLeft != null && msLeft <= 0;
  const countdown = msLeft != null && msLeft > 0
    ? `${String(Math.floor(msLeft / 60000)).padStart(2, "0")}:${String(Math.floor((msLeft % 60000) / 1000)).padStart(2, "0")}`
    : null;

  const canPay = !submitting && !checkingSeats && !uploading && lines.length > 0 && !!methodId && !blocked;

  async function applyCoupon() {
    const code = couponCode.trim();
    if (!code || !event) return;
    setCheckingCoupon(true);
    setCouponError("");
    setCouponMessage("");
    try {
      const res = await api.post<{
        valid: boolean;
        code?: string;
        discount?: number;
        message?: string;
      }>("/coupons/validate", {
        code,
        event_id: event.id,
        subtotal: priceTotal,
        items: lines.map((l) => ({ ticket_type_id: l.tt.id, subtotal: l.lineTotal })),
      });
      setAppliedCoupon({
        code: res.code || code.toUpperCase(),
        discount: Number(res.discount || 0),
      });
      setCouponMessage(res.message || "Cupón aplicado.");
    } catch (e) {
      setAppliedCoupon(null);
      setCouponError(e instanceof Error ? e.message : "Cupón inválido");
    } finally {
      setCheckingCoupon(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32 lg:pb-24">
      <button
        onClick={() => router.push(`/evento/${event.id}`)}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-800"
      >
        <ChevronLeft className="w-4 h-4" /> Volver al evento
      </button>

      <h1 className="text-3xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        <div className="space-y-6">
          {/* Evento */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-4 p-4 border-b border-gray-100">
              {event.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.image_url} alt={event.title} className="w-20 h-20 rounded-xl object-cover" />
              )}
              <div>
                <p className="font-bold text-gray-900">{event.title}</p>
                <p className="text-sm text-gray-500">
                  {new Date(event.start_date).toLocaleString("es-ES", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {event.venue && <p className="text-sm text-gray-500">{event.venue.name}</p>}
              </div>
            </div>
          </div>

          {/* Datos del comprador */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-1">
              <UserIcon className="w-4 h-4" /> Tus datos
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Tu correo y estos datos se guardan en tu perfil para las próximas compras.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-700">
                  {user?.name || "—"}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
                <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-700 truncate">
                  {user?.email || "—"}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={50}
                  placeholder="0412-1234567"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cédula / RIF <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={cedula}
                  onChange={(e) => setCedula(e.target.value)}
                  maxLength={40}
                  placeholder="V-12345678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            {(!phone.trim() || !cedula.trim()) && (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Completá tu teléfono y cédula para continuar; los guardamos en tu perfil.
              </p>
            )}
          </div>

          {/* Entradas */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-bold text-gray-900">Tus entradas</h2>
              {lines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" /> Vaciar
                </button>
              )}
            </div>
            {lines.length === 0 ? (
              <EmptyState message="No hay entradas en el carrito." />
            ) : (
              <div className="space-y-3">
                {lines.map(({ tt, quantity, seatCount, lineTotal }) => (
                  <div
                    key={tt.id}
                    className="flex items-center justify-between gap-3 p-3 border border-gray-200 rounded-xl"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{tt.name}</p>
                      <p className="text-sm text-gray-500">
                        {quantity} entrada{quantity > 1 ? "s" : ""}
                        {seatCount > 0 && ` · ${seatCount} asiento${seatCount > 1 ? "s" : ""} reservado${seatCount > 1 ? "s" : ""}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-bold text-gray-900">{format(lineTotal)}</span>
                      <button
                        type="button"
                        onClick={() => removeLine(tt.id)}
                        disabled={removingId !== null}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                        aria-label={`Quitar ${tt.name}`}
                        title={`Quitar ${tt.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Método de pago */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-4">Método de pago</h2>
            {methods.length === 0 ? (
              <EmptyState message="No hay métodos de pago disponibles." />
            ) : (
              <div className="space-y-2">
                {methods.map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer ${
                      methodId === m.id ? "border-brand-500 bg-brand-50" : "border-gray-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment-method"
                      checked={methodId === m.id}
                      onChange={() => {
                        setMethodId(m.id);
                        setReceiptUrl("");
                        setReceiptName("");
                      }}
                      className="w-4 h-4"
                    />
                    <CreditCard className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-gray-900">{m.name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {m.currency}
                    </span>
                    {m.type && (
                      <span className="ml-auto text-xs uppercase tracking-wide text-gray-400">{m.type}</span>
                    )}
                  </label>
                ))}
              </div>
            )}

            {selectedMethod && (selectedPoints.length > 0 || selectedMethod.requires_reference || selectedMethod.requires_receipt) && (
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                {selectedPoints.length > 0 && (
                  <>
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2">
                      <Landmark className="w-4 h-4" /> Datos para pagar
                    </p>
                    <div className="text-sm text-gray-600 space-y-1">
                      {selectedPoints.map((d) => (
                        <p key={d.label} className="flex items-center justify-between gap-2">
                          <span>
                            {d.label}: <span className="font-medium text-gray-900">{d.value}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(d.label, d.value)}
                            className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline flex-shrink-0"
                          >
                            {copied === d.label ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {copied === d.label ? "Copiado" : "Copiar"}
                          </button>
                        </p>
                      ))}
                      {selectedMethod.account_note && (
                        <p className="mt-2 text-gray-500">{selectedMethod.account_note}</p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-200 pt-3">
                      <p className="text-sm text-gray-700">
                        Monto a transferir: <span className="font-bold text-gray-900">{format(grandTotal)}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => copyToClipboard("Monto", String(grandTotal))}
                        className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline flex-shrink-0"
                      >
                        {copied === "Monto" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied === "Monto" ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                  </>
                )}
                {selectedMethod.requires_reference && (
                  <label className="block mt-3">
                    <span className="text-xs font-medium text-gray-600">Referencia del pago *</span>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      maxLength={120}
                      placeholder="Ej. número de operación"
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </label>
                )}

                {selectedMethod.requires_receipt && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-600 mb-1">
                      Comprobante de pago <span className="text-red-500">*</span>
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => handleReceiptFile(e.target.files?.[0])}
                    />
                    {receiptUrl ? (
                      <div className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                        {/\.pdf($|\?)/i.test(receiptUrl) ? (
                          <div className="grid place-items-center w-12 h-12 rounded-lg border border-gray-200 bg-gray-50 flex-shrink-0">
                            <FileText className="w-6 h-6 text-red-500" />
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={receiptUrl}
                            alt="Comprobante"
                            className="w-12 h-12 rounded-lg border border-gray-200 object-cover flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-emerald-700 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> Comprobante adjunto
                          </p>
                          <p className="text-xs text-gray-500 truncate">{receiptName || "Archivo"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptUrl("");
                            setReceiptName("");
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 flex-shrink-0"
                          aria-label="Quitar comprobante"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragging(false);
                          handleReceiptFile(e.dataTransfer.files?.[0]);
                        }}
                        disabled={uploading}
                        className={`w-full flex flex-col items-center justify-center gap-1 py-5 border-2 border-dashed rounded-lg text-sm transition-colors ${
                          dragging ? "border-brand-500 bg-brand-50" : "border-gray-300 hover:border-brand-400"
                        }`}
                      >
                        {uploading ? (
                          <>
                            <Upload className="w-5 h-5 text-gray-400 animate-pulse" />
                            <span className="text-gray-500">Subiendo comprobante…</span>
                          </>
                        ) : (
                          <>
                            <Paperclip className="w-5 h-5 text-gray-400" />
                            <span className="text-gray-700 font-medium">Adjuntar comprobante</span>
                            <span className="text-xs text-gray-400">Imagen o PDF · máx. 5 MB</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Resumen */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:sticky lg:top-6">
          <h2 className="font-bold text-gray-900 mb-4">Resumen</h2>
          <div className="space-y-2 text-sm">
            {lines.map(({ tt, lineTotal }) => (
              <div key={tt.id} className="flex items-center justify-between">
                <span className="text-gray-600">{tt.name}</span>
                <span className="text-gray-900">{format(lineTotal)}</span>
              </div>
            ))}

            {config.show_breakdown && (
              <>
                <p className="text-xs text-gray-400 border-t border-gray-100 pt-2 mt-2">
                  Desglose (IVA e impuestos incluidos)
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-gray-600">Precio base</span>
                  <span className="text-gray-900">{format(subtotal)}</span>
                </div>
                {serviceFee > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Cargo por servicio ({servicePercent}%)</span>
                    <span className="text-gray-900">{format(serviceFee)}</span>
                  </div>
                )}
                {municipalTax > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Impuesto municipal ({municipalPercent}%)</span>
                    <span className="text-gray-900">{format(municipalTax)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">IVA ({config.tax_percent}%)</span>
                    <span className="text-gray-900">{format(tax)}</span>
                  </div>
                )}
              </>
            )}
            {appliedCoupon && (
              <div className="flex items-center justify-between text-emerald-700 font-medium border-t border-gray-100 pt-2 mt-2">
                <span className="flex items-center gap-1.5">
                  Descuento ({appliedCoupon.code})
                  <button
                    type="button"
                    onClick={() => {
                      setAppliedCoupon(null);
                      setCouponMessage("");
                      setCouponCode("");
                    }}
                    className="text-gray-400 hover:text-red-600"
                    aria-label="Quitar cupón"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
                <span>-{format(couponDiscount)}</span>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 mt-3 pt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">¿Tenés un cupón de descuento?</label>
            <div className="flex gap-2">
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyCoupon();
                  }
                }}
                placeholder="CÓDIGO"
                maxLength={50}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={applyCoupon}
                disabled={checkingCoupon || !couponCode.trim()}
              >
                {checkingCoupon ? "..." : appliedCoupon ? "Cambiar" : "Aplicar"}
              </Button>
            </div>
            {couponMessage && (
              <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> {couponMessage}
              </p>
            )}
            {couponError && <p className="mt-2 text-xs text-red-600">{couponError}</p>}
          </div>

          <div className="flex items-center justify-between border-t border-gray-200 mt-4 pt-4">
            <span className="font-semibold text-gray-900">Total</span>
            <span className="text-xl font-bold text-ink-900">{format(grandTotal)}</span>
          </div>

          {hasSeats && msLeft != null && (
            <div className={`mt-4 flex items-center gap-1.5 text-sm ${reservationExpired ? "text-red-600" : "text-amber-600"}`}>
              <Clock className="w-4 h-4" />
              {reservationExpired
                ? "Tu reserva de asientos expiró. Volvé al evento para elegirlos de nuevo."
                : <>Reserva de asientos: <span className="font-bold tabular-nums">{countdown}</span></>}
            </div>
          )}

          {limitMessage && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-sm">
              {limitMessage}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}

          <label className="mt-4 flex items-start gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 flex-shrink-0"
            />
            <span>
              Acepto{" "}
              <a
                href={config.terms_url || "/terminos"}
                target="_blank"
                rel="noreferrer"
                className="text-brand-700 font-medium hover:underline"
              >
                los términos y condiciones
              </a>{" "}
              de la compra.
            </span>
          </label>

          <Button
            onClick={handlePay}
            disabled={!canPay}
            className="w-full justify-center mt-4 py-3"
          >
            <Lock className="w-4 h-4" />
            {submitting ? "Procesando..." : uploading ? "Subiendo comprobante…" : `Pagar ${format(grandTotal)}`}
          </Button>

          {selectedMethod && (
            <p className="text-xs text-gray-400 text-center mt-2">
              Vas a pagar {format(grandTotal)} con {selectedMethod.name}.
            </p>
          )}

          <p className="flex items-center gap-1.5 justify-center text-xs text-gray-400 mt-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Tu pedido queda pendiente de confirmación.
          </p>
        </div>
      </div>

      {/* Barra fija móvil */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-lg font-bold text-ink-900 truncate">{format(grandTotal)}</p>
        </div>
        <Button onClick={handlePay} disabled={!canPay} className="flex-1 justify-center py-3">
          <Lock className="w-4 h-4" />
          {submitting ? "Procesando..." : "Pagar"}
        </Button>
      </div>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="¿Vaciar el carrito?"
        size="lg"
      >
        <p className="text-sm text-gray-600">
          Se quitarán todas las entradas y se liberarán las sillas que tengas reservadas.
        </p>
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmClear(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={emptyCart}>
            <Trash2 className="w-4 h-4" /> Sí, vaciar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
