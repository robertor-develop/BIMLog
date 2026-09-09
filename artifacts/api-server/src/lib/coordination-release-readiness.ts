import { z } from "zod/v4";

export const coordinationReleaseGateKeySchema = z.enum([
  "authority_scope",
  "sharepoint_discovery",
  "sharepoint_reconciliation",
  "outlook_intake",
  "outlook_project_routing",
  "trade_collection",
  "trade_submission_review",
  "accountability_evaluation",
  "delivery_outbox",
  "composite_source_control",
  "composite_qc",
  "procore_return",
  "design_comments",
  "unified_actions",
  "meeting_report_actions",
  "for_record_issuance",
  "for_record_receipts",
  "full_repository_build",
]);

export const coordinationReleaseReadinessSchema = z.object({
  sourceHead: z.string().regex(/^[a-f0-9]{40}$/),
  evaluatedAt: z.string().datetime({ offset: true }),
  gates: z.array(z.object({ key: coordinationReleaseGateKeySchema, passed: z.boolean(), evidence: z.string().trim().min(1).max(2_048) }).strict()).length(18),
  externalEffects: z.object({ databaseApplied: z.literal(false), providerActivated: z.literal(false), messagesSent: z.literal(false), deployed: z.literal(false), published: z.literal(false) }).strict(),
}).strict().superRefine((value, context) => {
  const keys = value.gates.map((gate) => gate.key);
  if (new Set(keys).size !== coordinationReleaseGateKeySchema.options.length) context.addIssue({ code: "custom", path: ["gates"], message: "Every release gate must appear exactly once" });
});

export function evaluateCoordinationReleaseReadiness(input: unknown): { status: "ready_for_integration_review" } | { status: "blocked"; failedGates: string[] } {
  const value = coordinationReleaseReadinessSchema.parse(input);
  const failedGates = value.gates.filter((gate) => !gate.passed).map((gate) => gate.key);
  return failedGates.length ? { status: "blocked", failedGates } : { status: "ready_for_integration_review" };
}
