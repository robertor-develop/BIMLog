import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const forRecordReceiptSchema = z.object({
  id,
  issuanceId: id,
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  recipientContactId: z.number().int().positive(),
  recipientCompanyId: z.number().int().positive(),
  channel: z.enum(["email", "provider_transmittal", "in_app"]),
  providerDeliveryId: id,
  contentSha256: digest,
  outcome: z.enum(["delivered", "failed"]),
  occurredAt: z.string().datetime({ offset: true }),
  failureCode: z.string().regex(/^[A-Z0-9][A-Z0-9_:-]{0,127}$/).nullable(),
}).strict().superRefine((value, context) => {
  if ((value.outcome === "failed") !== (value.failureCode !== null)) context.addIssue({ code: "custom", path: ["failureCode"], message: "A failure code is required only for a failed delivery" });
});

export type ForRecordReceipt = z.infer<typeof forRecordReceiptSchema>;

export function recordForRecordReceipt(input: unknown, existing: ForRecordReceipt | null): { result: "recorded" | "idempotent"; receipt: ForRecordReceipt } {
  const receipt = forRecordReceiptSchema.parse(input);
  if (!existing) return { result: "recorded", receipt };
  const match = existing.providerDeliveryId === receipt.providerDeliveryId && existing.issuanceId === receipt.issuanceId && existing.projectId === receipt.projectId && existing.recipientContactId === receipt.recipientContactId && existing.contentSha256 === receipt.contentSha256 && existing.outcome === receipt.outcome;
  if (!match) throw new Error("For Record provider receipt conflicts with immutable delivery evidence");
  return { result: "idempotent", receipt: existing };
}
