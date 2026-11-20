"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { DashboardStats, Order, FinanceSummary, FinanceBalances, TrafficStats } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { formatAmount, type Currency } from "@/lib/currency";
import {
  CalendarDays, MapPin, Users, Briefcase, TrendingUp, Ticket as TicketIcon,
  Receipt, Wallet, Scale, Clock, ArrowRight, ShoppingCart, CheckCircle2,
  Activity, MousePointerClick, Wifi,
} from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [balances, setBalances] = useState<FinanceBalances | null>(null);
  const [traffic, setTraffic] = useState<TrafficStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const tzOffset = -new Date().getTimezoneOffset() / 60;
    const CACHE_KEY = "admin_dashboard_cache";
    const CACHE_TTL = 30_000;

    // Intentar servir desde caché del cliente (TTL 30s) para navegación instantánea.
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Date.now() - parsed.ts < CACHE_TTL) {
          setStats(parsed.stats);
          setLoading(false);
        }
      }
    } catch {
      /* ignore */
    }

    const t0 = performance.now();
    // 1. Dashboard primero (desbloquea el render).
    api.get<DashboardStats>("/admin/dashboard")
      .then((s) => {
        if (cancelled) return;
        console.log("[dashboard] /admin/dashboard =", Math.round(performance.now() - t0), "ms");
        setStats(s);
        setLoading(false);
        // 2. Finance y traffic en segundo plano.
        api.get<FinanceSummary>("/admin/finance/summary")
          .then((f) => { if (!cancelled) { setFinance(f); console.log("[dashboard] /admin/finance/summary =", Math.round(performance.now() - t0), "ms"); } })
          .catch(() => {});
        api.get<FinanceBalances>("/admin/finance/balances")
          .then((b) => { if (!cancelled) { setBalances(b); console.log("[dashboard] /admin/finance/balances =", Math.round(performance.now() - t0), "ms"); } })
          .catch(() => {});
        // 3. Tráfico lazy: solo después de 1s o cuando sea visible.
        const loadTraffic = () => {
          api.get<TrafficStats>(`/admin/traffic?days=14&tz_offset=${tzOffset}`)
            .then((t) => {
              if (!cancelled) {
                setTraffic(t);
                console.log("[dashboard] /admin/traffic =", Math.round(performance.now() - t0), "ms");
                // Cachear el dashboard (solo stats) para navegación instantánea.
                try {
                  sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), stats: s }));
                } catch {
                  /* ignore */
                }
              }
            })
            .catch(() => {});
        };
        const timer = setTimeout(loadTraffic, 1000);
        return () => clearTimeout(timer);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Error cargando el dashboard");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div>
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
        {error || "No se pudieron cargar las métricas"}
      </div>
    );
  }

  const balance = finance?.balance ?? 0;
  const today = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

  const statCards = [
    { label: "Eventos", value: stats.total_events, icon: CalendarDays, color: "bg-brand-500", href: "/admin/eventos" },
    { label: "Usuarios", value: stats.total_users, icon: Users, color: "bg-blue-500", href: "/admin/usuarios" },
    { label: "Organizadores", value: stats.total_organizers, icon: Briefcase, color: "bg-violet-500", href: "/admin/organizadores" },
    { label: "Entradas vendidas", value: stats.total_tickets_sold, icon: TicketIcon, color: "bg-amber-500", href: "/admin/facturacion" },
    { label: "Órdenes completadas", value: stats.total_orders, icon: CheckCircle2, color: "bg-green-500", href: "/admin/facturacion" },
    { label: "Venues / Estadios", value: stats.total_venues, icon: MapPin, color: "bg-accent-500", href: "/admin/venues" },
  ];

  const accountList = (balances?.accounts ?? [])
    .filter((a) => a.balance_usd !== 0)
    .sort((a, b) => b.balance_usd - a.balance_usd);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1 capitalize">{today}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/finanzas"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50"
          >
            <Wallet className="w-4 h-4" /> Finanzas
          </Link>
          <Link
            href="/admin/facturacion"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700"
          >
            <Receipt className="w-4 h-4" /> Facturación
          </Link>
        </div>
      </div>

      {/* Dinero */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 bg-gradient-to-br from-brand-600 to-accent-600 rounded-2xl text-white">
          <div className="flex items-center gap-2">
            <Scale className="w-5 h-5 text-white/80" />
            <p className="text-sm text-white/80">Balance en caja</p>
          </div>
          <p className="text-3xl font-bold mt-2">{formatPrice(balance)}</p>
          <p className="text-xs text-white/60 mt-1">Ingresos - egresos registrados</p>
        </div>

        <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <p className="text-sm text-gray-500">Ventas brutas</p>
          </div>
          <p className="text-3xl font-bold text-gray-900 mt-2">{formatPrice(stats.total_revenue)}</p>
          <p className="text-xs text-gray-400 mt-1">Órdenes completadas</p>
        </div>

        <Link
          href="/admin/facturacion"
          className={`p-6 rounded-2xl shadow-sm border transition-colors ${
            stats.pending_orders > 0
              ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
              : "bg-white border-gray-100 hover:bg-gray-50"
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className={`w-5 h-5 ${stats.pending_orders > 0 ? "text-amber-600" : "text-gray-400"}`} />
            <p className="text-sm text-gray-500">Pendientes de confirmar</p>
          </div>
          <p className={`text-3xl font-bold mt-2 ${stats.pending_orders > 0 ? "text-amber-600" : "text-gray-900"}`}>
            {stats.pending_orders}
          </p>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            {stats.pending_orders > 0 ? "Revisar y confirmar" : "Todo al día"} <ArrowRight className="w-3 h-3" />
          </p>
        </Link>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className={`inline-flex p-2 rounded-lg text-white ${card.color} mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </Link>
          );
        })}
      </div>

      {/* Tráfico */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <Activity className="w-4 h-4 text-brand-600" /> Tráfico de la web
          </h2>
          <Link href="/admin/trafico" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
            Ver detalle <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {!traffic ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl bg-gray-50 p-4 space-y-2">
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="h-6 w-12 bg-gray-200 rounded animate-pulse" />
                <div className="h-2 w-16 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-gray-500">
                <Users className="w-4 h-4" />
                <span className="text-xs">Visitantes hoy</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{traffic.visitors_today}</p>
              <p className="text-[11px] text-gray-400">{traffic.requests_today} peticiones</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <div className="flex items-center gap-2 text-emerald-700">
                <Wifi className="w-4 h-4" />
                <span className="text-xs">En línea ahora</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{traffic.online_now}</p>
              <p className="text-[11px] text-gray-400">últimos 5 minutos</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <div className="flex items-center gap-2 text-gray-500">
                <Activity className="w-4 h-4" />
                <span className="text-xs">Usuarios activos</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{traffic.logged_in_week}</p>
              <p className="text-[11px] text-gray-400">con sesión, 7 días</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4 min-w-0">
              <div className="flex items-center gap-2 text-gray-500">
                <MousePointerClick className="w-4 h-4" />
                <span className="text-xs">Página más vista</span>
              </div>
              <p className="text-sm font-bold text-gray-900 mt-1.5 truncate" title={traffic.top_paths[0]?.label}>
                {traffic.top_paths[0]?.label || "—"}
              </p>
              <p className="text-[11px] text-gray-400">{traffic.top_paths[0]?.count ?? 0} visitas</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Órdenes recientes */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="flex items-center gap-2 font-bold text-gray-900">
              <ShoppingCart className="w-4 h-4 text-brand-600" /> Órdenes recientes
            </h2>
            <Link href="/admin/facturacion" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {stats.recent_orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Aún no hay órdenes.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="text-left p-4">Orden</th>
                    <th className="text-left p-4">Comprador</th>
                    <th className="text-left p-4">Evento</th>
                    <th className="text-left p-4">Fecha</th>
                    <th className="text-right p-4">Cobrado</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_orders.map((order: Order) => {
                    const currency: Currency = order.payment_currency === "VES" ? "VES" : "USD";
                    const charged = Number(order.payment_total ?? order.total);
                    return (
                      <tr key={order.id} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="p-4 font-semibold text-gray-900">#{order.id}</td>
                        <td className="p-4">
                          <p className="font-medium text-gray-900">{order.user_name || order.user_email || `#${order.user_id}`}</p>
                          {order.user_email && <p className="text-xs text-gray-400">{order.user_email}</p>}
                        </td>
                        <td className="p-4 text-gray-600">{order.items[0]?.event_title || "—"}</td>
                        <td className="p-4 text-gray-500">
                          {new Date(order.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                        </td>
                        <td className="p-4 text-right font-bold text-gray-900">
                          {formatAmount(charged, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Saldos por cuenta */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 font-bold text-gray-900">
              <Wallet className="w-4 h-4 text-brand-600" /> Saldos por cuenta
            </h2>
            <Link href="/admin/finanzas" className="text-sm text-brand-600 hover:underline">Ver</Link>
          </div>
          {balances === null ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                    <div className="h-2 w-10 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : accountList.length === 0 ? (
            <p className="text-sm text-gray-400">Sin saldos todavía.</p>
          ) : (
            <div className="space-y-3">
              {accountList.slice(0, 6).map((a) => {
                const cur: Currency = a.currency === "VES" ? "VES" : "USD";
                return (
                  <div key={a.payment_method_id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                      <p className="text-xs text-gray-400">{a.currency}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">{formatAmount(a.balance, cur)}</p>
                      {a.currency === "VES" && (
                        <p className="text-xs text-gray-400">{formatPrice(a.balance_usd)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
