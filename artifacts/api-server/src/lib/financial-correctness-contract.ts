import { createHash } from "node:crypto";
import { FinancialControlError, parseCurrency, parseDecimal, scaledDecimal } from "./financial-control-contract";

const SCALE = 1_000_000n;
const MINOR = 10_000n;

export type CommercialPriceInput = Readonly<{
  quantity: string;
  unitPrice: string;
  currency: string;
  overheadPercent?: string;
  contingencyPercent?: string;
  taxPercent?: string;
}>;

export type CommercialPriceResult = Readonly<{
  quantity: string;
  unitPrice: string;
  currency: string;
  base: string;
  overhead: string;
  contingency: string;
  subtotal: string;
  tax: string;
  total: string;
  rounding: "HALF_UP_MINOR_UNIT";
}>;

function fail(code: string, message: string): never {
  throw new FinancialControlError(400, code, message);
}

function decimal(value: unknown, field: string): string {
  try { return parseDecimal(value, field); }
  catch { return fail("FINANCIAL_VECTOR_INVALID", `${field} must be an exact non-negative decimal string.`); }
}

function multiply(left: bigint, right: bigint): bigint {
  return (left * right) / SCALE;
}

function percentage(amount: bigint, percent: bigint): bigint {
  return (amount * percent) / (100n * SCALE);
}

function roundMinor(amount: bigint): bigint {
  const whole = amount / MINOR;
  return whole + (amount % MINOR >= MINOR / 2n ? 1n : 0n);
}

function money(amount: bigint): string {
  const minor = roundMinor(amount);
  return `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`;
}

export function evaluateCommercialPrice(input: CommercialPriceInput): CommercialPriceResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("FINANCIAL_VECTOR_INVALID", "A commercial price input is required.");
  const quantity = decimal(input.quantity, "quantity");
  const unitPrice = decimal(input.unitPrice, "unitPrice");
  const currency = parseCurrency(input.currency);
  const overheadPercent = decimal(input.overheadPercent ?? "0", "overheadPercent");
  const contingencyPercent = decimal(input.contingencyPercent ?? "0", "contingencyPercent");
  const taxPercent = decimal(input.taxPercent ?? "0", "taxPercent");
  for (const [field, value] of [["overheadPercent", overheadPercent], ["contingencyPercent", contingencyPercent], ["taxPercent", taxPercent]] as const)
    if (scaledDecimal(value) > 100n * SCALE) fail("FINANCIAL_PERCENT_RANGE", `${field} cannot exceed 100%.`);
  const baseRaw = multiply(scaledDecimal(quantity), scaledDecimal(unitPrice));
  const overheadRaw = percentage(baseRaw, scaledDecimal(overheadPercent));
  const contingencyRaw = percentage(baseRaw, scaledDecimal(contingencyPercent));
  const subtotalRaw = baseRaw + overheadRaw + contingencyRaw;
  const taxRaw = percentage(subtotalRaw, scaledDecimal(taxPercent));
  return Object.freeze({ quantity, unitPrice, currency, base: money(baseRaw), overhead: money(overheadRaw), contingency: money(contingencyRaw), subtotal: money(subtotalRaw), tax: money(taxRaw), total: money(subtotalRaw + taxRaw), rounding: "HALF_UP_MINOR_UNIT" });
}

export function financialFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export type StatementPricingInput = Readonly<{
  quantity: string;
  unitRate: string;
  statedTotal: string;
  currency: string;
  source: Readonly<{ quantityColumn: string; unitRateColumn: string; totalColumn: string }>;
}>;

export function mapStatementPricing(input: StatementPricingInput): CommercialPriceResult & { statedTotal: string; source: StatementPricingInput["source"] } {
  const keys = [input?.source?.quantityColumn, input?.source?.unitRateColumn, input?.source?.totalColumn];
  if (keys.some(key => typeof key !== "string" || !key.trim()) || new Set(keys).size !== 3)
    fail("FINANCIAL_STATEMENT_MAPPING_INVALID", "Quantity, unit-rate, and total columns must be distinct and explicit.");
  const statedTotal = money(scaledDecimal(decimal(input.statedTotal, "statedTotal")));
  const result = evaluateCommercialPrice({ quantity: input.quantity, unitPrice: input.unitRate, currency: input.currency });
  if (result.total !== statedTotal)
    fail("FINANCIAL_STATEMENT_TOTAL_MISMATCH", `Quantity × unit rate is ${result.total} ${result.currency}, not the stated ${statedTotal} ${result.currency}.`);
  return Object.freeze({ ...result, statedTotal, source: Object.freeze({ ...input.source }) });
}
