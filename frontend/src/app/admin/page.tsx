"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package, Tags, Users, Receipt, TrendingUp, Boxes, Clock, ShoppingBag,
} from "lucide-react";
import { api } from "@/lib/api";
import { DashboardStats } from "@/lib/types";
import { Badge } from "@/components/ui";
import { formatPrice } from "@/lib/format";

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.get<DashboardStats>("/admin/dashboard").then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />)}</div>;
  }

  const cards = [
    { label: "Productos", value: stats.total_products, icon: Package, color: "bg-brand-500", href: "/admin/productos" },
    { label: "Stock bajo", value: stats.low_stock, icon: Boxes, color: "bg-amber-500", href: "/admin/inventario" },
    { label: "Pedidos", value: stats.total_orders, icon: Receipt, color: "bg-emerald-500", href: "/admin/pedidos" },
    { label: "Pendientes", value: stats.pending_orders, icon: Clock, color: "bg-orange-500", href: "/admin/pedidos" },
    { label: "Artículos vendidos", value: stats.total_items_sold, icon: ShoppingBag, color: "bg-violet-500", href: "/admin/pedidos" },
    { label: "Clientes", value: stats.total_users, icon: Users, color: "bg-blue-500", href: "/admin/usuarios" },
    { label: "Categorías", value: stats.total_categories, icon: Tags, color: "bg-cyan-500", href: "/admin/categorias" },
    { label: "Ingresos", value: formatPrice(stats.total_revenue), icon: TrendingUp, color: "bg-accent-500", href: "/admin/finanzas" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Resumen general de la tienda.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <span className={`inline-grid place-items-center w-11 h-11 rounded-xl text-white ${c.color}`}>
                <c.icon className="w-5 h-5" />
              </span>
            </div>
            <p className="mt-4 text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-sm text-gray-500">{c.label}</p>
          </Link>
        ))}
      </div>

      {stats.recent_orders.length > 0 && (
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Pedidos recientes</h2>
            <Link href="/admin/pedidos" className="text-sm text-brand-700 hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.recent_orders.map((o) => (
              <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">#{o.id} · {o.buyer_display_name || o.user_name || "Cliente"}</p>
                  <p className="text-sm text-gray-500">{o.items.reduce((a, i) => a + i.quantity, 0)} artículo(s)</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-900">{formatPrice(Number(o.total))}</span>
                  <Badge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
