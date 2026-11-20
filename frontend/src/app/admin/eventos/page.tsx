"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Event, Venue, Category } from "@/lib/types";
import { useSiteConfig } from "@/lib/siteConfig";
import { breakdownPrice } from "@/lib/pricing";
import { formatAmount } from "@/lib/currency";
import { ImageSize, loadImageSize, mobileRatioWarning, ratioWarning } from "@/lib/imageRatio";
import { BoxLayout, boxLayoutToGrid, boxLayoutTotal, isValidBoxLayout, presetLayout, BOX_PRESETS, BoxLayoutPreset } from "@/lib/boxLayout";
import { Button, Input, TextArea, Select, Modal, Badge, EmptyState } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import {
  Plus, Pencil, Trash2, UploadCloud, Map as MapIcon, LayoutGrid as LayoutGridIcon,
  Users, Info, Ticket as TicketIcon, TicketPercent, MapPin, Image as ImageIcon,
  ChevronUp, ChevronDown, Copy, Search, Armchair, Hash, CalendarClock, AlertCircle, Eye, TriangleAlert, X,
} from "lucide-react";
import SeatMapEditor from "@/components/SeatMapEditor";
import MiniMapEditor from "@/components/MiniMapEditor";

const PAGE_SIZE = 24;

interface TicketTypeForm {
  id?: number;
  event_id?: number;
  name: string;
  price: string;
  // Precio por silla individual en áreas por box. Vacío = solo se vende el box completo.
  individual_price: string;
  total_stock: string;
  sold_stock?: string;
  group_size: string;
  has_seat_map: boolean;
  map_rows: string;
  map_cols: string;
  color?: string;
  sale_start?: string;
  sale_end?: string;
  box_layout?: { top: number; right: number; bottom: number; left: number } | null;
  _key?: string;
}

interface EventForm {
  id?: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  venue_id: number | null;
  category_id: number | null;
  organizer_id: number | null;
  image_url: string;
  mobile_image_url: string;
  map_config: Record<string, unknown> | null;
  status: string;
  // Diseño del boleto digital asignado (null = plantilla por defecto).
  ticket_template_id: number | null;
  // Precios e impuestos: si fees_custom es false, el evento usa la config global.
  fees_custom: boolean;
  platform_fee_percent: string;
  municipal_tax_percent: string;
  ticket_types: TicketTypeForm[];
}

const emptyForm: EventForm = {
  title: "",
  description: "",
  start_date: "",
  end_date: "",
  venue_id: null,
  category_id: null,
  organizer_id: null,
  image_url: "",
  mobile_image_url: "",
  map_config: null,
  status: "draft",
  ticket_template_id: null,
  fees_custom: false,
  platform_fee_percent: "",
  municipal_tax_percent: "",
  ticket_types: [],
};

/** Recorta un ISO a "YYYY-MM-DDTHH:MM" para los inputs datetime-local. */
function toLocalInput(value?: string | null): string {
  if (!value) return "";
  return value.length >= 16 ? value.slice(0, 16) : value;
}

function newArea(hasSeatMap: boolean, overrides: Partial<TicketTypeForm> = {}): TicketTypeForm {
  return {
    name: hasSeatMap ? "" : "Entrada general",
    price: "0",
    individual_price: "",
    total_stock: "0",
    sold_stock: "0",
    group_size: "1",
    has_seat_map: hasSeatMap,
    map_rows: hasSeatMap ? "12" : "0",
    map_cols: hasSeatMap ? "14" : "0",
    _key: crypto.randomUUID(),
    ...overrides,
  };
}

export default function AdminEventosPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [organizers, setOrganizers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [ticketTemplates, setTicketTemplates] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [original, setOriginal] = useState<Event | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mobileUploading, setMobileUploading] = useState(false);
  const [formSizeUrl, setFormSizeUrl] = useState("");
  const [formSize, setFormSize] = useState<ImageSize | null>(null);
  const [mobileSizeUrl, setMobileSizeUrl] = useState("");
  const [mobileFormSize, setMobileFormSize] = useState<ImageSize | null>(null);
  const [duplicating, setDuplicating] = useState<number | null>(null);
  const [mapEditor, setMapEditor] = useState<{ eventId: number; ticketTypeId: number } | null>(null);
  const [miniMapOpen, setMiniMapOpen] = useState(false);
  const [generalPrice, setGeneralPrice] = useState("0");
  const [generalCapacity, setGeneralCapacity] = useState("100");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPrice, setPreviewPrice] = useState("0");
  const skipRef = useRef(0);
  const { config } = useSiteConfig();

  useEffect(() => {
    api.get<Venue[]>("/admin/venues").then(setVenues).catch(() => setVenues([]));
    api.get<Category[]>("/admin/categories").then(setCategories).catch(() => setCategories([]));
    api
      .get<{ id: number; name: string; email: string }[]>("/admin/events/organizers")
      .then(setOrganizers)
      .catch(() => setOrganizers([]));
    api
      .get<{ id: number; name: string; is_active: boolean }[]>("/admin/ticket-templates")
      .then((data) => setTicketTemplates(data.filter((t) => t.is_active)))
      .catch(() => setTicketTemplates([]));
  }, []);

  // Reinicia la medición cuando cambia la URL de la imagen (patrón de React para
  // ajustar estado cuando cambia una entrada, sin cascada de renders).
  if (form.image_url !== formSizeUrl) {
    setFormSizeUrl(form.image_url);
    setFormSize(null);
  }

  if (form.mobile_image_url !== mobileSizeUrl) {
    setMobileSizeUrl(form.mobile_image_url);
    setMobileFormSize(null);
  }

  // Mide la proporción de la imagen del evento para avisar si se va a recortar.
  useEffect(() => {
    if (!form.image_url) return;
    let alive = true;
    loadImageSize(form.image_url).then((size) => {
      if (alive) setFormSize(size);
    });
    return () => {
      alive = false;
    };
  }, [form.image_url]);

  // Igual para la portada de móvil.
  useEffect(() => {
    if (!form.mobile_image_url) return;
    let alive = true;
    loadImageSize(form.mobile_image_url).then((size) => {
      if (alive) setMobileFormSize(size);
    });
    return () => {
      alive = false;
    };
  }, [form.mobile_image_url]);

  // Búsqueda con retardo para no disparar una petición por tecla.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (reset: boolean) => {
      const nextSkip = reset ? 0 : skipRef.current;
      const params = new URLSearchParams({ skip: String(nextSkip), limit: String(PAGE_SIZE) });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (statusFilter) params.set("status", statusFilter);
      try {
        const data = await api.get<Event[]>(`/admin/events?${params.toString()}`);
        setEvents((prev) => (reset ? data : [...prev, ...data]));
        skipRef.current = nextSkip + data.length;
        setHasMore(data.length === PAGE_SIZE);
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar eventos");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, statusFilter]
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  function loadMore() {
    setLoadingMore(true);
    void load(false);
  }

  function openCreate() {
    setForm(emptyForm);
    setOriginal(null);
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(event: Event) {
    setForm({
      id: event.id,
      title: event.title,
      description: event.description || "",
      start_date: toLocalInput(event.start_date),
      end_date: toLocalInput(event.end_date),
      venue_id: event.venue_id ?? null,
      category_id: event.category_id ?? null,
      organizer_id: event.organizer_id ?? null,
      image_url: event.image_url || "",
      mobile_image_url: event.mobile_image_url || "",
      map_config: event.map_config || null,
      status: event.status,
      ticket_template_id: event.ticket_template_id ?? null,
      fees_custom: event.platform_fee_percent != null || event.municipal_tax_percent != null,
      platform_fee_percent: event.platform_fee_percent != null ? String(event.platform_fee_percent) : "",
      municipal_tax_percent: event.municipal_tax_percent != null ? String(event.municipal_tax_percent) : "",
      ticket_types: event.ticket_types.map((t) => ({
        id: t.id,
        event_id: event.id,
        name: t.name,
        price: String(t.price),
        individual_price: t.individual_price != null ? String(t.individual_price) : "",
        total_stock: String(t.total_stock),
        sold_stock: String(t.sold_stock || 0),
        group_size: String(t.group_size || 1),
        has_seat_map: t.has_seat_map ?? true,
        map_rows: String(t.map_rows || (t.has_seat_map === false ? 0 : 12)),
        map_cols: String(t.map_cols || (t.has_seat_map === false ? 0 : 14)),
        color: t.color,
        sale_start: toLocalInput(t.sale_start),
        sale_end: toLocalInput(t.sale_end),
        box_layout: (t as any).box_layout || null,
      })),
    });
    setOriginal(event);
    setFormError("");
    setModalOpen(true);
  }

  function updateField<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateTicketType(index: number, key: keyof TicketTypeForm, value: string | number | boolean | null | { top: number; right: number; bottom: number; left: number }) {
    setForm((prev) => ({
      ...prev,
      ticket_types: prev.ticket_types.map((t, i) => (i === index ? { ...t, [key]: value } : t)),
    }));
  }

  function setAreaType(index: number, hasSeatMap: boolean) {
    setForm((prev) => ({
      ...prev,
      ticket_types: prev.ticket_types.map((t, i) => {
        if (i !== index) return t;
        if (hasSeatMap) {
          return {
            ...t,
            has_seat_map: true,
            group_size: Number(t.group_size) > 0 ? t.group_size : "1",
            map_rows: Number(t.map_rows) > 0 ? t.map_rows : "12",
            map_cols: Number(t.map_cols) > 0 ? t.map_cols : "14",
          };
        }
        return { ...t, has_seat_map: false, group_size: "1", individual_price: "", map_rows: "0", map_cols: "0" };
      }),
    }));
  }

  function addTicketType(hasSeatMap: boolean) {
    setForm((prev) => ({ ...prev, ticket_types: [...prev.ticket_types, newArea(hasSeatMap)] }));
  }

  /** Venta general: una única área libre llamada "Entrada general". */
  function addGeneralSale() {
    setForm((prev) => ({
      ...prev,
      ticket_types: [
        ...prev.ticket_types,
        newArea(false, {
          name: "Entrada general",
          price: generalPrice || "0",
          total_stock: generalCapacity || "0",
        }),
      ],
    }));
  }

  function moveTicketType(index: number, dir: -1 | 1) {
    setForm((prev) => {
      const arr = [...prev.ticket_types];
      const target = index + dir;
      if (target < 0 || target >= arr.length) return prev;
      const [item] = arr.splice(index, 1);
      arr.splice(target, 0, item);
      return { ...prev, ticket_types: arr };
    });
  }

  function removeTicketType(index: number) {
    setForm((prev) => ({
      ...prev,
      ticket_types: prev.ticket_types.filter((_, i) => i !== index),
    }));
  }

  /** Pasa el evento a "Personalizar": precarga los valores globales como punto de partida. */
  function enableCustomFees() {
    setForm((prev) => ({
      ...prev,
      fees_custom: true,
      platform_fee_percent: prev.platform_fee_percent || String(config.platform_fee_percent),
      municipal_tax_percent: prev.municipal_tax_percent || String(config.municipal_tax_percent),
    }));
  }

  /** Abre la vista previa con el precio de la primera área como ejemplo. */
  function openPreview() {
    const first = form.ticket_types.find((t) => t.name.trim());
    setPreviewPrice(first ? first.price : "0");
    setPreviewOpen(true);
  }

  function validate(): string {
    if (!form.title.trim()) return "El título del evento es obligatorio.";
    if (!form.start_date || !form.end_date) return "Completá las fechas de inicio y fin.";
    if (new Date(form.end_date) < new Date(form.start_date)) {
      return "La fecha de fin no puede ser anterior a la de inicio.";
    }
    for (const t of form.ticket_types.filter((x) => x.name.trim())) {
      if (Number(t.price) < 0) return `El precio de "${t.name}" no puede ser negativo.`;
      if (!t.has_seat_map && Number(t.total_stock) < 0) {
        return `La capacidad de "${t.name}" no puede ser negativa.`;
      }
      if (t.has_seat_map && Number(t.group_size) > 1 && t.individual_price.trim() !== "") {
        if (Number(t.individual_price) < 0) {
          return `El precio por silla de "${t.name}" no puede ser negativo.`;
        }
      }
      if (t.sale_start && t.sale_end && new Date(t.sale_end) < new Date(t.sale_start)) {
        return `La ventana de venta de "${t.name}" termina antes de empezar.`;
      }
    }
    return "";
  }

  function buildPayload() {
    const named = form.ticket_types.filter((t) => t.name.trim());
    return {
      title: form.title.trim(),
      description: form.description,
      start_date: form.start_date,
      end_date: form.end_date,
      venue_id: form.venue_id || undefined,
      category_id: form.category_id || undefined,
      organizer_id: form.organizer_id,
      image_url: form.image_url,
      mobile_image_url: form.mobile_image_url || null,
      map_config: form.map_config,
      status: form.status,
      ticket_template_id: form.ticket_template_id,
      platform_fee_percent: form.fees_custom ? Number(form.platform_fee_percent) || 0 : null,
      municipal_tax_percent: form.fees_custom ? Number(form.municipal_tax_percent) || 0 : null,
      ticket_types: named.map((t) => ({
        id: t.id,
        name: t.name.trim(),
        price: Number(t.price) || 0,
        // El precio por silla solo aplica a áreas por box; si queda vacío, esa
        // área se vende únicamente como box completo.
        individual_price:
          t.has_seat_map && Number(t.group_size) > 1 && t.individual_price.trim() !== ""
            ? Number(t.individual_price) || 0
            : null,
        total_stock: Number(t.total_stock) || 0,
        group_size: t.has_seat_map ? Number(t.group_size) || 1 : 1,
        has_seat_map: t.has_seat_map,
        map_rows: Number(t.map_rows) || 0,
        map_cols: Number(t.map_cols) || 0,
        color: t.color,
        sale_start: t.sale_start || null,
        sale_end: t.sale_end || null,
        box_layout: t.box_layout || null,
      })),
      _named: named,
    };
  }

  async function confirmDangerousChange(): Promise<boolean> {
    if (!original || !form.id) return true;
    const willCancel = form.status === "cancelled" && original.status !== "cancelled";
    const datesChanged =
      toLocalInput(original.start_date) !== form.start_date ||
      toLocalInput(original.end_date) !== form.end_date ||
      (original.venue_id ?? null) !== form.venue_id;
    const willReschedule = !willCancel && form.status !== "cancelled" && datesChanged;
    if (!willCancel && !willReschedule) return true;

    let count = 0;
    try {
      const res = await api.get<{ count: number }>(`/admin/events/${form.id}/buyers-count`);
      count = res.count;
    } catch {
      // Si no se puede contar, igual pedimos confirmación.
    }
    const destinatarios = count === 1 ? "1 comprador" : `${count} compradores`;
    const message = willCancel
      ? `Vas a cancelar el evento y se enviará un correo a ${destinatarios}. ¿Confirmás la cancelación?`
      : `Vas a reprogramar el evento y se enviará un correo a ${destinatarios} con la nueva fecha. ¿Confirmás el cambio?`;
    return confirmDialog({ message, danger: willCancel });
  }

  async function handleSubmit() {
    const problem = validate();
    if (problem) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = buildPayload();
    try {
      if (!(await confirmDangerousChange())) return;

      const res = form.id
        ? await api.put<Event>(`/admin/events/${form.id}`, payload)
        : await api.post<Event>("/admin/events", payload);

      // Remapea las zonas temporales del mapa general a los ids reales recién creados.
      const { _named: named, ...body } = payload;
      const tempKeys = named.filter((t) => !t.id).map((t) => t._key || "");
      const savedIds = new Set(named.filter((t) => t.id).map((t) => t.id));
      const newIds = (res.ticket_types || []).filter((t) => !savedIds.has(t.id)).map((t) => t.id);
      const cfg = form.map_config;
      if (tempKeys.length && newIds.length && cfg && typeof cfg.zones === "object" && cfg.zones) {
        const zones = { ...(cfg.zones as Record<string, unknown>) };
        tempKeys.forEach((k, i) => {
          const real = newIds[i];
          if (k && real && zones[k]) {
            zones[real] = zones[k];
            delete zones[k];
          }
        });
        // Se reenvía con los ids reales para no duplicar las áreas ya creadas.
        await api.put(`/admin/events/${res.id}`, {
          ...body,
          ticket_types: res.ticket_types.map((t) => ({
            id: t.id,
            name: t.name,
            price: Number(t.price) || 0,
            individual_price: t.individual_price ?? null,
            total_stock: t.total_stock,
            group_size: t.group_size || 1,
            has_seat_map: t.has_seat_map ?? true,
            map_rows: t.map_rows || 0,
            map_cols: t.map_cols || 0,
            color: t.color,
            sale_start: t.sale_start ?? null,
            sale_end: t.sale_end ?? null,
          })),
          map_config: { ...cfg, zones },
        });
      }

      setModalOpen(false);
      await load(true);
      toastSuccess(form.id ? "Evento actualizado." : "Evento creado.");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number, title: string) {
    if (!(await confirmDialog({ message: `¿Eliminar el evento "${title}"?`, danger: true }))) return;
    try {
      await api.delete(`/admin/events/${id}`);
      await load(true);
      toastSuccess("Evento eliminado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  async function handleDuplicate(id: number, title: string) {
    if (!(await confirmDialog({ message: `¿Duplicar "${title}" como borrador?` }))) return;
    setDuplicating(id);
    try {
      await api.post(`/admin/events/${id}/duplicate`, {});
      await load(true);
      toastSuccess("Evento duplicado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al duplicar");
    } finally {
      setDuplicating(null);
    }
  }

  async function handleSeatMapSaved() {
    setMapEditor(null);
    if (!form.id) return;
    try {
      const data = await api.get<Event>(`/admin/events/${form.id}`);
      setForm((prev) => ({
        ...prev,
        ticket_types: prev.ticket_types.map((t) => {
          const updated = t.id ? data.ticket_types.find((nt) => nt.id === t.id) : undefined;
          if (!updated) return t;
          return {
            ...t,
            has_seat_map: updated.has_seat_map ?? true,
            individual_price: updated.individual_price != null ? String(updated.individual_price) : "",
            total_stock: String(updated.total_stock ?? 0),
            sold_stock: String(updated.sold_stock ?? 0),
            map_rows: String(updated.map_rows ?? 12),
            map_cols: String(updated.map_cols ?? 14),
          };
        }),
      }));
    } catch {
      // sin cambios locales si falla el refresco
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, field: "image_url" | "mobile_image_url" = "image_url") {
    const file = e.target.files?.[0];
    if (!file) return;
    const setBusy = field === "mobile_image_url" ? setMobileUploading : setUploading;
    setBusy(true);
    setFormError("");
    try {
      const data = await api.upload<{ url: string }>("/admin/upload", file);
      updateField(field, data.url);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setBusy(false);
      if (e.target) e.target.value = "";
    }
  }

  const seatAreas = useMemo(() => form.ticket_types.filter((t) => t.has_seat_map), [form.ticket_types]);
  // El stock de las áreas con asientos ya cuenta sillas físicas.
  const totalTickets = form.ticket_types.reduce((s, t) => s + Number(t.total_stock), 0);

  // Valores efectivos de precios/impuestos del evento (override o global) y el
  // desglose de la vista previa. Mismo cálculo que el checkout y el backend.
  const effectiveServicePercent = form.fees_custom
    ? Number(form.platform_fee_percent) || 0
    : config.platform_fee_percent;
  const effectiveMunicipalPercent = form.fees_custom
    ? Number(form.municipal_tax_percent) || 0
    : config.municipal_tax_percent;
  const previewValue = Number(previewPrice) || 0;
  const {
    subtotal: previewBase,
    serviceFee: previewService,
    municipalTax: previewMunicipal,
    tax: previewTax,
    total: previewTotal,
  } = breakdownPrice(previewValue, effectiveServicePercent, effectiveMunicipalPercent, config.tax_percent);
  // Distribución de ingresos (revenue split): el organizador recibe la base + el
  // impuesto municipal + el IVA correspondiente a la base; la plataforma recibe
  // el servicio + el IVA correspondiente al servicio.
  const previewOrganizerTax =
    previewBase + previewService > 0
      ? Math.round((previewTax * (previewBase / (previewBase + previewService)) + 1e-9) * 100) / 100
      : 0;
  const previewPlatformTax = Math.round((previewTax - previewOrganizerTax + 1e-9) * 100) / 100;
  const previewOrganizerGross = Math.round((previewBase + previewMunicipal + previewOrganizerTax + 1e-9) * 100) / 100;
  const previewPlatformGross = Math.round((previewService + previewPlatformTax + 1e-9) * 100) / 100;
  const usd = (amount: number) => formatAmount(amount, "USD");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Eventos</h1>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nuevo evento
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="draft">Borrador</option>
          <option value="published">Publicado</option>
          <option value="finished">Finalizado</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
      ) : events.length === 0 ? (
        <EmptyState message={search || statusFilter ? "No hay eventos que coincidan." : "No hay eventos. Crea el primero."} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="aspect-[16/9] md:aspect-[4/1] bg-gradient-to-br from-brand-500 to-accent-600 relative">
                  {event.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <Badge status={event.status} />
                    <span className="text-xs text-gray-400">
                      {new Date(event.start_date).toLocaleDateString("es-ES")}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 truncate">{event.title}</h3>
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {event.venue?.name || "Sin venue"} · {event.ticket_types.length} tipo(s) de entrada
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="p-2.5 bg-gray-50 rounded-lg text-center">
                      <p className="text-lg font-bold text-brand-600">
                        {event.ticket_types.reduce((s, t) => s + t.total_stock, 0)}
                      </p>
                      <p className="text-xs text-gray-500">total</p>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg text-center">
                      <p className="text-lg font-bold text-gray-700">
                        {event.ticket_types.reduce((s, t) => s + Math.max(0, t.total_stock - t.sold_stock - (t.guest_stock || 0)), 0)}
                      </p>
                      <p className="text-xs text-gray-500">disponibles</p>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg text-center">
                      <p className="text-lg font-bold text-gray-700">
                        {event.ticket_types.reduce((s, t) => s + t.sold_stock, 0)}
                      </p>
                      <p className="text-xs text-gray-500">vendidos</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="secondary" className="flex-1" onClick={() => openEdit(event)}>
                      <Pencil className="w-4 h-4" /> Editar
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleDuplicate(event.id, event.title)}
                      disabled={duplicating === event.id}
                      title="Duplicar evento"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(event.id, event.title)} title="Eliminar evento">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-6">
              <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Cargando..." : "Cargar más eventos"}
              </Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? "Editar evento" : "Nuevo evento"}
        size="5xl"
      >
        {/* Resumen del evento */}
        <div className="-mx-5 -mt-5 mb-5 px-5 py-4 bg-gradient-to-r from-brand-50 via-white to-accent-50 border-b border-gray-100 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-brand-500 to-accent-600 flex-shrink-0 ring-1 ring-black/5">
            {form.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/80">
                <ImageIcon className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold text-gray-900 truncate">{form.title || "Evento sin título"}</h4>
              <Badge status={form.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 font-medium">
                <TicketIcon className="w-3.5 h-3.5" /> {form.ticket_types.length} área(s)
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 font-medium">
                <Users className="w-3.5 h-3.5" /> {totalTickets} boletos
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700 font-medium">
                <TicketPercent className="w-3.5 h-3.5" />{" "}
                {form.ticket_types.reduce((s, t) => s + (Number(t.sold_stock) || 0), 0)} vendidos
              </span>
            </div>
          </div>
        </div>

        {formError && (
          <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="whitespace-pre-line">{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Columna izquierda: info general */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-lg bg-brand-600/10 text-brand-700 flex items-center justify-center">
                  <Info className="w-4 h-4" />
                </span>
                <h4 className="text-sm font-semibold text-gray-900">Información general</h4>
              </div>
              <div className="space-y-4">
                <Input
                  label="Título"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="Nombre del evento"
                />
                <TextArea
                  label="Descripción"
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={4}
                  placeholder="Describe el evento..."
                />
                <div className="grid grid-cols-1 gap-4">
                  <Input
                    label="Fecha inicio"
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => updateField("start_date", e.target.value)}
                  />
                  <Input
                    label="Fecha fin"
                    type="datetime-local"
                    value={form.end_date}
                    onChange={(e) => updateField("end_date", e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-lg bg-brand-600/10 text-brand-700 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </span>
                <h4 className="text-sm font-semibold text-gray-900">Ubicación y estado</h4>
              </div>
              <div className="space-y-4">
                <Select
                  label="Venue / Estadio"
                  options={venues.map((v) => ({ value: v.id, label: v.name }))}
                  value={form.venue_id ?? ""}
                  onChange={(e) => updateField("venue_id", e.target.value ? Number(e.target.value) : null)}
                />
                <Select
                  label="Categoría"
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                  value={form.category_id ?? ""}
                  onChange={(e) => updateField("category_id", e.target.value ? Number(e.target.value) : null)}
                />
                <Select
                  label="Organizador"
                  placeholder="Sin organizador"
                  options={organizers.map((o) => ({ value: o.id, label: `${o.name} (${o.email})` }))}
                  value={form.organizer_id ?? ""}
                  onChange={(e) => updateField("organizer_id", e.target.value ? Number(e.target.value) : null)}
                />
                <Select
                  label="Estado"
                  placeholder={null}
                  options={[
                    { value: "draft", label: "Borrador" },
                    { value: "published", label: "Publicado" },
                    { value: "finished", label: "Finalizado" },
                    { value: "cancelled", label: "Cancelado" },
                  ]}
                  value={form.status}
                  onChange={(e) => updateField("status", e.target.value)}
                />
                <Select
                  label="Diseño del boleto"
                  placeholder="Plantilla por defecto"
                  options={ticketTemplates.map((t) => ({ value: t.id, label: t.name }))}
                  value={form.ticket_template_id ?? ""}
                  onChange={(e) =>
                    updateField("ticket_template_id", e.target.value ? Number(e.target.value) : null)
                  }
                />
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-lg bg-brand-600/10 text-brand-700 flex items-center justify-center">
                  <TicketPercent className="w-4 h-4" />
                </span>
                <h4 className="text-sm font-semibold text-gray-900">Precios e impuestos</h4>
              </div>

              <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden mb-3">
                <button
                  type="button"
                  onClick={() => updateField("fees_custom", false)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    !form.fees_custom ? "bg-brand-500 text-ink-900" : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Global
                </button>
                <button
                  type="button"
                  onClick={enableCustomFees}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    form.fees_custom ? "bg-brand-500 text-ink-900" : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Personalizar
                </button>
              </div>

              <div className="space-y-3">
                <Input
                  label={`Servicio / comisión (%)${form.fees_custom ? "" : " · global"}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  disabled={!form.fees_custom}
                  value={form.fees_custom ? form.platform_fee_percent : String(config.platform_fee_percent)}
                  onChange={(e) => updateField("platform_fee_percent", e.target.value)}
                />
                <Input
                  label={`Impuesto municipal (%)${form.fees_custom ? "" : " · global"}`}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  disabled={!form.fees_custom}
                  value={form.fees_custom ? form.municipal_tax_percent : String(config.municipal_tax_percent)}
                  onChange={(e) => updateField("municipal_tax_percent", e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  El IVA ({config.tax_percent}%) es global y se aplica siempre. El precio de cada área es el
                  precio final: ya incluye el servicio, el IVA y el impuesto municipal.
                </p>
                <Button variant="secondary" className="w-full justify-center" onClick={openPreview}>
                  <Eye className="w-4 h-4" /> Ver vista previa
                </Button>
              </div>
            </div>
          </div>

          {/* Columna derecha: imagen + áreas */}
          <div className="lg:col-span-3 space-y-4">
            {/* Imágenes: escritorio + móvil */}
            <div className="rounded-xl border border-gray-200 p-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-brand-600/10 text-brand-700 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4" />
                </span>
                <h4 className="text-sm font-semibold text-gray-900">Portada del evento</h4>
              </div>

              {/* Escritorio */}
              <div className="border-t border-gray-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Escritorio · 4:1</p>
                <div className="flex items-start gap-4">
                  <label className="flex flex-col items-center justify-center w-36 h-28 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600 transition-colors cursor-pointer flex-shrink-0">
                    <UploadCloud className="w-6 h-6 mb-1.5" />
                    <span className="text-xs font-medium">{uploading ? "Subiendo..." : "Subir imagen"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "image_url")} disabled={uploading} />
                  </label>
                  <div className="flex-1 min-w-0">
                    {form.image_url ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.image_url}
                          alt="Preview"
                          className="w-full aspect-[16/9] sm:aspect-[4/1] object-cover rounded-xl border border-gray-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => updateField("image_url", "")}
                          className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-gray-600 hover:text-red-600 shadow"
                          title="Quitar imagen"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-full aspect-[16/9] sm:aspect-[4/1] flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-400">
                        Sin imagen
                      </div>
                    )}
                    <div className="mt-3">
                      <Input
                        value={form.image_url}
                        onChange={(e) => updateField("image_url", e.target.value)}
                        placeholder="O pega una URL de imagen https://..."
                        className="text-sm"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Recomendado: banner horizontal <strong>1600×400 (4:1)</strong>. Es la que se ve en computadoras.
                    </p>
                    {formSize && ratioWarning(formSize, "event") && (
                      <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>{ratioWarning(formSize, "event")}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Móvil */}
              <div className="border-t border-gray-100 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Móvil · 16:9 <span className="font-normal normal-case text-gray-400">(opcional)</span>
                </p>
                <div className="flex items-start gap-4">
                  <label className="flex flex-col items-center justify-center w-36 h-28 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600 transition-colors cursor-pointer flex-shrink-0">
                    <UploadCloud className="w-6 h-6 mb-1.5" />
                    <span className="text-xs font-medium">{mobileUploading ? "Subiendo..." : "Subir imagen"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, "mobile_image_url")} disabled={mobileUploading} />
                  </label>
                  <div className="flex-1 min-w-0">
                    <div className="relative max-w-[240px]">
                      {form.mobile_image_url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={form.mobile_image_url}
                            alt="Preview móvil"
                            className="w-full aspect-[16/9] object-cover rounded-xl border border-gray-200 shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => updateField("mobile_image_url", "")}
                            className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-gray-600 hover:text-red-600 shadow"
                            title="Quitar imagen"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="w-full aspect-[16/9] flex items-center justify-center rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-400">
                          Sin imagen
                        </div>
                      )}
                    </div>
                    <div className="mt-3">
                      <Input
                        value={form.mobile_image_url}
                        onChange={(e) => updateField("mobile_image_url", e.target.value)}
                        placeholder="O pega una URL de imagen https://..."
                        className="text-sm"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Recomendado: horizontal <strong>1200×675 (16:9)</strong>. Es la que se ve en el teléfono; si la dejás vacía, en móvil se muestra la de escritorio completa sobre un fondo difuminado.
                    </p>
                    {mobileFormSize && mobileRatioWarning(mobileFormSize, "event") && (
                      <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                        <span>{mobileRatioWarning(mobileFormSize, "event")}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tipos de entrada */}
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-brand-600/10 text-brand-700 flex items-center justify-center">
                    <TicketIcon className="w-4 h-4" />
                  </span>
                  <h4 className="text-sm font-semibold text-gray-900">Áreas y entradas</h4>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => addTicketType(true)}>
                    <Armchair className="w-4 h-4" /> Con asientos
                  </Button>
                  <Button variant="secondary" onClick={() => addTicketType(false)}>
                    <Hash className="w-4 h-4" /> Libre
                  </Button>
                </div>
              </div>

              {form.ticket_types.length === 0 ? (
                <div className="py-6 rounded-lg border border-dashed border-gray-300 px-4">
                  <TicketIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500 text-center">
                    Este evento no tiene áreas. Podés vender solo por capacidad o definir áreas con asientos.
                  </p>
                  <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Venta general (solo capacidad)
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        label="Precio"
                        type="number"
                        min="0"
                        value={generalPrice}
                        onChange={(e) => setGeneralPrice(e.target.value)}
                      />
                      <Input
                        label="Capacidad"
                        type="number"
                        min="0"
                        value={generalCapacity}
                        onChange={(e) => setGeneralCapacity(e.target.value)}
                      />
                    </div>
                    <Button variant="secondary" className="mt-3 w-full justify-center" onClick={addGeneralSale}>
                      <Plus className="w-4 h-4" /> Crear entrada general
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {form.ticket_types.map((tt, index) => {
                    const areaColor = tt.color || "#7c3aed";
                    const isBox = tt.has_seat_map && Number(tt.group_size) > 1;
                    return (
                      <div
                        key={tt._key || tt.id || index}
                        className="rounded-xl border border-gray-200 overflow-hidden"
                        style={{ borderLeft: `4px solid ${areaColor}` }}
                      >
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: areaColor }} />
                          <span className="text-sm font-semibold text-gray-900 flex-1 truncate">
                            {tt.name || `Área ${index + 1}`}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-brand-100 text-brand-800">
                            {tt.has_seat_map ? "Con asientos" : "Libre"}
                          </span>
                          {isBox && (
                            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-accent-100 text-accent-800">
                              Box de {tt.group_size}
                            </span>
                          )}
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              onClick={() => moveTicketType(index, -1)}
                              disabled={index === 0}
                              className="text-gray-400 hover:text-brand-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Subir área"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => moveTicketType(index, 1)}
                              disabled={index === form.ticket_types.length - 1}
                              className="text-gray-400 hover:text-brand-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Bajar área"
                            >
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeTicketType(index)}
                            className="text-red-400 hover:text-red-600 transition-colors"
                            title="Quitar área"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="p-4 space-y-3">
                          {tt.id && Number(tt.sold_stock) > 0 && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                              Esta área tiene {tt.sold_stock} boletos vendidos: no se puede cambiar entre con asientos y
                              libre, ni el tamaño del box.
                            </p>
                          )}

                          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
                            <button
                              type="button"
                              onClick={() => setAreaType(index, true)}
                              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                tt.has_seat_map ? "bg-brand-500 text-ink-900" : "bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              <Armchair className="w-3.5 h-3.5" /> Con asientos
                            </button>
                            <button
                              type="button"
                              onClick={() => setAreaType(index, false)}
                              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                !tt.has_seat_map ? "bg-brand-500 text-ink-900" : "bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              <Hash className="w-3.5 h-3.5" /> Libre (capacidad)
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Input
                              label="Nombre del área"
                              value={tt.name}
                              onChange={(e) => updateTicketType(index, "name", e.target.value)}
                              placeholder="ej. General, VIP, Platea"
                            />
                            <Input
                              label="Precio"
                              type="number"
                              min="0"
                              value={tt.price}
                              onChange={(e) => updateTicketType(index, "price", e.target.value)}
                            />
                            <label className="block">
                              <span className="block text-sm font-medium text-gray-700 mb-1">Color en el mapa</span>
                              <span className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={areaColor}
                                  onChange={(e) => updateTicketType(index, "color", e.target.value)}
                                  className="w-10 h-9 rounded-lg border border-gray-300 cursor-pointer bg-transparent"
                                />
                                <span className="text-xs text-gray-400" style={{ color: areaColor }}>
                                  {areaColor.toUpperCase()}
                                </span>
                              </span>
                            </label>
                          </div>

                          {tt.has_seat_map ? (
                            <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Input
                                label={isBox ? "Entradas por box" : "Box (entradas)"}
                                type="number"
                                min="1"
                                value={tt.group_size}
                                onChange={(e) => updateTicketType(index, "group_size", e.target.value)}
                              />
                              {isBox && (
                                <Input
                                  label="Precio por silla (opcional)"
                                  type="number"
                                  min="0"
                                  value={tt.individual_price}
                                  onChange={(e) => updateTicketType(index, "individual_price", e.target.value)}
                                  placeholder="Vacío = solo box completo"
                                />
                              )}
                            </div>

                          {isBox && (
                            <div className="mt-3 rounded-lg border border-gray-200 p-3">
                              <p className="text-xs font-semibold text-gray-700 mb-2">Forma del box (mesa)</p>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {BOX_PRESETS.map((preset) => {
                                  const gs = Number(tt.group_size) || 1;
                                  const p = presetLayout(preset.key, gs);
                                  const cur = tt.box_layout;
                                  const active = cur && cur.top === p.top && cur.right === p.right && cur.bottom === p.bottom && cur.left === p.left;
                                  return (
                                    <button
                                      key={preset.key}
                                      type="button"
                                      onClick={() => updateTicketType(index, "box_layout", presetLayout(preset.key, Number(tt.group_size) || 1))}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                        active
                                          ? "bg-brand-500 border-brand-500 text-white"
                                          : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                                      }`}
                                    >
                                      {preset.label}
                                    </button>
                                  );
                                })}
                              </div>
                              {(() => {
                                const gs = Number(tt.group_size) || 1;
                                const cur: BoxLayout = tt.box_layout && isValidBoxLayout(tt.box_layout, gs)
                                  ? tt.box_layout
                                  : presetLayout("larga", gs);
                                const edges: { key: keyof BoxLayout; label: string }[] = [
                                  { key: "top", label: "Cabecera sup." },
                                  { key: "right", label: "Lado derecho" },
                                  { key: "bottom", label: "Cabecera inf." },
                                  { key: "left", label: "Lado izquierdo" },
                                ];
                                const total = boxLayoutTotal(cur);
                                return (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {edges.map((e) => (
                                        <label key={e.key} className="flex flex-col gap-1">
                                          <span className="text-[11px] text-gray-500">{e.label}</span>
                                          <input
                                            type="number"
                                            min="0"
                                            value={cur[e.key]}
                                            onChange={(ev) => {
                                              const v = Math.max(0, Math.floor(Number(ev.target.value) || 0));
                                              updateTicketType(index, "box_layout", { ...cur, [e.key]: v });
                                            }}
                                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                                          />
                                        </label>
                                      ))}
                                    </div>
                                    <p className={`text-xs font-medium ${total === gs ? "text-emerald-600" : "text-red-500"}`}>
                                      {total} de {gs} sillas {total === gs ? "✓" : "— ajustá para completar la mesa"}
                                    </p>
                                    {(() => {
                                      const { rows, cols, grid } = boxLayoutToGrid(cur);
                                      return (
                                        <div className="inline-grid gap-1 bg-gray-100 rounded-lg p-2" style={{ gridTemplateColumns: `repeat(${cols}, 22px)` }}>
                                          {grid.map((row, r) =>
                                            row.map((cell, c) => (
                                              <div
                                                key={`${r}-${c}`}
                                                className={`w-[22px] h-[22px] rounded-sm flex items-center justify-center text-[10px] font-bold ${
                                                  cell.seatIndex != null
                                                    ? "bg-white border border-gray-300 text-gray-700"
                                                    : "bg-transparent"
                                                }`}
                                              >
                                                {cell.seatIndex}
                                              </div>
                                            )),
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                          </>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Input
                                label="Capacidad (entradas)"
                                type="number"
                                min="0"
                                value={tt.total_stock}
                                onChange={(e) => updateTicketType(index, "total_stock", e.target.value)}
                              />
                            </div>
                          )}

                          <p className="text-xs text-gray-400 flex items-center gap-1.5">
                            {!tt.has_seat_map ? (
                              <>
                                <Hash className="w-3.5 h-3.5" />
                                Asignación libre: se vende por cantidad, hasta agotar la capacidad.
                              </>
                            ) : isBox ? (
                              tt.individual_price.trim() !== ""
                                ? `Venta mixta: box completo (${tt.group_size} entradas) o sillas individuales.`
                                : `Venta por box: cada casilla del mapa es un box con ${tt.group_size} entradas.`
                            ) : (
                              "Venta individual: solo tenés que configurar cuántos asientos hay en el mapa."
                            )}
                          </p>

                          {/* Ventana de venta opcional (plegable) */}
                          <details className="group rounded-lg bg-gray-50 border border-gray-100">
                            <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between text-xs font-semibold text-gray-600 hover:text-gray-800">
                              <span className="flex items-center gap-1.5">
                                <CalendarClock className="w-3.5 h-3.5" /> Ventana de venta (opcional)
                              </span>
                              <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                            </summary>
                            <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Input
                                label="Desde"
                                type="datetime-local"
                                value={tt.sale_start || ""}
                                onChange={(e) => updateTicketType(index, "sale_start", e.target.value)}
                              />
                              <Input
                                label="Hasta"
                                type="datetime-local"
                                value={tt.sale_end || ""}
                                onChange={(e) => updateTicketType(index, "sale_end", e.target.value)}
                              />
                            </div>
                          </details>

                          {tt.has_seat_map &&
                            (form.id && tt.id ? (
                              <Button
                                variant="secondary"
                                className="w-full justify-center"
                                onClick={() => setMapEditor({ eventId: form.id as number, ticketTypeId: tt.id as number })}
                              >
                                <MapIcon className="w-4 h-4" /> Personalizar mapa de asientos
                              </Button>
                            ) : (
                              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 text-center">
                                Guarda el evento para poder configurar el mapa de asientos de esta área.
                              </p>
                            ))}

                          <div className="grid grid-cols-3 gap-2">
                            <div className="p-2 rounded-lg bg-gray-50 text-center">
                              <p className="text-base font-bold text-gray-900">
                                {Number(tt.total_stock)}
                              </p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide">
                                {tt.has_seat_map ? "Asientos" : "Capacidad"}
                              </p>
                            </div>
                            <div
                              className={`p-2 rounded-lg text-center ${
                                Number(tt.total_stock) - Number(tt.sold_stock) > 0 ? "bg-emerald-50" : "bg-gray-50"
                              }`}
                            >
                              <p
                                className={`text-base font-bold ${
                                  Number(tt.total_stock) - Number(tt.sold_stock) > 0 ? "text-emerald-700" : "text-gray-400"
                                }`}
                              >
                                {Math.max(0, Number(tt.total_stock) - Number(tt.sold_stock))}
                              </p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Disponibles</p>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-50 text-center">
                              <p className="text-base font-bold text-gray-700">{Number(tt.sold_stock) || 0}</p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Vendidos</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mapa general del evento */}
        <div className="mt-6 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-600 to-accent-600 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 text-white">
              <span className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                <LayoutGridIcon className="w-5 h-5" />
              </span>
              <div>
                <h4 className="font-semibold">Mapa general del evento</h4>
                <p className="text-sm text-white/80 mt-0.5 max-w-xl">
                  Posicioná cada área con asientos dentro del recinto. Las áreas libres se venden por cantidad y no usan
                  mapa.
                </p>
                {seatAreas.length === 0 && (
                  <p className="text-xs text-white/70 mt-1">
                    Agregá al menos un área «Con asientos» para poder configurar el mapa.
                  </p>
                )}
              </div>
            </div>
            <Button variant="light" onClick={() => setMiniMapOpen(true)} disabled={seatAreas.length === 0}>
              <MapIcon className="w-4 h-4" /> Configurar mapa
            </Button>
          </div>
        </div>

        {/* Pie fijo con resumen y acciones */}
        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 mt-6 px-5 py-4 bg-white/95 backdrop-blur border-t border-gray-200 rounded-b-2xl flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500">
            {form.ticket_types.length} área(s) · {totalTickets} boletos
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear evento"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Vista previa del desglose"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Precio de la entrada (lo que paga el comprador, IVA e impuestos incluidos)"
            type="number"
            min="0"
            step="0.01"
            value={previewPrice}
            onChange={(e) => setPreviewPrice(e.target.value)}
          />

          <div className="text-sm space-y-1.5 bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Precio base</span>
              <span className="text-gray-900">{usd(previewBase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Servicio / comisión ({effectiveServicePercent}%)</span>
              <span className="text-gray-900">{usd(previewService)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
              <span className="text-gray-600">Impuesto municipal ({effectiveMunicipalPercent}%)</span>
              <span className="text-gray-900">{usd(previewMunicipal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">IVA ({config.tax_percent}%)</span>
              <span className="text-gray-900">{usd(previewTax)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-300 pt-2 mt-2 text-base font-semibold">
              <span>Total</span>
              <span>{usd(previewTotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Organizador recibe</p>
              <p className="font-bold text-gray-900">{usd(previewOrganizerGross)}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                Base {usd(previewBase)} + municipal {usd(previewMunicipal)} + IVA {usd(previewOrganizerTax)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Plataforma gana</p>
              <p className="font-bold text-gray-900">{usd(previewPlatformGross)}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                Servicio {usd(previewService)} + IVA {usd(previewPlatformTax)}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            El IVA es siempre global; el servicio y el impuesto municipal salen del evento o, si usa
            &ldquo;Global&rdquo;, de la configuración del sitio.
          </p>
        </div>
      </Modal>

      {mapEditor && (
        <Modal open title="Personalizar mapa de asientos" onClose={() => setMapEditor(null)}>
          <SeatMapEditor eventId={mapEditor.eventId} ticketTypeId={mapEditor.ticketTypeId} onSaved={handleSeatMapSaved} />
        </Modal>
      )}

      <Modal open={miniMapOpen} onClose={() => setMiniMapOpen(false)} title="Configurar mapa del evento" size="6xl">
        <MiniMapEditor
          ticketTypes={seatAreas.map((t) => ({
            id: t.id,
            event_id: form.id || 0,
            name: t.name,
            group_size: Number(t.group_size) || 1,
            map_rows: Number(t.map_rows) || 12,
            map_cols: Number(t.map_cols) || 14,
            color: t.color,
            clientKey: t._key,
          }))}
          value={form.map_config}
          onChange={(config) => {
            updateField("map_config", config);
            setMiniMapOpen(false);
          }}
        />
      </Modal>
    </div>
  );
}
