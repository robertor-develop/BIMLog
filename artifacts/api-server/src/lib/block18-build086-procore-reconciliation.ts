import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

const attachmentSchema = z.object({
  providerAttachmentId: id,
  fileName: z.string().trim().min(1).max(512),
  byteSize: z.number().int().nonnegative(),
  sha256: digest,
}).strict();

export const procoreReconciliationPageSchema = z.object({
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  cursor: id.nullable(),
  nextCursor: id.nullable(),
  records: z.array(z.object({
    providerRfiId: id,
    providerRevision: z.number().int().nonnegative(),
    sourceSha256: digest,
    attachments: z.array(attachmentSchema).max(500),
  }).strict()).max(200),
}).strict();

export type ProcoreReconciliationPage = z.infer<typeof procoreReconciliationPageSchema>;

export function reconcileProcorePage(input: unknown, seen: ReadonlyMap<string, string>) {
  const page = procoreReconciliationPageSchema.parse(input);
  const identities = new Set<string>();
  const attachmentIds = new Set<string>();
  const actions = page.records.map((record) => {
    const identity = `${page.companyId}:${page.projectId}:${record.providerRfiId}:${record.providerRevision}`;
    if (identities.has(identity)) throw new Error("PROCORE_PAGE_DUPLICATE_RFI_IDENTITY");
    identities.add(identity);
    for (const attachment of record.attachments) {
      const attachmentIdentity = `${identity}:${attachment.providerAttachmentId}`;
      if (attachmentIds.has(attachmentIdentity)) throw new Error("PROCORE_PAGE_DUPLICATE_ATTACHMENT_IDENTITY");
      attachmentIds.add(attachmentIdentity);
    }
    const previous = seen.get(identity);
    if (previous && previous !== record.sourceSha256) throw new Error("PROCORE_RFI_REVISION_CONFLICT");
    return { identity, outcome: previous ? "replay" as const : "import" as const, sourceSha256: record.sourceSha256 };
  });
  if (page.nextCursor !== null && page.nextCursor === page.cursor) throw new Error("PROCORE_CURSOR_DID_NOT_ADVANCE");
  return { nextCursor: page.nextCursor, actions };
}
