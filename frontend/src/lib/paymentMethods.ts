import { PaymentMethod } from "./types";

export const TYPE_LABEL: Record<string, string> = {
  card: "Tarjeta",
  wallet: "Pago móvil / billetera",
  transfer: "Transferencia bancaria",
  crypto: "Cripto",
  cash: "Efectivo",
};

export interface PaymentDataPoint {
  label: string;
  value: string;
}

/** Datos de pago que ve el comprador, según lo configurado en el método. */
export function paymentDataPoints(m: PaymentMethod): PaymentDataPoint[] {
  const points: PaymentDataPoint[] = [];
  const accountLabel = m.type === "crypto" ? "ID" : "Número de cuenta";
  if (m.phone) points.push({ label: "Teléfono", value: m.phone });
  if (m.email) points.push({ label: "Correo", value: m.email });
  if (m.cedula) points.push({ label: "Cédula", value: m.cedula });
  if (m.bank_name) points.push({ label: "Banco", value: m.bank_name });
  if (m.account_holder) points.push({ label: "Titular", value: m.account_holder });
  if (m.account_number) points.push({ label: accountLabel, value: m.account_number });
  return points;
}
