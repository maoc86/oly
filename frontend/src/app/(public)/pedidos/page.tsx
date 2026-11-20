"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { api } from "@/lib/api";
import { Order } from "@/lib/types";
import { useCurrency, formatMoney } from "@/lib/currency";
import { Badge } from "@/components/ui";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { currency, bsRate } = useCurrency();

  useEffect(() => {
    api.get<Order[]>("/orders").then(setOrders).catch(() => setOrders([])).finally(() => setLoading(false));
  }, []);

  const money = (usd: number) => formatMoney(usd, currency, bsRate);

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-10 text-gray-500">Cargando…</div>;
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-gray-100 text-gray-400">
          <Package className="w-8 h-8" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-gray-900">Todavía no tenés pedidos</h1>
        <p className="mt-2 text-gray-500">Tus compras aparecerán acá.</p>
        <Link href="/productos" className="mt-6 inline-block px-6 py-3 rounded-xl bg-brand-600 text-white font-semibold hover:bg-brand-500">
          Ir a la tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Mis pedidos</h1>
      <div className="mt-8 space-y-4">
        {orders.map((o) => (
          <div key={o.id} className="p-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Pedido #{o.id}</p>
                <p className="text-sm text-gray-500">
                  {new Date(o.created_at || "").toLocaleDateString("es-VE")} · {o.items.reduce((a, i) => a + i.quantity, 0)} artículo(s)
                </p>
              </div>
              <div className="text-right">
                <Badge status={o.status} />
                <p className="mt-1 font-bold text-gray-900">{money(Number(o.total))}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {o.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">
                    {i.product_name}
                    <span className="text-gray-400"> × {i.quantity}</span>
                    {i.size || i.color ? <span className="text-gray-400"> ({[i.size, i.color].filter(Boolean).join(" / ")})</span> : null}
                  </span>
                  <span className="text-gray-600">{money(Number(i.subtotal))}</span>
                </div>
              ))}
            </div>
            {o.status === "pending" && o.payment_method_name && (
              <p className="mt-3 text-xs text-gray-500">
                En espera de confirmación de pago por {o.payment_method_name}.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
