import crypto from "crypto";
import { FinancialControlError, parseCurrency, parseDecimal, scaledDecimal } from "./financial-control-contract";
import { boundedText, decimalFromScaled, exactSignedDecimal, scaledSignedDecimal } from "./financial-budget-contract";

export const CONTRACT_PERSPECTIVES = ["upstream", "downstream"] as const;
export const CONTRACT_TYPES = ["owner_prime", "subcontract", "purchase_order", "consultant_agreement", "other_commitment"] as const;
export const CONTRACT_STATUSES = ["draft", "submitted", "under_review", "approved", "returned", "rejected", "withdrawn", "executed", "superseded", "terminated", "voided", "closed"] as const;
export const CONTRACT_RECORD_PERMISSIONS = ["view", "prepare", "review", "approve", "execute", "manage"] as const;

export type ContractLineInput = {
  stableLineId: string;
  budgetSnapshotLineId: string;
  projectCostNodeId: string;
  scheduleItemPlacementId: number | null;
  description: string;
  amount: string;
  sortOrder: number;
};

const oneOf = <T extends readonly string[]>(value: unknown, values: T, field: string): T[number] => {
  const text = String(value ?? "");
  if (!values.includes(text)) throw new FinancialControlError(400, "CONTRACT_VALUE_INVALID", `${field} is not recognized.`);
  return text as T[number];
};

export const contractPerspective = (v: unknown) => oneOf(v, CONTRACT_PERSPECTIVES, "perspective");
export const contractType = (v: unknown) => oneOf(v, CONTRACT_TYPES, "contractType");
export const contractPermission = (v: unknown) => oneOf(v, CONTRACT_RECORD_PERMISSIONS, "permission");
export const contractCurrency = (v: unknown) => parseCurrency(v);
export const exactPositiveAmount = (v: unknown, field = "amount") => parseDecimal(v, field);
export const exactDelta = (v: unknown, field = "amountDelta") => exactSignedDecimal(v, field);

export function normalizeContractLines(input: unknown, signed = false): ContractLineInput[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 10000)
    throw new FinancialControlError(400, "CONTRACT_LINES_INVALID", "One to 10,000 SOV lines are required.");
  const ids = new Set<string>();
  return input.map((raw, index) => {
    const r = raw as Record<string, unknown>;
    const stableLineId = boundedText(r.stableLineId, "stableLineId", 1, 100);
    if (ids.has(stableLineId)) throw new FinancialControlError(400, "CONTRACT_LINE_DUPLICATE", "SOV line identities must be unique.");
    ids.add(stableLineId);
    const schedule = r.scheduleItemPlacementId == null || r.scheduleItemPlacementId === "" ? null : Number(r.scheduleItemPlacementId);
    if (schedule != null && (!Number.isSafeInteger(schedule) || schedule <= 0))
      throw new FinancialControlError(400, "CONTRACT_SCHEDULE_LINK_INVALID", "Schedule links must identify a canonical project schedule item.");
    return {
      stableLineId,
      budgetSnapshotLineId: boundedText(r.budgetSnapshotLineId, "budgetSnapshotLineId", 3, 100),
      projectCostNodeId: boundedText(r.projectCostNodeId, "projectCostNodeId", 3, 100),
      scheduleItemPlacementId: schedule,
      description: boundedText(r.description, "description", 1, 500),
      amount: signed ? exactDelta(r.amount ?? r.amountDelta) : exactPositiveAmount(r.amount),
      sortOrder: Number.isSafeInteger(Number(r.sortOrder)) ? Number(r.sortOrder) : index,
    };
  });
}

export function contractLineTotal(lines: ReadonlyArray<Pick<ContractLineInput, "amount">>): string {
  return decimalFromScaled(lines.reduce((sum, line) => sum + scaledSignedDecimal(line.amount), 0n));
}

export function assertReconciledTotal(lines: ContractLineInput[], expected: string, field: string) {
  const total = contractLineTotal(lines);
  if (scaledSignedDecimal(total) !== scaledSignedDecimal(expected))
    throw new FinancialControlError(400, "CONTRACT_SOV_NOT_RECONCILED", `SOV lines must reconcile exactly to ${field}.`);
  return total;
}

export function exactVariance(committed: string, budget: string) {
  return decimalFromScaled(scaledSignedDecimal(committed) - scaledSignedDecimal(budget));
}

export function absoluteExact(value: string) {
  const n = scaledSignedDecimal(value);
  return decimalFromScaled(n < 0n ? -n : n);
}

export function greaterThanZero(value: string) {
  return scaledSignedDecimal(value) > 0n;
}

export function higherLimitIsStrict(primary: string, higher: string) {
  return scaledDecimal(higher) > scaledDecimal(primary);
}

export function contractFingerprint(value: unknown) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function safeCommercialMetadata(value: unknown) {
  if (value == null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new FinancialControlError(400, "CONTRACT_METADATA_INVALID", "Commercial metadata must be an object.");
  const input = value as Record<string, unknown>;
  const output: Record<string, string | null> = {};
  for (const key of ["retainage", "tax", "bond", "insurance"]) {
    const raw = input[key];
    output[key] = raw == null || raw === "" ? null : boundedText(raw, key, 1, 500);
  }
  return output;
}
