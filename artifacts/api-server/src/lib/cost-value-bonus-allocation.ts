import { edtFingerprint } from "./edt-engine-transaction";
import { FinancialControlError, parseMoney, scaledDecimal, type FinancialDecision, type Money } from "./financial-control-contract";

/** Internal contract only. The persistence service must resolve funding and reservations under a lock. */
export type BonusFunding = { id: string; version: number; fingerprint: string; companyId: number; projectId: number; reserve: Money };
export type BonusReservation = { id: string; fundingId: string; companyId: number; projectId: number; state: "pending" | "approved" | "rejected"; amount: Money };
export type BonusProposal = {
  funding: BonusFunding; makerUserId: number; reason: string;
  entries: Array<{ userId: number; amount: string }>;
  total: Money; fingerprint: string; paymentAuthorized: false;
};
const fail = (code: string, message: string): never => { throw new FinancialControlError(409, code, message); };
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const amountText = (value: bigint) => `${value / 1_000_000n}.${String(value % 1_000_000n).padStart(6, "0")}`;

export function prepareBonusProposal(input: {
  funding: BonusFunding; makerUserId: number; reason: string; entries: Array<{ userId: number; amount: string }>;
  eligibleUserIds: readonly number[];
}): BonusProposal {
  const { funding } = input;
  if (!funding.id?.trim() || !id(funding.companyId) || !id(funding.projectId) || !id(funding.version) ||
      !/^[a-f0-9]{64}$/.test(funding.fingerprint) || !id(input.makerUserId))
    fail("BONUS_SOURCE_INVALID", "A versioned, scoped funding source and proposer are required.");
  const reserve = parseMoney(funding.reserve);
  if (typeof input.reason !== "string" || input.reason.trim().length < 8 || input.reason.trim().length > 1000 || /[\u0000-\u001f\u007f]/.test(input.reason))
    fail("BONUS_REASON_REQUIRED", "Provide a meaningful allocation reason of 8 to 1000 characters.");
  if (!Array.isArray(input.entries) || input.entries.length < 1 || input.entries.length > 100)
    fail("BONUS_ENTRIES_INVALID", "An allocation requires between one and 100 recipients.");
  const seen = new Set<number>();
  const entries = input.entries.map(entry => {
    if (!entry || !id(entry.userId) || !input.eligibleUserIds.includes(entry.userId))
      fail("BONUS_RECIPIENT_INELIGIBLE", "Every recipient must have current eligibility in this project.");
    if (seen.has(entry.userId)) fail("BONUS_RECIPIENT_DUPLICATE", "A recipient may appear only once in a proposal.");
    seen.add(entry.userId);
    const amount = parseMoney({ amount: entry.amount, currency: reserve.currency }).amount;
    if (scaledDecimal(amount) === 0n) fail("BONUS_AMOUNT_REQUIRED", "Each proposed amount must be positive.");
    return { userId: entry.userId, amount };
  }).sort((a, b) => a.userId - b.userId);
  const total = parseMoney({ amount: amountText(entries.reduce((sum, entry) => sum + scaledDecimal(entry.amount), 0n)), currency: reserve.currency });
  if (scaledDecimal(total.amount) > scaledDecimal(reserve.amount)) fail("BONUS_RESERVE_EXCEEDED", "The proposal exceeds its funding reserve.");
  const content = { funding: { ...funding, reserve }, makerUserId: input.makerUserId, reason: input.reason.trim(), entries, total, paymentAuthorized: false as const };
  return { ...content, fingerprint: edtFingerprint(content) };
}

export function verifyBonusCapacity(proposal: BonusProposal, reservations: readonly BonusReservation[]): void {
  const seen = new Set<string>();
  let reserved = 0n;
  for (const row of reservations) {
    if (!row.id || seen.has(row.id)) fail("BONUS_RESERVATION_DUPLICATE", "Reservation evidence contains duplicate identities.");
    seen.add(row.id);
    if (row.fundingId !== proposal.funding.id || row.companyId !== proposal.funding.companyId || row.projectId !== proposal.funding.projectId)
      fail("BONUS_RESERVATION_SCOPE_MISMATCH", "Reservation evidence must belong to the same funding source and tenant.");
    const money = parseMoney(row.amount);
    if (money.currency !== proposal.total.currency) fail("BONUS_CURRENCY_MISMATCH", "Mixed-currency allocation is not supported.");
    if (!["pending", "approved", "rejected"].includes(row.state)) fail("BONUS_RESERVATION_STATE_INVALID", "Unknown reservation state.");
    if (row.state !== "rejected") reserved += scaledDecimal(money.amount);
  }
  if (reserved + scaledDecimal(proposal.total.amount) > scaledDecimal(proposal.funding.reserve.amount))
    fail("BONUS_RESERVE_EXCEEDED", "Pending and approved allocations leave insufficient reserve.");
}

export function verifyIndependentBonusDecision(proposal: BonusProposal, input: {
  actorUserId: number; expectedFingerprint: string; authority: FinancialDecision; outcome?: "approved" | "rejected";
}): void {
  const { fingerprint, ...content } = proposal;
  if (input.expectedFingerprint !== fingerprint || edtFingerprint(content) !== fingerprint)
    fail("BONUS_PROPOSAL_STALE", "The proposal changed; reopen it before deciding.");
  if (!id(input.actorUserId) || input.actorUserId === proposal.makerUserId || proposal.entries.some(entry => entry.userId === input.actorUserId))
    fail("BONUS_INDEPENDENT_REVIEW_REQUIRED", "The proposer and recipients cannot decide their own allocation.");
  if (input.authority.decision !== "allow") fail(input.authority.code, "Current financial authority does not permit this decision.");
  if (!input.authority.matchedGrantIds.length || (input.outcome !== "rejected" && !input.authority.policyId))
    fail("BONUS_APPROVAL_POLICY_REQUIRED", "A decision requires an effective financial approval policy and authority.");
  if (input.authority.selfApprovalOverride || (input.outcome !== "rejected" && input.authority.requiresHigherReview))
    fail("BONUS_HIGHER_REVIEW_REQUIRED", "This allocation needs independent review within the applicable approval limit.");
}
