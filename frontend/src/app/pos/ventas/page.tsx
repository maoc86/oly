"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Order } from "@/lib/types";
import { EmptyState } from "@/components/ui";
import { formatPrice } from "@/lib/format";

export default function PosVentasPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Order[]>("/pos/sales").then(setOrders).catch(() => setOrders([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-40 bg-gray-200 rounded-2xl animate-pulse" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Ventas del POS</h1>
      {orders.length === 0 ? (
        <EmptyState message="Todavía no registraste ventas." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {orders.map((o) => (
            <div key={o.id} className="px-5 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">#{o.id} · {o.buyer_name || "Cliente"}</p>
                <p className="text-sm text-gray-500">
                  {new Date(o.created_at || "").toLocaleString("es-VE")} · {o.items.reduce((a, i) => a + i.quantity, 0)} artículo(s)
                </p>
              </div>
              <span className="font-bold text-gray-900">{formatPrice(Number(o.total))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
