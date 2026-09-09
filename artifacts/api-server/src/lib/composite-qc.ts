import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);

export const compositeQcDecisionSchema = z.object({
  compositeManifestId: id,
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  reviewerUserId: z.number().int().positive(),
  reviewedAt: z.string().datetime({ offset: true }),
  checks: z.array(z.object({
    key: id,
    result: z.enum(["pass", "fail", "not_applicable"]),
    blocking: z.boolean(),
    evidenceRevisionIds: z.array(id).max(100),
    note: z.string().trim().max(4_096),
  }).strict()).min(1).max(500),
  decision: z.enum(["approve", "reject"]),
  decisionReason: z.string().trim().min(1).max(4_096),
}).strict().superRefine((value, context) => {
  const keys = value.checks.map((check) => check.key);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", path: ["checks"], message: "QC check keys must be unique" });
  const failedBlocking = value.checks.some((check) => check.blocking && check.result === "fail");
  const missingEvidence = value.checks.some((check) => check.result !== "not_applicable" && check.evidenceRevisionIds.length === 0);
  if (value.decision === "approve" && failedBlocking) context.addIssue({ code: "custom", path: ["decision"], message: "A composite with a blocking failure cannot be approved" });
  if (value.decision === "approve" && missingEvidence) context.addIssue({ code: "custom", path: ["decision"], message: "Every applicable QC check requires immutable evidence" });
});

export type CompositeQcDecision = z.infer<typeof compositeQcDecisionSchema>;

export function recordCompositeQcDecision(input: unknown): CompositeQcDecision {
  return compositeQcDecisionSchema.parse(input);
}
