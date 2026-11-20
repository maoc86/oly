"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { HeroSlide } from "@/lib/types";
import { useSiteConfig } from "@/lib/siteConfig";
import { Button, Input, TextArea, Modal, EmptyState, Spinner } from "@/components/ui";
import SlidePreview from "@/components/SlidePreview";
import { ImageSize, loadImageSize, mobileRatioWarning, ratioWarning } from "@/lib/imageRatio";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import {
  Plus, Pencil, Trash2, ImageIcon, Upload, ArrowUp, ArrowDown, X, Save, Building2,
  Megaphone, Layout, Image, Receipt, Ruler, TriangleAlert, Database, Wrench, ShieldCheck,
} from "lucide-react";

type ConfigValue = string | number | boolean;
type ConfigValues = Record<string, ConfigValue>;

interface ConfigField {
  key: string;
  label: string;
  group: string;
  default: ConfigValue;
  type: "bool" | "number" | "text";
  min: number | null;
  max: number | null;
  max_length: number | null;
  step: number | null;
  widget: string | null;
  hint: string | null;
}

interface SlideForm {
  id?: number;
  title: string;
  subtitle: string;
  image_url: string;
  mobile_image_url: string;
  cta_text: string;
  cta_link: string;
  link_url?: string;
  placement: string;
  sort_order: number;
  is_active: boolean;
}

const PLACEMENTS = [
  { value: "hero", label: "Portada (hero)" },
  { value: "banner", label: "Banner del inicio" },
];

const GROUPS = [
  { key: "empresa", title: "Datos de la empresa", desc: "Nombre, logo y contacto. Se ven en el navbar, el pie de página y las redes.", icon: Building2 },
  { key: "aviso", title: "Aviso del navbar", desc: "Barra fija sobre el menú con el mensaje que quieras.", icon: Megaphone },
  { key: "hero", title: "Comportamiento del hero", desc: "Rotación, tiempo y tamaño de las imágenes de la portada.", icon: Layout },
  { key: "banners", title: "Comportamiento de los banners", desc: "Rotación de las imágenes destacadas del inicio.", icon: Image },
  { key: "ventas", title: "IVA, cargos y comisión", desc: "Lo que paga el usuario y lo que se le descuenta al organizador.", icon: Receipt },
  { key: "limites", title: "Límites de compra", desc: "Use 0 para desactivar el límite.", icon: Ruler },
  { key: "sistema", title: "Sistema y mantenimiento", desc: "Modo mantenimiento y backups de la base de datos.", icon: ShieldCheck },
];

const emptySlide = (placement: string, sortOrder: number): SlideForm => ({
  title: "",
  subtitle: "",
  image_url: "",
  mobile_image_url: "",
  cta_text: "",
  cta_link: "",
  link_url: "",
  placement,
  sort_order: sortOrder,
  is_active: true,
});

export default function AdminConfiguracionPage() {
  const { refresh: refreshConfig } = useSiteConfig();
  const [values, setValues] = useState<ConfigValues>({});
  const [savedValues, setSavedValues] = useState<ConfigValues>({});
  const [fields, setFields] = useState<ConfigField[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState<string | null>(null);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set(GROUPS.map((g) => g.key)));
  const [dirtyGroups, setDirtyGroups] = useState<Set<string>>(new Set());
  const [groupMsg, setGroupMsg] = useState<{ group: string; ok: boolean; text: string } | null>(null);

  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [slidesLoading, setSlidesLoading] = useState(true);
  const [placementFilter, setPlacementFilter] = useState("hero");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<SlideForm>(() => emptySlide("hero", 0));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mobileUploading, setMobileUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mobileFileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const [imageSizes, setImageSizes] = useState<Record<string, ImageSize>>({});
  const [formSize, setFormSize] = useState<ImageSize | null>(null);
  const [formSizeUrl, setFormSizeUrl] = useState<string | null>(null);
  const [mobileFormSize, setMobileFormSize] = useState<ImageSize | null>(null);
  const [mobileFormSizeUrl, setMobileFormSizeUrl] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ values: ConfigValues; fields: ConfigField[] }>("/admin/site-settings")
      .then((data) => {
        setValues(data.values);
        setSavedValues(data.values);
        setFields(data.fields);
      })
      .catch((e) => toastError(e instanceof Error ? e.message : "Error al cargar la configuración"))
      .finally(() => setSettingsLoading(false));

    api
      .get<HeroSlide[]>("/admin/hero-slides")
      .then(setSlides)
      .catch(() => setSlides([]))
      .finally(() => setSlidesLoading(false));
  }, []);

  if (form.image_url !== formSizeUrl) {
    setFormSizeUrl(form.image_url);
    setFormSize(null);
  }

  if (form.mobile_image_url !== mobileFormSizeUrl) {
    setMobileFormSizeUrl(form.mobile_image_url);
    setMobileFormSize(null);
  }

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

  // ---------- Ajustes ----------

  function setValue(key: string, value: ConfigValue) {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Marcar el grupo como modificado.
    const f = fields.find((x) => x.key === key);
    if (f) {
      setDirtyGroups((prev) => {
        const next = new Set(prev);
        next.add(f.group);
        return next;
      });
    }
  }

  async function saveGroup(group: string) {
    setSavingGroup(group);
    setGroupMsg(null);
    const keys = fields.filter((f) => f.group === group).map((f) => f.key);
    const payload: ConfigValues = {};
    keys.forEach((k) => {
      payload[k] = values[k];
    });
    try {
      const data = await api.put<{ values: ConfigValues }>("/admin/site-settings", payload);
      setValues(data.values);
      setSavedValues(data.values);
      await refreshConfig();
      setDirtyGroups((prev) => {
        const next = new Set(prev);
        next.delete(group);
        return next;
      });
      setGroupMsg({ group, ok: true, text: "Cambios guardados." });
    } catch (e) {
      setGroupMsg({
        group,
        ok: false,
        text: e instanceof Error ? e.message : "Error al guardar",
      });
    } finally {
      setSavingGroup(null);
      setTimeout(() => setGroupMsg(null), 3500);
    }
  }

  async function downloadBackup() {
    setDownloadingBackup(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/admin/backup/db`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("No se pudo generar el backup");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^"]+)"?/);
      a.download = m ? m[1] : "oly_backup.sql";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toastSuccess("Backup descargado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al generar backup");
    } finally {
      setDownloadingBackup(false);
    }
  }

  async function saveAllGroups() {
    const dirty = Array.from(dirtyGroups);
    if (dirty.length === 0) {
      toastSuccess("No hay cambios pendientes.");
      return;
    }
    for (const g of dirty) {
      await saveGroup(g);
    }
    toastSuccess("Todos los cambios guardados.");
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { url } = await api.upload<{ url: string }>("/admin/upload", file);
      setValue("company_logo", url);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Error al subir el logo");
    } finally {
      setUploadingLogo(false);
      if (logoRef.current) logoRef.current.value = "";
    }
  }

  // ---------- Slides ----------

  const visibleSlides = slides.filter((s) => (s.placement || "hero") === placementFilter);

  useEffect(() => {
    const urls = Array.from(new Set(visibleSlides.map((s) => s.image_url).filter(Boolean)));
    let alive = true;
    urls.forEach((url) => {
      if (imageSizes[url]) return;
      loadImageSize(url).then((size) => {
        if (alive && size) setImageSizes((prev) => ({ ...prev, [url]: size }));
      });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSlides]);

  async function reloadSlides() {
    setSlidesLoading(true);
    try {
      setSlides(await api.get<HeroSlide[]>("/admin/hero-slides"));
    } finally {
      setSlidesLoading(false);
    }
  }

  function openCreate() {
    setForm(emptySlide(placementFilter, visibleSlides.length));
    setModalOpen(true);
  }

  function openEdit(s: HeroSlide) {
    setForm({
      id: s.id,
      title: s.title,
      subtitle: s.subtitle || "",
      image_url: s.image_url,
      mobile_image_url: s.mobile_image_url || "",
      cta_text: s.cta_text || "",
      cta_link: s.cta_link || "",
      link_url: (s as any).link_url || "",
      placement: s.placement || "hero",
      sort_order: s.sort_order,
      is_active: s.is_active,
    } as any);
    setModalOpen(true);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await api.upload<{ url: string }>("/admin/upload", file);
      setForm((prev) => ({ ...prev, image_url: url }));
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleMobileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMobileUploading(true);
    try {
      const { url } = await api.upload<{ url: string }>("/admin/upload", file);
      setForm((prev) => ({ ...prev, mobile_image_url: url }));
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setMobileUploading(false);
      if (mobileFileRef.current) mobileFileRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (!form.image_url.trim()) {
      toastError("La imagen es obligatoria.");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title,
      subtitle: form.subtitle || null,
      image_url: form.image_url,
      mobile_image_url: form.mobile_image_url || null,
      cta_text: form.cta_text || null,
      cta_link: form.cta_link || null,
      link_url: (form as any).link_url || null,
      placement: form.placement,
      sort_order: form.sort_order,
      is_active: form.is_active,
    };
    try {
      if (form.id) {
        await api.put(`/admin/hero-slides/${form.id}`, payload);
      } else {
        await api.post("/admin/hero-slides", payload);
      }
      setModalOpen(false);
      await reloadSlides();
      toastSuccess(form.id ? "Imagen actualizada." : "Imagen creada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(s: HeroSlide) {
    if (!(await confirmDialog({ message: `¿Eliminar "${s.title || "esta imagen"}"?`, danger: true }))) return;
    try {
      await api.delete(`/admin/hero-slides/${s.id}`);
      await reloadSlides();
      toastSuccess("Imagen eliminada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al eliminar");
    }
  }

  async function persist(s: HeroSlide, patch: Partial<HeroSlide>) {
    const payload = {
      title: s.title,
      subtitle: s.subtitle,
      image_url: s.image_url,
      mobile_image_url: s.mobile_image_url,
      cta_text: s.cta_text,
      cta_link: s.cta_link,
      link_url: (s as any).link_url ?? null,
      placement: s.placement || "hero",
      sort_order: patch.sort_order ?? s.sort_order,
      is_active: patch.is_active ?? s.is_active,
    };
    await api.put(`/admin/hero-slides/${s.id}`, payload);
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...visibleSlides];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await Promise.all(next.map((s, i) => persist(s, { sort_order: i })));
      await reloadSlides();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al reordenar");
    }
  }

  async function toggleActive(s: HeroSlide) {
    try {
      await persist(s, { is_active: !s.is_active });
      await reloadSlides();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al actualizar");
    }
  }

  // ---------- Render de campos ----------

  function renderField(f: ConfigField) {
    const value = values[f.key] ?? f.default;

    if (f.key === "company_logo") {
      return (
        <div key={f.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
          {isSetText(value) ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={String(value)} alt="Logo" className="h-12 w-auto object-contain border border-gray-200 rounded-lg p-1 bg-white" />
              <Button variant="secondary" onClick={() => setValue(f.key, "")}>
                Quitar
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}>
              <Upload className="w-4 h-4" />
              {uploadingLogo ? "Subiendo..." : "Subir logo"}
            </Button>
          )}
          <input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => setValue(f.key, e.target.value)}
            placeholder="o pega la URL del logo"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm mt-3"
          />
          <input ref={logoRef} type="file" accept="image/*" onChange={uploadLogo} className="hidden" />
        </div>
      );
    }

    if (f.type === "bool") {
      return (
        <label key={f.key} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setValue(f.key, e.target.checked)}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">{f.label}</span>
        </label>
      );
    }

    if (f.type === "number") {
      return (
        <div key={f.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
          <input
            type="number"
            value={String(value ?? 0)}
            min={f.min ?? undefined}
            max={f.max ?? undefined}
            step={f.step ?? 1}
            onChange={(e) => setValue(f.key, e.target.value === "" ? "" : Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
          {f.min !== null && f.max !== null && (
            <p className="text-xs text-gray-400 mt-1">Entre {f.min} y {f.max}.</p>
          )}
          {f.hint && <p className="text-xs text-gray-500 mt-1">{f.hint}</p>}
        </div>
      );
    }

    if (f.widget === "textarea") {
      return (
        <div key={f.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
          <textarea
            value={String(value ?? "")}
            onChange={(e) => setValue(f.key, e.target.value)}
          maxLength={f.max_length ?? undefined}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm resize-y"
        />
          {f.hint && <p className="text-xs text-gray-500 mt-1">{f.hint}</p>}
        </div>
      );
    }

    return (
      <div key={f.key}>
        <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => setValue(f.key, e.target.value)}
          maxLength={f.max_length ?? undefined}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
        />
        {f.hint && <p className="text-xs text-gray-500 mt-1">{f.hint}</p>}
      </div>
    );
  }

  const isHero = placementFilter === "hero";
  const sectionTitle = isHero ? "Imágenes de la portada" : "Banners del inicio";
  const emptyMessage = isHero
    ? "No hay imágenes de portada. Crea la primera para substituir el hero por defecto."
    : "No hay banners. Crea uno para mostrarlo debajo de la portada.";

  if (settingsLoading || slidesLoading) {
    return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500 mt-1">
            Todo lo que define la apariencia y las reglas de venta del sitio.
          </p>
        </div>
      </div>

      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-gray-100/90 backdrop-blur border-b border-gray-200 mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-700">Configuración del sitio</h2>
          {dirtyGroups.size > 0 && (
            <span className="text-xs text-blue-600 font-medium">
              {dirtyGroups.size} sección{dirtyGroups.size > 1 ? "es" : ""} con cambios sin guardar
            </span>
          )}
        </div>
        <Button onClick={saveAllGroups} disabled={savingGroup !== null || dirtyGroups.size === 0}>
          <Save className="w-4 h-4" /> Guardar todo
        </Button>
      </div>

      {GROUPS.map((group) => {
        const groupFields = fields.filter((f) => f.group === group.key);
        if (groupFields.length === 0) return null;
        const msg = groupMsg?.group === group.key ? groupMsg : null;
        return (
          <section key={group.key} className={`rounded-2xl shadow-sm border p-6 transition-colors ${group.key === "sistema" ? "bg-gray-50 border-gray-200" : "bg-white border-gray-100"}`}>
            <button
              type="button"
              onClick={() => {
                setCollapsedGroups((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.key)) next.delete(group.key);
                  else next.add(group.key);
                  return next;
                });
              }}
              className="w-full flex items-center justify-between gap-2 mb-1 text-left"
            >
              <div className="flex items-center gap-3">
                <span className={`inline-grid place-items-center w-9 h-9 rounded-xl ${group.key === "sistema" ? "bg-gray-200 text-gray-700" : "bg-brand-50 text-brand-700"}`}>
                  <group.icon className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="font-bold text-gray-900 flex items-center gap-2">
                    {group.title}
                    {dirtyGroups.has(group.key) && (
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500" title="Cambios sin guardar" />
                    )}
                  </h2>
                  <p className="text-xs text-gray-500">{group.desc}</p>
                </div>
              </div>
              <span className="text-gray-400 text-lg">{collapsedGroups.has(group.key) ? "+" : "−"}</span>
            </button>

            {!collapsedGroups.has(group.key) && (
              <>
                <div className="grid sm:grid-cols-2 gap-5 mt-5">
                  {groupFields.map((f) => (
                    <div key={f.key} className={f.widget === "textarea" || f.key === "announcement_text" ? "sm:col-span-2" : ""}>
                      {renderField(f)}
                    </div>
                  ))}
                </div>

                {group.key === "ventas" && (
                  <p className="text-xs text-gray-500 mt-5 bg-gray-50 rounded-lg p-3">
                    El precio que carga el organizador es el <strong>precio final</strong> que paga el comprador
                    y con el que se publicita la entrada: ya <strong>incluye</strong> el servicio, el{" "}
                    <strong>IVA ({values.tax_percent ?? 0}%)</strong> y el{" "}
                    <strong>impuesto municipal ({values.municipal_tax_percent ?? 0}%)</strong>. El organizador
                    recibe solo la base; la plataforma retiene el servicio y los impuestos. El servicio y el
                    impuesto municipal se pueden personalizar por evento; el IVA no.
                  </p>
                )}

                <div className="flex items-center gap-3 mt-5">
                  <Button onClick={() => saveGroup(group.key)} disabled={savingGroup === group.key}>
                    <Save className="w-4 h-4" />
                    {savingGroup === group.key ? "Guardando..." : "Guardar"}
                  </Button>
                  {msg && (
                    <span className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</span>
                  )}
                </div>
              </>
            )}
          </section>
        );
      })}

      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-5 h-5 text-brand-600" />
          <h2 className="font-bold text-gray-900">Backup de la base de datos</h2>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Descarga una copia completa de la base de datos (estructura + datos) en formato SQL.
          Se recomienda hacer backup antes de deploys o cambios importantes.
        </p>
        <Button onClick={downloadBackup} disabled={downloadingBackup}>
          {downloadingBackup ? <Spinner size="sm" /> : <Database className="w-4 h-4" />} {downloadingBackup ? "Generando..." : "Descargar backup"}
        </Button>
      </section>


      <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-gray-900">{sectionTitle}</h2>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={placementFilter}
              onChange={(e) => setPlacementFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {PLACEMENTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4" /> Nuevo
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Solo se muestran las imágenes activas, en el orden de la lista.
        </p>

        <SlidePreview
          placement={isHero ? "hero" : "banner"}
          slides={visibleSlides}
          height={Number(values[isHero ? "hero_height" : "banner_height"] ?? (isHero ? 600 : 260))}
          overlay={Number(values.hero_overlay ?? 40)}
          dirty={
            values[isHero ? "hero_height" : "banner_height"] !==
            savedValues[isHero ? "hero_height" : "banner_height"]
          }
        />

        {visibleSlides.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <div className="space-y-4">
            {visibleSlides.map((s, i) => (
              <div
                key={s.id}
                className={`flex flex-col sm:flex-row gap-4 p-4 border rounded-xl ${
                  s.is_active ? "border-gray-200" : "border-gray-200 bg-gray-50 opacity-70"
                }`}
              >
                <div className="w-full sm:w-56 h-32 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {s.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image_url} alt={s.title || "Slide"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageIcon className="w-8 h-8" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-400">#{i + 1}</span>
                    <h3 className="font-bold text-gray-900">{s.title || <span className="text-gray-400 font-normal">Sin título</span>}</h3>
                    {!s.is_active && (
                      <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 text-xs font-medium">
                        Inactivo
                      </span>
                    )}
                  </div>
                  {s.subtitle && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{s.subtitle}</p>}
                  {s.cta_text && (
                    <p className="text-xs text-gray-400 mt-1">
                      Botón: <span className="font-medium">{s.cta_text}</span>
                      {s.cta_link && <> → {s.cta_link}</>}
                    </p>
                  )}
                  {imageSizes[s.image_url] && ratioWarning(imageSizes[s.image_url], s.placement || "hero") && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700">
                      <TriangleAlert className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="line-clamp-2">
                        {ratioWarning(imageSizes[s.image_url], s.placement || "hero")}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-wrap sm:flex-col sm:items-end">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-2 text-gray-500 hover:text-brand-600 disabled:opacity-30 disabled:hover:text-gray-500"
                    title="Subir"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === visibleSlides.length - 1}
                    className="p-2 text-gray-500 hover:text-brand-600 disabled:opacity-30 disabled:hover:text-gray-500"
                    title="Bajar"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleActive(s)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium ${
                      s.is_active
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    }`}
                  >
                    {s.is_active ? "Activo" : "Oculto"}
                  </button>
                  <button onClick={() => openEdit(s)} className="p-2 text-gray-500 hover:text-brand-600">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(s)} className="p-2 text-gray-500 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? "Editar imagen" : "Nueva imagen"}
        size="2xl"
      >
        <div className="space-y-4">
          <Input
            label="Título (opcional)"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Concierto de..."
          />
          <TextArea
            label="Subtítulo"
            value={form.subtitle}
            onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
            placeholder="Texto breve que acompaña la imagen"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
            <div className="flex gap-4">
              {PLACEMENTS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="placement"
                    checked={form.placement === p.value}
                    onChange={() => setForm((prev) => ({ ...prev, placement: p.value }))}
                    className="w-4 h-4 border-gray-300"
                  />
                  <span className="text-sm text-gray-700">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Imagen de escritorio *</label>
            {form.image_url ? (
              <div className="relative">
                <div className="w-full h-48 border border-gray-300 rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, image_url: "" }))}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-gray-600 hover:text-red-600 shadow"
                  title="Quitar imagen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-500 mb-3">Sin imagen. Sube un archivo o pega la URL.</p>
                <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload className="w-4 h-4" />
                  {uploading ? "Subiendo..." : "Subir imagen"}
                </Button>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            <input
              type="text"
              value={form.image_url}
              onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value }))}
              placeholder="o pega la URL de la imagen"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm mt-3"
            />
            <p className="mt-2 text-xs text-gray-500">
              Escritorio: {form.placement === "hero" ? <strong>1920×600</strong> : <strong>1600×400 (4:1)</strong>}.
            </p>
            {formSize && ratioWarning(formSize, form.placement) && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{ratioWarning(formSize, form.placement)}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Imagen de móvil <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            {form.mobile_image_url ? (
              <div className="relative">
                <div className="w-full h-48 border border-gray-300 rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form.mobile_image_url} alt="Preview móvil" className="w-full h-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, mobile_image_url: "" }))}
                  className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-gray-600 hover:text-red-600 shadow"
                  title="Quitar imagen"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <p className="text-sm text-gray-500 mb-3">
                  Sin imagen de móvil. En el teléfono se mostrará la de escritorio completa sobre un fondo difuminado.
                </p>
                <Button variant="secondary" onClick={() => mobileFileRef.current?.click()} disabled={mobileUploading}>
                  <Upload className="w-4 h-4" />
                  {mobileUploading ? "Subiendo..." : "Subir imagen"}
                </Button>
              </div>
            )}
            <input ref={mobileFileRef} type="file" accept="image/*" onChange={handleMobileUpload} className="hidden" />
            <input
              type="text"
              value={form.mobile_image_url}
              onChange={(e) => setForm((prev) => ({ ...prev, mobile_image_url: e.target.value }))}
              placeholder="o pega la URL de la imagen"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm mt-3"
            />
            <p className="mt-2 text-xs text-gray-500">
              En el teléfono el hero usa una vertical <strong>1080×1350 (4:5)</strong>; el banner, <strong>1200×675 (16:9)</strong>.
            </p>
            {mobileFormSize && mobileRatioWarning(mobileFormSize, form.placement) && (
              <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{mobileRatioWarning(mobileFormSize, form.placement)}</span>
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Texto del botón"
              value={form.cta_text}
              onChange={(e) => setForm((prev) => ({ ...prev, cta_text: e.target.value }))}
              placeholder="Ver eventos"
            />
            <Input
              label="Enlace del botón"
              value={form.cta_link}
              onChange={(e) => setForm((prev) => ({ ...prev, cta_link: e.target.value }))}
              placeholder="/eventos"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enlace de toda la imagen (opcional)</label>
            <input
              type="text"
              value={(form as any).link_url || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, link_url: e.target.value }))}
              placeholder="/eventos/123 o https://..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Si se completa, al hacer clic en cualquier parte de la imagen se abrirá este enlace. Úsalo cuando no quieras mostrar un botón.
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">Visible en el sitio</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Guardando..." : form.id ? "Guardar cambios" : "Crear"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function isSetText(value: ConfigValue | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}
