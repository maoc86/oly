"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { TrafficCount, TrafficStats } from "@/lib/types";
import {
  Activity, ArrowLeft, Bot, Globe, MonitorSmartphone, MousePointerClick,
  RefreshCw, Server, Users, Wifi,
} from "lucide-react";

const DAY_OPTIONS = [7, 14, 30];
const REFRESH_MS = 30000;

function shortDay(label: string): string {
  const d = new Date(`${label}T00:00:00`);
  if (Number.isNaN(d.getTime())) return label;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function shortHour(label: string): string {
  const d = new Date(`${label.replace(" ", "T")}:00`);
  if (Number.isNaN(d.getTime())) return label;
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function timeAgo(iso: string): string {
  const then = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `hace ${seconds}s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
  return `hace ${Math.floor(seconds / 86400)}d`;
}

function statusColor(status: number): string {
  if (status >= 500) return "text-red-600 bg-red-50";
  if (status >= 400) return "text-amber-600 bg-amber-50";
  if (status >= 300) return "text-blue-600 bg-blue-50";
  return "text-emerald-600 bg-emerald-50";
}

/** Barras simples (sin dependencias de gráficas). */
function BarChart({
  points,
  labelFormatter,
  metric,
}: {
  points: { label: string; requests: number; visitors: number }[];
  labelFormatter: (label: string) => string;
  metric: "requests" | "visitors";
}) {
  const values = points.map((p) => p[metric]);
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1 h-40">
      {points.map((p) => {
        const value = p[metric];
        const height = Math.round((value / max) * 100);
        return (
          <div key={p.label} className="flex-1 min-w-0 group relative flex flex-col items-center justify-end h-full">
            <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
              {value}
            </span>
            <div
              className="w-full rounded-t bg-gradient-to-t from-brand-600 to-accent-500 min-h-[2px] transition-all"
              style={{ height: `${Math.max(height, value > 0 ? 4 : 1)}%` }}
            />
            <span className="text-[9px] text-gray-400 mt-1 truncate w-full text-center">
              {labelFormatter(p.label)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RankingList({
  title,
  icon: Icon,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: TrafficCount[];
  emptyText: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-4">
        <Icon className="w-4 h-4 text-brand-600" /> {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyText}</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.label} className="relative">
              <div className="flex items-center justify-between gap-3 text-sm relative z-10">
                <span className="truncate text-gray-700" title={item.label}>
                  {item.label}
                </span>
                <span className="font-semibold text-gray-900 shrink-0">{item.count}</span>
              </div>
              <div
                className="absolute inset-y-0 left-0 bg-brand-50 rounded"
                style={{ width: `${Math.round((item.count / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminTraffic() {
  const [data, setData] = useState<TrafficStats | null>(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Offset del navegador para agrupar días/horas en la zona horaria del admin.
  const tzOffset = useMemo(() => -new Date().getTimezoneOffset() / 60, []);

  const load = useCallback(() => {
    return api
      .get<TrafficStats>(`/admin/traffic?days=${days}&tz_offset=${tzOffset}`)
      .then((stats) => {
        setData(stats);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar las métricas"))
      .finally(() => setLoading(false));
  }, [days, tzOffset]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (autoRefresh) {
      timer.current = setInterval(() => load(), REFRESH_MS);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [autoRefresh, load]);

  if (loading && !data) {
    return (
      <div>
        <div className="h-8 w-56 bg-gray-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">{error}</div>
    );
  }

  if (!data) return null;

  const summaryCards = [
    {
      label: "Visitantes hoy",
      value: data.visitors_today,
      hint: "IPs únicas",
      icon: Users,
      color: "bg-brand-500",
    },
    {
      label: "Peticiones hoy",
      value: data.requests_today,
      hint: "Llamadas a la API",
      icon: MousePointerClick,
      color: "bg-blue-500",
    },
    {
      label: "En línea ahora",
      value: data.online_now,
      hint: "Últimos 5 minutos",
      icon: Wifi,
      color: "bg-emerald-500",
    },
    {
      label: "Usuarios activos (7d)",
      value: data.logged_in_week,
      hint: "Con sesión iniciada",
      icon: Activity,
      color: "bg-violet-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tráfico</h1>
          <p className="text-sm text-gray-500 mt-1">
            Actividad de visitantes en la web. Los bots se cuentan aparte.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            No incluye el panel de administración ni el de organizadores.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-300 bg-white overflow-hidden">
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  days === d ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              autoRefresh
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
            title="Recargar cada 30 segundos"
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? "animate-spin [animation-duration:3s]" : ""}`} />
            {autoRefresh ? "En vivo" : "Pausado"}
          </button>
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 border border-gray-300 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className={`inline-flex p-2 rounded-lg text-white ${card.color} mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{card.hint}</p>
            </div>
          );
        })}
      </div>

      {/* Series temporales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 font-bold text-gray-900">
              <Activity className="w-4 h-4 text-brand-600" /> Peticiones por día
            </h2>
            <span className="text-xs text-gray-400">últimos {data.days} días</span>
          </div>
          <BarChart points={data.by_day} labelFormatter={shortDay} metric="requests" />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="flex items-center gap-2 font-bold text-gray-900">
              <Users className="w-4 h-4 text-brand-600" /> Visitantes por día
            </h2>
          </div>
          <BarChart points={data.by_day} labelFormatter={shortDay} metric="visitors" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <Activity className="w-4 h-4 text-brand-600" /> Últimas 24 horas
          </h2>
          <span className="text-xs text-gray-400">hora local (UTC{tzOffset >= 0 ? "+" : ""}{tzOffset})</span>
        </div>
        {data.by_hour.length === 0 ? (
          <p className="text-sm text-gray-400">Sin actividad en las últimas 24 horas.</p>
        ) : (
          <BarChart points={data.by_hour} labelFormatter={shortHour} metric="requests" />
        )}
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <RankingList
          title="Páginas más vistas"
          icon={MousePointerClick}
          items={data.top_paths}
          emptyText="Sin datos todavía."
        />
        <RankingList
          title="De dónde vienen"
          icon={Globe}
          items={data.top_referers}
          emptyText="Sin referidos (tráfico directo)."
        />
        <RankingList
          title="Dispositivos"
          icon={MonitorSmartphone}
          items={data.user_agents}
          emptyText="Sin datos todavía."
        />
        <RankingList
          title="Países"
          icon={Globe}
          items={data.top_countries}
          emptyText="Sin geolocalización (DB no disponible)."
        />
        <RankingList
          title="Navegadores"
          icon={MonitorSmartphone}
          items={data.top_browsers}
          emptyText="Sin datos todavía."
        />
        <RankingList
          title="Fuentes UTM"
          icon={MousePointerClick}
          items={data.top_utm_sources}
          emptyText="Sin campañas con UTM."
        />
        <RankingList
          title="Campañas UTM"
          icon={MousePointerClick}
          items={data.top_utm_campaigns}
          emptyText="Sin campañas con UTM."
        />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-4">
            <Server className="w-4 h-4 text-brand-600" /> Códigos de respuesta
          </h2>
          {data.statuses.length === 0 ? (
            <p className="text-sm text-gray-400">Sin datos todavía.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.statuses.map((s) => (
                <span
                  key={s.status}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${statusColor(s.status)}`}
                >
                  {s.status}
                  <span className="font-normal opacity-70">{s.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <RankingList
          title="Top visitantes (IP)"
          icon={Users}
          items={data.top_ips}
          emptyText="Sin datos todavía."
        />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="flex items-center gap-2 font-bold text-gray-900 mb-4">
            <Bot className="w-4 h-4 text-brand-600" /> Bots y rastreadores
          </h2>
          <p className="text-3xl font-bold text-gray-900">{data.bot_requests}</p>
          <p className="text-sm text-gray-500">peticiones de {data.bot_visitors} orígenes</p>
          <p className="text-xs text-gray-400 mt-2">
            Google, redes sociales, monitores… Se excluyen de las métricas de visitantes.
          </p>
        </div>
      </div>

      {/* Actividad en vivo */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <Activity className="w-4 h-4 text-brand-600" /> Actividad en vivo
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Últimas peticiones recibidas en la API. Se actualiza cada 30 segundos.
          </p>
        </div>
        {data.recent.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Sin actividad registrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="text-left p-4">Ruta</th>
                  <th className="text-left p-4">Método</th>
                  <th className="text-center p-4">Estado</th>
                  <th className="text-left p-4">IP</th>
                  <th className="text-left p-4">Dispositivo</th>
                  <th className="text-right p-4">Cuándo</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={`${r.created_at}-${i}`} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-900 max-w-[240px] truncate" title={r.path}>
                      {r.path}
                    </td>
                    <td className="p-4 text-gray-500">{r.method}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${statusColor(r.status_code)}`}>
                        {r.status_code}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500 font-mono text-xs">{r.ip || "—"}</td>
                    <td className="p-4 text-gray-500 max-w-[220px] truncate" title={r.user_agent || ""}>
                      {r.is_bot && <Bot className="inline w-3.5 h-3.5 text-amber-500 mr-1" />}
                      {r.user_agent ? r.user_agent.slice(0, 48) : "—"}
                    </td>
                    <td className="p-4 text-right text-gray-400 whitespace-nowrap">{timeAgo(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contexto */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Peticiones totales (90 días)</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{data.requests_total}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Visitantes únicos (90 días)</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{data.visitors_total}</p>
        </div>
        <Link
          href="/"
          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:bg-gray-50 flex items-center justify-between"
        >
          <span className="text-sm text-gray-600">Ver el sitio público</span>
          <ArrowLeft className="w-4 h-4 text-brand-600" />
        </Link>
      </div>
    </div>
  );
}
