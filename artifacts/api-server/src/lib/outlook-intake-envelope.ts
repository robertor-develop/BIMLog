import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);
const address = z.string().trim().email().transform((value) => value.toLowerCase());

export const outlookIntakeEnvelopeSchema = z.object({
  provider: z.literal("microsoft_graph"),
  mailboxCredentialId: id,
  internetMessageId: id,
  providerMessageId: id,
  conversationId: id,
  receivedAt: z.string().datetime({ offset: true }),
  sender: address,
  recipients: z.array(address).min(1).max(500),
  subject: z.string().max(2_048),
  bodyPreview: z.string().max(4_096),
  hasAttachments: z.boolean(),
  attachmentRefs: z.array(z.object({ providerAttachmentId: id, name: z.string().trim().min(1).max(512), byteSize: z.number().int().nonnegative() }).strict()).max(500),
}).strict().superRefine((value, context) => {
  if (value.hasAttachments !== (value.attachmentRefs.length > 0)) context.addIssue({ code: "custom", path: ["hasAttachments"], message: "Attachment flag must match immutable attachment references" });
});

export type OutlookIntakeEnvelope = z.infer<typeof outlookIntakeEnvelopeSchema>;

export function parseOutlookIntakeEnvelope(input: unknown): OutlookIntakeEnvelope {
  return outlookIntakeEnvelopeSchema.parse(input);
}
