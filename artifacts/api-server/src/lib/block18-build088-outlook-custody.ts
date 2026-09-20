import { createHash } from "node:crypto";
import { z } from "zod/v4";
import { outlookIntakeEnvelopeSchema } from "./outlook-intake-envelope";

const mappingSchema = z.object({
  companyId: z.number().int().positive(),
  projectId: z.number().int().positive(),
  mailboxCredentialId: z.string().trim().min(1).max(1_024),
  internetMessageId: z.string().trim().min(1).max(1_024),
  conversationId: z.string().trim().min(1).max(1_024),
  envelopeSha256: z.string().regex(/^[a-f0-9]{64}$/),
  attachmentRefs: z.array(z.object({ providerAttachmentId: z.string().trim().min(1).max(1_024), name: z.string().trim().min(1).max(512), byteSize: z.number().int().nonnegative() }).strict()).max(500),
}).strict();

export type OutlookCustodyMapping = z.infer<typeof mappingSchema>;

export function mapOutlookCustody(envelopeInput: unknown, companyId: number, projectId: number, existing: OutlookCustodyMapping | null) {
  const envelope = outlookIntakeEnvelopeSchema.parse(envelopeInput);
  const candidate = mappingSchema.parse({
    companyId,
    projectId,
    mailboxCredentialId: envelope.mailboxCredentialId,
    internetMessageId: envelope.internetMessageId,
    conversationId: envelope.conversationId,
    envelopeSha256: createHash("sha256").update(JSON.stringify(envelope)).digest("hex"),
    attachmentRefs: envelope.attachmentRefs,
  });
  if (!existing) return { outcome: "mapped" as const, mapping: candidate };
  const current = mappingSchema.parse(existing);
  const sameAuthority = current.companyId === candidate.companyId && current.projectId === candidate.projectId && current.mailboxCredentialId === candidate.mailboxCredentialId;
  if (!sameAuthority) throw new Error("OUTLOOK_CROSS_TENANT_OR_PROJECT_CONFLICT");
  if (current.internetMessageId !== candidate.internetMessageId || current.conversationId !== candidate.conversationId) throw new Error("OUTLOOK_MESSAGE_IDENTITY_CONFLICT");
  if (current.envelopeSha256 !== candidate.envelopeSha256) throw new Error("OUTLOOK_DIVERGENT_REPLAY");
  return { outcome: "replay" as const, mapping: current };
}
