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

export function assertExactQuantityRateTotal(quantityValue: string, unitRateValue: string, totalValue: string): void {
  const quantity = scaledDecimal(decimal(quantityValue, "quantity"));
  const unitRate = scaledDecimal(decimal(unitRateValue, "unitRate"));
  const stated = scaledDecimal(decimal(totalValue, "statedTotal"));
  const calculated = multiply(quantity, unitRate);
  if (calculated !== stated)
    fail("FINANCIAL_STATEMENT_TOTAL_MISMATCH", `Quantity × unit rate does not equal the stated total (${money(calculated)} versus ${money(stated)}).`);
}

export function mapStatementPricing(input: StatementPricingInput): CommercialPriceResult & { statedTotal: string; source: StatementPricingInput["source"] } {
  const keys = [input?.source?.quantityColumn, input?.source?.unitRateColumn, input?.source?.totalColumn];
  if (keys.some(key => typeof key !== "string" || !key.trim()) || new Set(keys).size !== 3)
    fail("FINANCIAL_STATEMENT_MAPPING_INVALID", "Quantity, unit-rate, and total columns must be distinct and explicit.");
  assertExactQuantityRateTotal(input.quantity, input.unitRate, input.statedTotal);
  const statedTotal = money(scaledDecimal(decimal(input.statedTotal, "statedTotal")));
  const result = evaluateCommercialPrice({ quantity: input.quantity, unitPrice: input.unitRate, currency: input.currency });
  return Object.freeze({ ...result, statedTotal, source: Object.freeze({ ...input.source }) });
}

export type PhaseAllocationInput = Readonly<{ phaseId: string; percent: string }>;
export function allocateCommercialTotal(total: string, currencyValue: string, phases: readonly PhaseAllocationInput[]) {
  const currency = parseCurrency(currencyValue);
  if (!Array.isArray(phases) || phases.length === 0 || phases.length > 100) fail("FINANCIAL_PHASES_INVALID", "One to 100 phases are required.");
  if (new Set(phases.map(phase => phase.phaseId)).size !== phases.length || phases.some(phase => !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(phase.phaseId)))
    fail("FINANCIAL_PHASES_INVALID", "Phase identities must be unique and stable.");
  const percents = phases.map(phase => scaledDecimal(decimal(phase.percent, `phases.${phase.phaseId}.percent`)));
  if (percents.reduce((sum, value) => sum + value, 0n) !== 100n * SCALE) fail("FINANCIAL_PHASE_TOTAL_INVALID", "Phase percentages must total exactly 100%.");
  const totalMinor = roundMinor(scaledDecimal(decimal(total, "total")));
  const denominator = 100n * SCALE;
  const allocations = phases.map((phase, index) => {
    const numerator = totalMinor * percents[index];
    return { phaseId: phase.phaseId, percent: decimal(phase.percent, `phases.${phase.phaseId}.percent`), minor: numerator / denominator, remainder: numerator % denominator };
  });
  let residual = totalMinor - allocations.reduce((sum, item) => sum + item.minor, 0n);
  for (const item of [...allocations].sort((a, b) => a.remainder === b.remainder ? a.phaseId.localeCompare(b.phaseId) : a.remainder > b.remainder ? -1 : 1)) {
    if (residual === 0n) break;
    item.minor += 1n;
    residual -= 1n;
  }
  const lines = allocations.map(({ phaseId, percent, minor }) => Object.freeze({ phaseId, percent, amount: `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`, currency }));
  return Object.freeze({ total: money(totalMinor * MINOR), currency, lines: Object.freeze(lines), reconciled: lines.reduce((sum, line) => sum + BigInt(line.amount.replace(".", "")), 0n) === totalMinor });
}
