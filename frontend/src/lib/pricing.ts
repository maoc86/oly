import { round2 } from "./siteConfig";

/**
 * Desglose del precio de una entrada. El precio que carga el organizador ES el
 * precio final que paga el comprador y con el que se publicita: ya incluye el
 * servicio, el impuesto municipal y el IVA. Esta utilidad replica el cálculo del
 * backend (`calculate_amounts` en `orders.py`).
 */
export interface PricingBreakdown {
  /** Base: lo que recibe el organizador. */
  subtotal: number;
  /** Servicio / comisión de la plataforma. */
  serviceFee: number;
  /** Impuesto municipal. */
  municipalTax: number;
  /** IVA. */
  tax: number;
  /** Total: lo que paga el comprador (el precio publicado). */
  total: number;
}

export function breakdownPrice(
  priceTotal: number,
  servicePercent: number,
  municipalPercent: number,
  taxPercent: number
): PricingBreakdown {
  const total = round2(Number(priceTotal) || 0);
  const s = (Number(servicePercent) || 0) / 100;
  const m = (Number(municipalPercent) || 0) / 100;
  const t = (Number(taxPercent) || 0) / 100;

  const divisor = (1 + s) * (1 + t) + m;
  const base = divisor > 0 ? total / divisor : total;

  // Se redondean servicio, municipal e IVA y la base absorbe el resto, de modo
  // que base + servicio + municipal + IVA sea exactamente el total.
  const serviceFee = round2(base * s);
  const municipalTax = round2(base * m);
  const tax = round2(base * (1 + s) * t);
  const subtotal = round2(total - serviceFee - municipalTax - tax);

  return { subtotal, serviceFee, municipalTax, tax, total };
}
