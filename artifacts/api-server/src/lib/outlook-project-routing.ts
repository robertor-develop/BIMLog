import { z } from "zod/v4";

const routeCandidateSchema = z.object({
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  matchedBy: z.enum(["project_reference", "dedicated_mailbox", "explicit_user_selection"]),
  matchedValue: z.string().trim().min(1).max(1_024),
}).strict();

export const outlookRoutingInputSchema = z.object({
  internetMessageId: z.string().trim().min(1).max(1_024),
  conversationId: z.string().trim().min(1).max(1_024),
  candidates: z.array(routeCandidateSchema).max(100),
}).strict();

export type OutlookRoutingDecision =
  | { status: "routed"; projectId: number; companyId: number; evidence: z.infer<typeof routeCandidateSchema> }
  | { status: "review_required"; reason: "no_project_match" | "ambiguous_project_match" };

export function routeOutlookMessage(input: unknown): OutlookRoutingDecision {
  const value = outlookRoutingInputSchema.parse(input);
  const unique = new Map(value.candidates.map((candidate) => [`${candidate.companyId}:${candidate.projectId}`, candidate]));
  if (unique.size === 0) return { status: "review_required", reason: "no_project_match" };
  if (unique.size > 1) return { status: "review_required", reason: "ambiguous_project_match" };
  const evidence = [...unique.values()][0]!;
  return { status: "routed", projectId: evidence.projectId, companyId: evidence.companyId, evidence };
}
