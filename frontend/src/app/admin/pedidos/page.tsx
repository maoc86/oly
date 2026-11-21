"use client";

import { useEffect, useState } from "react";
import { CheckCircle, XCircle, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Order } from "@/lib/types";
import { Badge, EmptyState } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { toastError, toastSuccess } from "@/lib/toast";
import { confirmDialog } from "@/lib/confirm";

export default function AdminPedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    try {
      const data = await api.get<Order[]>(`/orders/admin/all?${q.toString()}`);
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status]);

  async function confirmOrder(id: number) {
    try {
      await api.post(`/orders/admin/${id}/confirm`);
      toastSuccess("Pedido confirmado.");
      load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    }
  }

  async function cancelOrder(id: number) {
    if (!(await confirmDialog({ message: "¿Cancelar este pedido? Se devolverá el stock.", danger: true }))) return;
    try {
      await api.post(`/orders/admin/${id}/cancel`);
      toastSuccess("Pedido cancelado.");
      load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Error");
    }
  }

  const filtered = orders.filter((o) => {
    if (!search.trim()) return true;
    const t = search.toLowerCase();
    const name = (o.buyer_display_name || o.user_name || "").toLowerCase();
    return String(o.id).includes(t) || name.includes(t) || o.items.some((i) => i.product_name?.toLowerCase().includes(t));
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-sm text-gray-500 mt-1">Confirmá los pagos y gestioná las ventas.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">Todos</option>
            <option value="pending">Pendientes</option>
            <option value="completed">Completados</option>
            <option value="cancelled">Cancelados</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState message="No hay pedidos." />
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <div key={o.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    #{o.id} · {o.buyer_display_name || o.user_name || "Cliente"}
                    {o.channel === "pos" && <span className="ml-2 text-xs text-gray-400">(POS)</span>}
                  </p>
                  <p className="text-sm text-gray-500">
                    {new Date(o.created_at || "").toLocaleString("es-VE")} · {o.payment_method_name || "Sin método"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-gray-900">{formatPrice(Number(o.total))}</span>
                  <Badge status={o.status} />
                </div>
              </div>

              <div className="mt-3 space-y-1">
                {o.items.map((i) => (
                  <p key={i.id} className="text-sm text-gray-600">
                    {i.product_name} × {i.quantity}
                    {i.size || i.color ? <span className="text-gray-400"> ({[i.size, i.color].filter(Boolean).join(" / ")})</span> : null}
                    <span className="float-right text-gray-500">{formatPrice(Number(i.subtotal))}</span>
                  </p>
                ))}
              </div>

              {o.payment_reference && <p className="mt-2 text-xs text-gray-500">Ref: {o.payment_reference}</p>}
              {o.shipping_address && <p className="mt-1 text-xs text-gray-500">Envío: {o.shipping_address}, {o.shipping_city} {o.shipping_state}</p>}

              {o.status === "pending" && (
                <div className="mt-4 flex gap-2">
                  <button onClick={() => confirmOrder(o.id)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500">
                    <CheckCircle className="w-4 h-4" /> Confirmar pago
                  </button>
                  <button onClick={() => cancelOrder(o.id)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200">
                    <XCircle className="w-4 h-4" /> Cancelar
                  </button>
                </div>
              )}
              {o.status === "completed" && (
                <div className="mt-4 flex justify-end">
                  <button onClick={() => cancelOrder(o.id)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100">
                    <XCircle className="w-4 h-4" /> Anular venta
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
