export function governanceThresholdLabel(threshold: { currency: string; amountMinor: number } | null, spanish: boolean): string {
  if (!threshold) return spanish ? "Siempre" : "Always";
  if (!/^[A-Z]{3}$/.test(threshold.currency) || !Number.isSafeInteger(threshold.amountMinor) || threshold.amountMinor < 0)
    return spanish ? "Importe o moneda no válidos" : "Invalid amount or currency";
  const locale = spanish ? "es" : "en";
  const digits = new Intl.NumberFormat(locale, { style: "currency", currency: threshold.currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const divisor = 10n ** BigInt(digits), amount = BigInt(threshold.amountMinor);
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount / divisor);
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === "decimal")?.value ?? ".";
  const fraction = digits ? separator + (amount % divisor).toString().padStart(digits, "0") : "";
  return `${spanish ? "Mayor que" : "Greater than"} ${whole}${fraction} ${threshold.currency}`;
}
