import { FinancialControlError } from "./financial-control-contract";
import { financialFingerprint, type CommercialPriceResult } from "./financial-correctness-contract";

export type FinancialRevision = Readonly<{
  version: number;
  status: "draft" | "approved" | "superseded";
  preparedBy: number;
  approvedBy: number | null;
  reason: string;
  price: CommercialPriceResult;
  fingerprint: string;
  supersedesFingerprint: string | null;
}>;

function fail(code: string, message: string): never { throw new FinancialControlError(409, code, message); }
function reason(value: unknown): string {
  const result = String(value ?? "").trim();
  if (result.length < 10 || result.length > 1000 || /[\u0000-\u001f\u007f]/.test(result)) fail("FINANCIAL_REVISION_REASON_INVALID", "A bounded audit reason is required.");
  return result;
}
function seal(value: Omit<FinancialRevision, "fingerprint">): FinancialRevision {
  const payload = { version: value.version, status: value.status, preparedBy: value.preparedBy, approvedBy: value.approvedBy, reason: value.reason, price: Object.freeze({ ...value.price }), supersedesFingerprint: value.supersedesFingerprint };
  const revision = { ...payload, fingerprint: financialFingerprint(payload) };
  return Object.freeze(revision);
}
export function createFinancialRevision(history: readonly FinancialRevision[], preparedBy: number, price: CommercialPriceResult, auditReason: string): readonly FinancialRevision[] {
  if (!Number.isSafeInteger(preparedBy) || preparedBy <= 0) fail("FINANCIAL_ACTOR_INVALID", "A current preparing actor is required.");
  const current = history.at(-1);
  if (current) {
    const { fingerprint, ...payload } = current;
    if (fingerprint !== financialFingerprint(payload)) fail("FINANCIAL_HISTORY_TAMPERED", "The current financial revision failed fingerprint verification.");
  }
  const preserved = history.map(item => current === item && item.status === "approved" ? seal({ ...item, status: "superseded" }) : item);
  return Object.freeze([...preserved, seal({ version: (current?.version ?? 0) + 1, status: "draft", preparedBy, approvedBy: null, reason: reason(auditReason), price, supersedesFingerprint: current?.fingerprint ?? null })]);
}
export function approveFinancialRevision(history: readonly FinancialRevision[], approver: number, expectedFingerprint: string, auditReason: string): readonly FinancialRevision[] {
  const current = history.at(-1);
  if (!current || current.status !== "draft") fail("FINANCIAL_REVISION_NOT_DRAFT", "Only the current draft can be approved.");
  if (current.fingerprint !== expectedFingerprint) fail("FINANCIAL_REVISION_STALE", "The financial revision changed; reload before approval.");
  if (current.preparedBy === approver) fail("FIN_MAKER_CHECKER_REQUIRED", "The preparing user cannot approve the same revision.");
  return Object.freeze([...history.slice(0, -1), seal({ ...current, status: "approved", approvedBy: approver, reason: reason(auditReason) })]);
}
