const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Los importes de la plataforma se calculan y guardan en USD. */
export function formatPrice(value: number | string | null | undefined): string {
  const num = Number(value);
  if (Number.isNaN(num)) return "USD 0.00";
  return usdFormatter.format(num);
}
