"use client";

import { useEffect, useState, useRef } from "react";
import { Plus, Pencil, Trash2, Package, Search, Download, Upload, Filter, CheckCircle, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { Product, Category, ProductVariant } from "@/lib/types";
import { Button, Input, TextArea, Select, Modal, EmptyState } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";
import { formatPrice } from "@/lib/format";

interface ProductForm {
  id?: number;
  name: string;
  sku: string;
  description: string;
  price: string;
  wholesale_price: string;
  offer_price: string;
  offer_active: boolean;
  cost: string;
  category_id: string;
  brand: string;
  gender: string;
  image_url: string;
  is_featured: boolean;
  is_new: boolean;
  is_active: boolean;
}

const emptyForm: ProductForm = {
  name: "", sku: "", description: "", price: "", wholesale_price: "", offer_price: "",
  offer_active: false, cost: "", category_id: "", brand: "", gender: "mujer",
  image_url: "", is_featured: false, is_new: false, is_active: true,
};

interface BulkResult {
  created_products: number;
  created_variants: number;
  errors: { row: number; error?: string; warning?: string; sheet?: string }[];
  total_errors: number;
  total_warnings: number;
}

export default function AdminProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [variantForm, setVariantForm] = useState({ size: "", color: "", sku: "", price_override: "", stock: "0", min_stock: "0", image_url: "" });
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryFilter) params.set("category_id", categoryFilter);
    if (statusFilter === "active") params.set("is_active", "true");
    if (statusFilter === "inactive") params.set("is_active", "false");
    const q = params.toString() ? `?${params.toString()}` : "";
    try {
      const data = await api.get<{ total: number; items: Product[] }>(`/admin/products${q}`);
      setProducts(data.items);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [search, categoryFilter, statusFilter]);
  useEffect(() => { api.get<Category[]>("/admin/categories").then(setCategories).catch(() => {}); }, []);

  function openCreate() {
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(p: Product) {
    setForm({
      id: p.id, name: p.name, sku: p.sku || "", description: p.description || "",
      price: String(p.price ?? ""), wholesale_price: p.wholesale_price != null ? String(p.wholesale_price) : "",
      offer_price: p.offer_price != null ? String(p.offer_price) : "", offer_active: !!p.offer_active,
      cost: p.cost != null ? String(p.cost) : "", category_id: p.category_id ? String(p.category_id) : "",
      brand: p.brand || "", gender: p.gender || "mujer", image_url: p.image_url || "",
      is_featured: !!p.is_featured, is_new: !!p.is_new, is_active: p.is_active !== false,
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    setSaving(true);
    const payload: any = {
      name: form.name,
      sku: form.sku || undefined,
      description: form.description || undefined,
      price: Number(form.price || 0),
      wholesale_price: form.wholesale_price ? Number(form.wholesale_price) : undefined,
      offer_price: form.offer_price ? Number(form.offer_price) : undefined,
      offer_active: form.offer_active,
      cost: form.cost ? Number(form.cost) : undefined,
      category_id: form.category_id ? Number(form.category_id) : undefined,
      brand: form.brand || undefined,
      gender: form.gender,
      image_url: form.image_url || undefined,
      is_featured: form.is_featured,
      is_new: form.is_new,
      is_active: form.is_active,
    };
    try {
      if (form.id) await api.put(`/admin/products/${form.id}`, payload);
      else await api.post("/admin/products", payload);
      setModalOpen(false);
      await load();
      toastSuccess(form.id ? "Producto actualizado." : "Producto creado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Product) {
    if (!(await confirmDialog({ message: `¿Eliminar "${p.name}"?`, danger: true }))) return;
    try {
      await api.delete(`/admin/products/${p.id}`);
      await load();
      toastSuccess("Producto eliminado.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    }
  }

  async function addVariant() {
    if (!variantProduct) return;
    try {
      await api.post(`/admin/products/${variantProduct.id}/variants`, {
        size: variantForm.size || "Único",
        color: variantForm.color || undefined,
        sku: variantForm.sku || undefined,
        image_url: variantForm.image_url || undefined,
        price_override: variantForm.price_override ? Number(variantForm.price_override) : undefined,
        stock: Number(variantForm.stock || 0),
        min_stock: Number(variantForm.min_stock || 0),
      });
      setVariantForm({ size: "", color: "", sku: "", price_override: "", stock: "0", min_stock: "0", image_url: "" });
      const updated = await api.get<Product>(`/admin/products/${variantProduct.id}`);
      setVariantProduct(updated);
      await load();
      toastSuccess("Variante agregada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    }
  }

  async function deleteVariant(p: Product, v: ProductVariant) {
    if (!(await confirmDialog({ message: `¿Eliminar la variante ${v.size} ${v.color}?`, danger: true }))) return;
    try {
      await api.delete(`/admin/products/variants/${v.id}`);
      const updated = await api.get<Product>(`/admin/products/${p.id}`);
      setVariantProduct(updated);
      await load();
      toastSuccess("Variante eliminada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    }
  }

  async function downloadTemplate() {
    try {
      await api.download("/admin/products/import/template", "plantilla_productos_oly.xlsx");
      toastSuccess("Plantilla descargada.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error al descargar plantilla");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/admin/products/import/bulk`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error al procesar" }));
        throw new Error(err.detail || `Error ${res.status}`);
      }
      const result: BulkResult = await res.json();
      setBulkResult(result);
      setBulkModalOpen(true);
      await load();
      if (result.total_errors === 0) {
        toastSuccess(`${result.created_products} productos y ${result.created_variants} variantes creados.`);
      } else {
        toastError(`${result.total_errors} errores, ${result.created_products} productos creados.`);
      }
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Error al subir archivo");
    } finally {
      setBulkUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const filteredProducts = products.filter((p) =>
    !lowStockOnly || (p.variants || []).some((v) => v.min_stock > 0 && v.stock <= v.min_stock)
  );

  // Stats
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.is_active !== false).length;
  const lowStockCount = products.filter((p) => (p.variants || []).some((v) => v.min_stock > 0 && v.stock <= v.min_stock)).length;
  const totalStock = products.reduce((sum, p) => sum + (p.stock || 0), 0);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500 mt-1">Gestioná el catálogo y sus variantes (talla/color).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[{ value: "", label: "Todas las categorías" }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Activos" },
              { value: "inactive", label: "Inactivos" },
            ]}
          />
          <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
            Bajo stock
          </label>
          <Button variant="secondary" onClick={downloadTemplate}>
            <Download className="w-4 h-4" /> Plantilla
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={bulkUploading}>
            <Upload className="w-4 h-4" /> {bulkUploading ? "Subiendo..." : "Subir Excel"}
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          <Button onClick={openCreate}><Plus className="w-4 h-4" /> Nuevo producto</Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Total productos</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{totalProducts}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Activos</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{activeProducts}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Bajo stock</p>
          <p className="text-xl font-bold text-amber-600 mt-1">{lowStockCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs text-gray-500">Unidades en stock</p>
          <p className="text-xl font-bold text-brand-700 mt-1">{totalStock}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState message={lowStockOnly ? "No hay productos con stock bajo." : "No hay productos. Crea el primero o sube un Excel."} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="w-16 h-20 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-brand-200"><Package className="w-6 h-6" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-sm text-gray-500">{p.sku || "—"} · {p.category?.name || "Sin categoría"}</p>
                  <p className="text-sm font-medium text-gray-900">{formatPrice(Number(p.display_price))}</p>
                  <p className="text-xs text-gray-400">{p.stock} en stock · {p.variants?.length || 0} variantes</p>
                  {p.cost != null && <p className="text-xs text-gray-400">Costo: {formatPrice(Number(p.cost))}</p>}
                </div>
                {!p.is_active && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactivo</span>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-1">
                  <button onClick={() => setVariantProduct(p)} className="px-2.5 py-1.5 text-xs font-medium text-brand-700 bg-brand-50 rounded-lg hover:bg-brand-100">Variantes</button>
                  <button onClick={() => openEdit(p)} className="p-2 text-gray-500 hover:text-brand-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(p)} className="p-2 text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal producto */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={form.id ? "Editar producto" : "Nuevo producto"} size="2xl">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </div>
        <div className="mt-3">
          <TextArea label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </div>
        <div className="mt-3 grid sm:grid-cols-3 gap-3">
          <Input label="Precio (USD)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <Input label="Precio mayor" type="number" value={form.wholesale_price} onChange={(e) => setForm({ ...form, wholesale_price: e.target.value })} />
          <Input label="Costo" type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
        </div>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <div>
            <Input label="Precio oferta" type="number" value={form.offer_price} onChange={(e) => setForm({ ...form, offer_price: e.target.value })} />
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={form.offer_active} onChange={(e) => setForm({ ...form, offer_active: e.target.checked })} /> Oferta activa
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Categoría" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            <Select label="Género" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} options={[{ value: "mujer", label: "Mujer" }, { value: "hombre", label: "Hombre" }, { value: "unisex", label: "Unisex" }]} placeholder={null} />
          </div>
        </div>
        <div className="mt-3 grid sm:grid-cols-2 gap-3">
          <Input label="Marca" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <Input label="Imagen (URL)" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} /> Destacado</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_new} onChange={(e) => setForm({ ...form, is_new: e.target.checked })} /> Nuevo</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Activo</label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </div>
      </Modal>

      {/* Modal variantes */}
      <Modal open={!!variantProduct} onClose={() => setVariantProduct(null)} title={`Variantes de ${variantProduct?.name || ""}`} size="xl">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Input label="Talla" value={variantForm.size} onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })} placeholder="S, M, L…" />
          <Input label="Color" value={variantForm.color} onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })} />
          <Input label="SKU" value={variantForm.sku} onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} />
          <Input label="Imagen (URL)" value={variantForm.image_url} onChange={(e) => setVariantForm({ ...variantForm, image_url: e.target.value })} />
          <Input label="Precio override" type="number" value={variantForm.price_override} onChange={(e) => setVariantForm({ ...variantForm, price_override: e.target.value })} />
          <Input label="Stock" type="number" value={variantForm.stock} onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })} />
          <Input label="Stock mínimo" type="number" value={variantForm.min_stock} onChange={(e) => setVariantForm({ ...variantForm, min_stock: e.target.value })} />
        </div>
        <div className="mt-3"><Button onClick={addVariant}><Plus className="w-4 h-4" /> Agregar variante</Button></div>

        {variantProduct?.variants && variantProduct.variants.length > 0 && (
          <div className="mt-4 border-t pt-3">
            {variantProduct.variants.map((v) => (
              <div key={v.id} className="flex items-center justify-between py-2 border-b border-gray-100 text-sm">
                <span className="text-gray-700">
                  {v.size || "Único"} {v.color ? `/ ${v.color}` : ""}
                  <span className="text-gray-400"> · SKU {v.sku || "—"}</span>
                  <span className={v.stock <= v.min_stock && v.min_stock > 0 ? "ml-2 text-amber-600 font-medium" : "ml-2 text-gray-500"}>
                    stock {v.stock}
                  </span>
                </span>
                <button onClick={() => deleteVariant(variantProduct, v)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Modal resultado bulk */}
      <Modal open={bulkModalOpen} onClose={() => setBulkModalOpen(false)} title="Resultado de carga masiva" size="lg">
        {bulkResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{bulkResult.created_products}</p>
                <p className="text-xs text-emerald-700">Productos creados</p>
              </div>
              <div className="bg-brand-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-brand-700">{bulkResult.created_variants}</p>
                <p className="text-xs text-brand-700">Variantes creadas</p>
              </div>
            </div>
            {bulkResult.errors.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                  Detalles ({bulkResult.total_errors} errores, {bulkResult.total_warnings} advertencias)
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {bulkResult.errors.map((err, i) => (
                    <div key={i} className={`px-3 py-2 text-xs border-t border-gray-100 flex items-start gap-2 ${err.error ? "text-red-600" : "text-amber-600"}`}>
                      {err.error ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                      <span>
                        {err.sheet ? `[${err.sheet}] ` : ""}Fila {err.row}: {err.error || err.warning}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setBulkModalOpen(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
