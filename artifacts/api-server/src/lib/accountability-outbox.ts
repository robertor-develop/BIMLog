import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const accountabilityDeliveryIntentSchema = z.object({
  id,
  actionId: id,
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  recipientContactId: z.number().int().positive(),
  channel: z.enum(["email", "in_app"]),
  templateKey: id,
  payloadDigest: digest,
  idempotencyKey: id,
  approval: z.object({ required: z.boolean(), approvedByUserId: z.number().int().positive().nullable(), approvedAt: z.string().datetime({ offset: true }).nullable() }).strict(),
}).strict().superRefine((value, context) => {
  const completeApproval = value.approval.approvedByUserId !== null && value.approval.approvedAt !== null;
  if ((value.approval.approvedByUserId === null) !== (value.approval.approvedAt === null)) context.addIssue({ code: "custom", path: ["approval"], message: "Approval actor and timestamp must be recorded together" });
  if (value.approval.required && !completeApproval) context.addIssue({ code: "custom", path: ["approval"], message: "Required approval is missing" });
});

export type AccountabilityDeliveryIntent = z.infer<typeof accountabilityDeliveryIntentSchema>;

export class AccountabilityOutboxConflict extends Error {}

export function enqueueAccountabilityIntent(input: unknown, existing: AccountabilityDeliveryIntent | null): { result: "queued" | "idempotent"; intent: AccountabilityDeliveryIntent } {
  const intent = accountabilityDeliveryIntentSchema.parse(input);
  if (!existing) return { result: "queued", intent };
  if (existing.idempotencyKey !== intent.idempotencyKey || existing.payloadDigest !== intent.payloadDigest || existing.projectId !== intent.projectId || existing.companyId !== intent.companyId) throw new AccountabilityOutboxConflict("Delivery idempotency identity conflicts");
  return { result: "idempotent", intent: existing };
}
