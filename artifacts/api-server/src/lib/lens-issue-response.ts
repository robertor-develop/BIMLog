export const LENS_ISSUE_RESPONSE_CONTRACT = "lens-issue-response.v1" as const;

export const LENS_ISSUE_RESPONSE_OUTCOMES = [
  "cannot_complete",
  "recommend_reassignment",
  "needs_information",
  "completed_work",
] as const;

export type LensIssueResponseOutcome = typeof LENS_ISSUE_RESPONSE_OUTCOMES[number];

export type LensIssueResponseDraft = Readonly<{
  contractVersion: typeof LENS_ISSUE_RESPONSE_CONTRACT;
  clientRequestId: string;
  mutationVersion: number;
  outcome: LensIssueResponseOutcome;
  response: string;
  recommendedCompany: string | null;
}>;

export class LensIssueResponseError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
  }
}

function boundedText(value: unknown, field: string, min: number, max: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < min || text.length > max)
    throw new LensIssueResponseError("LENS_ISSUE_RESPONSE_INVALID", `${field} must contain ${min}-${max} characters.`, 400);
  return text;
}

/**
 * Parses the contractor response contract. A response deliberately has no
 * status or close field: every accepted response enters coordinator review.
 */
export function parseLensIssueResponseDraft(value: unknown): LensIssueResponseDraft {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new LensIssueResponseError("LENS_ISSUE_RESPONSE_INVALID", "The response contract is invalid.", 400);
  const body = value as Record<string, unknown>;
  const allowed = new Set(["contractVersion", "clientRequestId", "mutationVersion", "outcome", "response", "recommendedCompany"]);
  if (body.contractVersion !== LENS_ISSUE_RESPONSE_CONTRACT || Object.keys(body).some(key => !allowed.has(key)))
    throw new LensIssueResponseError("LENS_ISSUE_RESPONSE_INVALID", "The response contract is invalid.", 400);
  const mutationVersion = Number(body.mutationVersion);
  const clientRequestId = String(body.clientRequestId ?? "").trim().toLowerCase();
  const outcome = String(body.outcome ?? "") as LensIssueResponseOutcome;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(clientRequestId)
    || !Number.isSafeInteger(mutationVersion) || mutationVersion < 1 || !(LENS_ISSUE_RESPONSE_OUTCOMES as readonly string[]).includes(outcome))
    throw new LensIssueResponseError("LENS_ISSUE_RESPONSE_INVALID", "A retry-safe request ID, current issue version, and valid response outcome are required.", 400);
  const response = boundedText(body.response, "response", 3, 4000);
  const recommendedCompany = body.recommendedCompany == null || String(body.recommendedCompany).trim() === ""
    ? null
    : boundedText(body.recommendedCompany, "recommendedCompany", 1, 160);
  if (outcome === "recommend_reassignment" && !recommendedCompany)
    throw new LensIssueResponseError("LENS_ISSUE_RESPONSE_COMPANY_REQUIRED", "A recommended responsible company is required.", 422);
  if (outcome !== "recommend_reassignment" && recommendedCompany)
    throw new LensIssueResponseError("LENS_ISSUE_RESPONSE_COMPANY_FORBIDDEN", "A recommended company is only valid for reassignment recommendations.", 422);
  return Object.freeze({ contractVersion: LENS_ISSUE_RESPONSE_CONTRACT, clientRequestId, mutationVersion, outcome, response, recommendedCompany });
}

export function lensIssueResponseFingerprint(draft: LensIssueResponseDraft): string {
  return JSON.stringify([draft.contractVersion, draft.clientRequestId, draft.mutationVersion, draft.outcome, draft.response, draft.recommendedCompany]);
}

export function assertLensIssueCanReceiveResponse(input: {
  lifecycleStatus: unknown;
  status: unknown;
  responsibleCompany: unknown;
  actorCompany: unknown;
  elevated: boolean;
}): void {
  if (input.lifecycleStatus !== "active")
    throw new LensIssueResponseError("LENS_ISSUE_NOT_ACTIVE", "Only the active issue revision can receive a response.", 409);
  if (input.status === "resolved")
    throw new LensIssueResponseError("LENS_ISSUE_ALREADY_RESOLVED", "A resolved issue must be reopened before another response.", 409);
  const responsible = String(input.responsibleCompany ?? "").trim();
  const actor = String(input.actorCompany ?? "").trim();
  if (!input.elevated && (!responsible || !actor || responsible.localeCompare(actor, "en-US", { sensitivity: "base" }) !== 0))
    throw new LensIssueResponseError("LENS_ISSUE_RESPONSE_FORBIDDEN", "Only the assigned responsible company or a project administrator may respond.", 403);
}

export const LENS_ISSUE_RESPONSE_NEXT_STATUS = "under_review" as const;

export const LENS_ISSUE_REVIEW_CONTRACT = "lens-issue-response-review.v1" as const;
export const LENS_ISSUE_REVIEW_DECISIONS = ["resolve", "follow_up", "waiting_design", "approve", "reassign"] as const;
export type LensIssueReviewDecision = typeof LENS_ISSUE_REVIEW_DECISIONS[number];
export type LensIssueReviewDraft = Readonly<{
  contractVersion: typeof LENS_ISSUE_REVIEW_CONTRACT;
  responseId: number;
  mutationVersion: number;
  decision: LensIssueReviewDecision;
  reason: string;
  responsibleCompany: string | null;
}>;

export function parseLensIssueReviewDraft(value: unknown): LensIssueReviewDraft {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new LensIssueResponseError("LENS_ISSUE_REVIEW_INVALID", "The review contract is invalid.", 400);
  const body = value as Record<string, unknown>;
  const allowed = new Set(["contractVersion", "responseId", "mutationVersion", "decision", "reason", "responsibleCompany"]);
  const responseId = Number(body.responseId), mutationVersion = Number(body.mutationVersion);
  const decision = String(body.decision ?? "") as LensIssueReviewDecision;
  if (body.contractVersion !== LENS_ISSUE_REVIEW_CONTRACT || Object.keys(body).some(key => !allowed.has(key))
    || !Number.isSafeInteger(responseId) || responseId < 1 || !Number.isSafeInteger(mutationVersion) || mutationVersion < 1
    || !(LENS_ISSUE_REVIEW_DECISIONS as readonly string[]).includes(decision))
    throw new LensIssueResponseError("LENS_ISSUE_REVIEW_INVALID", "A pending response, current issue version, and valid decision are required.", 400);
  const reason = boundedText(body.reason, "reason", 3, 2000);
  const responsibleCompany = body.responsibleCompany == null || String(body.responsibleCompany).trim() === ""
    ? null : boundedText(body.responsibleCompany, "responsibleCompany", 1, 160);
  if (decision === "reassign" && !responsibleCompany)
    throw new LensIssueResponseError("LENS_ISSUE_REVIEW_COMPANY_REQUIRED", "A responsible company is required for reassignment.", 422);
  if (decision !== "reassign" && responsibleCompany)
    throw new LensIssueResponseError("LENS_ISSUE_REVIEW_COMPANY_FORBIDDEN", "A responsible company is only valid for reassignment.", 422);
  return Object.freeze({ contractVersion: LENS_ISSUE_REVIEW_CONTRACT, responseId, mutationVersion, decision, reason, responsibleCompany });
}

export function lensIssueReviewOutcome(decision: LensIssueReviewDecision): { issueStatus: string; reviewStatus: string } {
  switch (decision) {
    case "resolve": return { issueStatus: "resolved", reviewStatus: "accepted" };
    case "approve": return { issueStatus: "approved", reviewStatus: "accepted" };
    case "follow_up": return { issueStatus: "follow_up", reviewStatus: "returned" };
    case "waiting_design": return { issueStatus: "waiting_design", reviewStatus: "returned" };
    case "reassign": return { issueStatus: "follow_up", reviewStatus: "reassigned" };
  }
}

