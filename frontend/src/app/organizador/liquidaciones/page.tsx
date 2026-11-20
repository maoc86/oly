"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Percent, Wallet, Receipt, Landmark, HandCoins, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { usePriceFormatter } from "@/lib/currency";

interface PayoutRow {
  event_id: number;
  event_title: string;
  start_date: string;
  subtotal: number;
  base: number;
  platform_fee: number;
  municipal_tax: number;
  tax: number;
  organizer_gross: number;
  platform_gross: number;
  organizer_tax: number;
  platform_tax: number;
  net: number;
  tickets_sold: number;
  orders: number;
}

interface PayoutsResponse {
  payouts: PayoutRow[];
  totals: {
    subtotal: number;
    base: number;
    platform_fee: number;
    municipal_tax: number;
    tax: number;
    organizer_gross: number;
    platform_gross: number;
    organizer_tax: number;
    platform_tax: number;
    net: number;
    tickets_sold: number;
    orders: number;
  };
  payments: PaymentRow[];
  paid_total: number;
  pending_total: number;
}

interface PaymentRow {
  id: number;
  date: string;
  amount: number;
  currency: string;
  rate?: number | null;
  amount_usd: number;
  reference?: string | null;
  note?: string | null;
}

export default function OrganizerPayoutsPage() {
  const format = usePriceFormatter();
  const [data, setData] = useState<PayoutsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<PayoutsResponse>("/organizer/payouts")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar las liquidaciones"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-32 bg-gray-200 rounded-2xl animate-pulse" />;

  const payouts = data?.payouts ?? [];
  const totals = data?.totals;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Liquidaciones</h1>
      <p className="text-sm text-gray-500 mt-1">
        Por evento: cuánto se vendió, cuánto retuvo la plataforma y qué te corresponde cobrar.
      </p>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {totals && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand-50 text-brand-700">
                <TrendingUp className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-medium">Vendido bruto</p>
            </div>
            <p className="text-xl font-bold text-ink-900 mt-2">{format(totals.subtotal)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-red-50 text-red-600">
                <Percent className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-medium">Retención plataforma</p>
            </div>
            <p className="text-xl font-bold text-red-600 mt-2">-{format(totals.platform_gross)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-amber-50 text-amber-600">
                <Landmark className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-medium">Impuestos a remitir</p>
            </div>
            <p className="text-xl font-bold text-amber-600 mt-2">
              {format(totals.municipal_tax + totals.organizer_tax)}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600">
                <Wallet className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-medium">A liquidar</p>
            </div>
            <p className="text-xl font-bold text-emerald-600 mt-2">{format(totals.organizer_gross)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 text-gray-500">
              <span className="grid place-items-center w-7 h-7 rounded-lg bg-brand-50 text-brand-700">
                <Receipt className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-medium">Órdenes</p>
            </div>
            <p className="text-xl font-bold text-ink-900 mt-2">{totals.orders}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 mt-6 overflow-x-auto">
        {payouts.length === 0 ? (
          <p className="p-8 text-center text-gray-500 text-sm">
            Todavía no hay ventas registradas en tus eventos.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Evento</th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium text-right">Boletos</th>
                <th className="px-5 py-3 font-medium text-right">Vendido</th>
                <th className="px-5 py-3 font-medium text-right">Retención plat.</th>
                <th className="px-5 py-3 font-medium text-right">Impuestos</th>
                <th className="px-5 py-3 font-medium text-right">A liquidar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payouts.map((r) => (
                <tr key={r.event_id}>
                  <td className="px-5 py-3 font-medium text-gray-900">{r.event_title}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {new Date(r.start_date).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-700">{r.tickets_sold}</td>
                  <td className="px-5 py-3 text-right text-gray-900">{format(r.subtotal)}</td>
                  <td className="px-5 py-3 text-right text-red-600">-{format(r.platform_gross)}</td>
                  <td className="px-5 py-3 text-right text-amber-600">
                    {format(r.municipal_tax + r.organizer_tax)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-emerald-600">
                    {format(r.organizer_gross)}
                  </td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr className="font-semibold text-gray-900">
                  <td className="px-5 py-3" colSpan={2}>
                    Total
                  </td>
                  <td className="px-5 py-3 text-right">{totals.tickets_sold}</td>
                  <td className="px-5 py-3 text-right">{format(totals.subtotal)}</td>
                  <td className="px-5 py-3 text-right text-red-600">-{format(totals.platform_gross)}</td>
                  <td className="px-5 py-3 text-right text-amber-600">
                    {format(totals.municipal_tax + totals.organizer_tax)}
                  </td>
                  <td className="px-5 py-3 text-right text-emerald-600">{format(totals.organizer_gross)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>

      {data && (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <HandCoins className="w-5 h-5 text-brand-600" />
            <h2 className="font-bold text-gray-900">Pagos recibidos</h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 text-gray-500">
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600">
                  <Wallet className="w-3.5 h-3.5" />
                </span>
                <p className="text-xs font-medium">Pagado</p>
              </div>
              <p className="text-xl font-bold text-emerald-600 mt-2">{format(data.paid_total)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 text-gray-500">
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-amber-50 text-amber-600">
                  <Clock className="w-3.5 h-3.5" />
                </span>
                <p className="text-xs font-medium">Pendiente de cobro</p>
              </div>
              <p className="text-xl font-bold text-amber-600 mt-2">{format(data.pending_total)}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 mt-4 overflow-x-auto">
            {(data.payments ?? []).length === 0 ? (
              <p className="p-8 text-center text-gray-500 text-sm">Todavía no recibiste pagos.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-100">
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium text-right">Monto</th>
                    <th className="px-5 py-3 font-medium">Referencia</th>
                    <th className="px-5 py-3 font-medium">Nota</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-3 text-gray-500">
                        {new Date(p.date).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-emerald-600">{format(p.amount_usd)}</td>
                      <td className="px-5 py-3 text-gray-600">{p.reference || "—"}</td>
                      <td className="px-5 py-3 text-gray-500">{p.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Solo se cuentan órdenes completadas. No se muestran datos de los compradores.
      </p>
    </div>
  );
}