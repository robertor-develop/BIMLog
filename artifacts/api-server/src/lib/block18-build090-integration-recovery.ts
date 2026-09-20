import { z } from "zod/v4";

const eventSchema = z.object({
  eventKey: z.string().trim().min(1).max(256),
  provider: z.enum(["procore", "sharepoint", "microsoft_graph", "google_drive", "dropbox"]),
  companyId: z.number().int().positive(),
  projectId: z.number().int().positive(),
  operation: z.string().trim().min(1).max(128),
  payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  providerAcknowledgementId: z.string().trim().min(1).max(1_024).nullable(),
  failureCode: z.string().trim().min(1).max(128).regex(/^[A-Z0-9_]+$/).nullable(),
  occurredAt: z.string().datetime({ offset: true }),
}).strict().superRefine((value, context) => {
  if ((value.providerAcknowledgementId === null) === (value.failureCode === null)) {
    context.addIssue({ code: "custom", message: "Exactly one provider outcome is required" });
  }
});

export type IntegrationRecoveryEvent = z.infer<typeof eventSchema>;

export function recordIntegrationRecovery(input: unknown, existing: IntegrationRecoveryEvent | null) {
  const event = eventSchema.parse(input);
  if (!existing) return { outcome: event.providerAcknowledgementId ? "succeeded" as const : "failed" as const, event, auditAppended: true };
  const current = eventSchema.parse(existing);
  const sameIdentity = current.eventKey === event.eventKey && current.provider === event.provider && current.companyId === event.companyId && current.projectId === event.projectId && current.operation === event.operation && current.payloadSha256 === event.payloadSha256;
  if (!sameIdentity) throw new Error("INTEGRATION_RECOVERY_DIVERGENT_REPLAY");
  if (current.providerAcknowledgementId) {
    if (event.providerAcknowledgementId !== current.providerAcknowledgementId) throw new Error("INTEGRATION_RECOVERY_ACK_CONFLICT");
    return { outcome: "replay" as const, event: current, auditAppended: false };
  }
  if (!event.providerAcknowledgementId) return { outcome: "failed_replay" as const, event: current, auditAppended: false };
  return { outcome: "recovered" as const, event, auditAppended: true, previousFailureCode: current.failureCode };
}
