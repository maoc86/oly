"use client";

import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { InventoryMovement, Product } from "@/lib/types";
import { Button, Input, Select, EmptyState } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toast";

const TYPE_META: Record<string, { label: string; icon: any; cls: string }> = {
  entry: { label: "Entrada", icon: ArrowDownToLine, cls: "text-emerald-600" },
  exit: { label: "Salida", icon: ArrowUpFromLine, cls: "text-red-600" },
  adjustment: { label: "Ajuste", icon: SlidersHorizontal, cls: "text-amber-600" },
  return: { label: "Devolución", icon: RotateCcw, cls: "text-blue-600" },
  sale_web: { label: "Venta web", icon: ArrowUpFromLine, cls: "text-gray-500" },
  sale_pos: { label: "Venta POS", icon: ArrowUpFromLine, cls: "text-gray-500" },
};

export default function AdminInventarioPage() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [type, setType] = useState("entry");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<InventoryMovement[]>("/admin/inventory/movements?limit=100");
      setMovements(data);
    } catch {
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    api.get<{ total: number; items: Product[] }>("/admin/products?limit=500").then((d) => setProducts(d.items)).catch(() => {});
  }, []);

  const product = products.find((p) => String(p.id) === productId);

  async function submit() {
    if (!variantId || !quantity) {
      toastError("Elegí una variante y una cantidad.");
      return;
    }
    try {
      await api.post("/admin/inventory/movements", {
        product_variant_id: Number(variantId),
        movement_type: type,
        quantity: Number(quantity),
        notes: notes || undefined,
      });
      toastSuccess("Movimiento registrado.");
      setNotes(""); setQuantity("");
      load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
        <p className="text-sm text-gray-500 mt-1">Movimientos de stock por variante.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-3">Registrar movimiento</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <Select label="Producto" value={productId} onChange={(e) => { setProductId(e.target.value); setVariantId(""); }} options={products.map((p) => ({ value: p.id, label: p.name }))} />
          <Select label="Variante" value={variantId} onChange={(e) => setVariantId(e.target.value)} options={(product?.variants || []).map((v) => ({ value: v.id, label: `${v.size || "Único"}${v.color ? " / " + v.color : ""} (stock ${v.stock})` }))} placeholder={productId ? "Elegí variante" : "Primero el producto"} />
          <Select label="Tipo" value={type} onChange={(e) => setType(e.target.value)} options={[
            { value: "entry", label: "Entrada (+)" },
            { value: "exit", label: "Salida (−)" },
            { value: "adjustment", label: "Ajuste (fijar stock)" },
            { value: "return", label: "Devolución (+)" },
          ]} placeholder={null} />
          <Input label={type === "adjustment" ? "Nuevo stock" : "Cantidad"} type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Input label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="mt-4"><Button onClick={submit}>Registrar</Button></div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : movements.length === 0 ? (
        <EmptyState message="Sin movimientos registrados." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {movements.map((m) => {
            const meta = TYPE_META[m.movement_type] || { label: m.movement_type, icon: SlidersHorizontal, cls: "text-gray-500" };
            const Icon = meta.icon;
            return (
              <div key={m.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 flex-shrink-0 ${meta.cls}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.product_name}</p>
                    <p className="text-xs text-gray-500">{meta.label} · {m.variant_label || "—"}{m.reference ? ` · ${m.reference}` : ""}</p>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-gray-900">{m.quantity > 0 ? "+" : ""}{m.quantity}</p>
                  <p className="text-xs text-gray-400">{m.previous_stock} → {m.new_stock}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
