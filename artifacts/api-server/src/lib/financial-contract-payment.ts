import crypto from "crypto";
import { FinancialControlError } from "./financial-control-contract";
import { decimalFromScaled, scaledSignedDecimal } from "./financial-budget-contract";
import { contractCurrency } from "./financial-contract-contract";

export type PaymentLineInput = { contractSovLineId: string; currentAmount: string; evidence?: Record<string, unknown>; sortOrder: number };
const amount = (value: unknown, name: string) => {
  const scaled = scaledSignedDecimal(String(value));
  if (scaled < 0n) throw new FinancialControlError(400, "CONTRACT_PAYMENT_AMOUNT_INVALID", `${name} cannot be negative.`);
  return decimalFromScaled(scaled);
};
const date = (value: unknown, name: string) => {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) throw new FinancialControlError(400, "CONTRACT_PAYMENT_DATE_INVALID", `${name} must be a valid ISO date.`);
  return text;
};
const token = (value: unknown, name: string, max = 120) => {
  const text = String(value ?? "").trim();
  if (text.length < 3 || text.length > max || /[\u0000-\u001f\u007f]/.test(text)) throw new FinancialControlError(400, "CONTRACT_PAYMENT_VALUE_INVALID", `${name} is invalid.`);
  return text;
};

export function normalizePaymentApplication(input: any) {
  const periodStart = date(input.periodStart, "periodStart"), periodEnd = date(input.periodEnd, "periodEnd");
  if (periodEnd < periodStart) throw new FinancialControlError(400, "CONTRACT_PAYMENT_PERIOD_INVALID", "Payment period end cannot precede its start.");
  const currency = contractCurrency(input.currency), grossAmount = amount(input.grossAmount, "grossAmount"), retainageAmount = amount(input.retainageAmount ?? "0", "retainageAmount");
  const netScaled = scaledSignedDecimal(grossAmount) - scaledSignedDecimal(retainageAmount);
  if (netScaled < 0n) throw new FinancialControlError(400, "CONTRACT_PAYMENT_RETAINAGE_INVALID", "Retainage cannot exceed the gross amount.");
  const lines = Array.isArray(input.lines) ? input.lines.map((line: any, index: number) => ({
    contractSovLineId: token(line.contractSovLineId, "contractSovLineId"),
    currentAmount: amount(line.currentAmount, "currentAmount"),
    evidence: line.evidence && typeof line.evidence === "object" && !Array.isArray(line.evidence) ? line.evidence : {},
    sortOrder: Number.isSafeInteger(line.sortOrder) && line.sortOrder >= 0 ? line.sortOrder : index,
  })) : [];
  if (!lines.length || new Set(lines.map((line) => line.contractSovLineId)).size !== lines.length) throw new FinancialControlError(400, "CONTRACT_PAYMENT_LINES_INVALID", "Payment applications require unique governed SOV lines.");
  const lineTotal = lines.reduce((sum, line) => sum + scaledSignedDecimal(line.currentAmount), 0n);
  if (lineTotal !== scaledSignedDecimal(grossAmount)) throw new FinancialControlError(400, "CONTRACT_PAYMENT_LINES_UNRECONCILED", "Payment line total must equal the gross amount exactly.");
  const normalized = { applicationNumber: token(input.applicationNumber, "applicationNumber"), idempotencyKey: token(input.idempotencyKey, "idempotencyKey", 200), periodStart, periodEnd, currency, grossAmount, retainageAmount, netAmount: decimalFromScaled(netScaled), lines };
  const contentFingerprint = crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
  return { ...normalized, contentFingerprint };
}
