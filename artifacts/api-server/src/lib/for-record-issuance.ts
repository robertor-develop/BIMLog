import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const forRecordIssuanceSchema = z.object({
  id,
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  coordinationFileId: id,
  revisionId: id,
  observedCurrentRevisionId: id,
  contentSha256: digest,
  qcDecisionId: id,
  qcDecision: z.literal("approve"),
  issuePurpose: z.string().trim().min(1).max(2_048),
  recipients: z.array(z.object({ contactId: z.number().int().positive(), companyId: z.number().int().positive(), deliveryChannel: z.enum(["email", "provider_transmittal", "in_app"]) }).strict()).min(1).max(500),
  approvedByUserId: z.number().int().positive(),
  approvedAt: z.string().datetime({ offset: true }),
  status: z.literal("proposed"),
}).strict().superRefine((value, context) => {
  if (value.revisionId !== value.observedCurrentRevisionId) context.addIssue({ code: "custom", path: ["revisionId"], message: "For Record issuance requires the observed current revision" });
  const recipientKeys = value.recipients.map((recipient) => `${recipient.companyId}:${recipient.contactId}:${recipient.deliveryChannel}`);
  if (new Set(recipientKeys).size !== recipientKeys.length) context.addIssue({ code: "custom", path: ["recipients"], message: "For Record recipients must be unique" });
});

export type ForRecordIssuance = z.infer<typeof forRecordIssuanceSchema>;

export function proposeForRecordIssuance(input: unknown): ForRecordIssuance {
  return forRecordIssuanceSchema.parse(input);
}
