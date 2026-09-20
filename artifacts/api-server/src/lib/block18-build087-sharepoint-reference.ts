import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const sharePointCanonicalReferenceSchema = z.object({
  projectId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  credentialId: id,
  siteId: id,
  libraryId: id,
  providerItemId: id,
  providerVersionId: id,
  providerEtag: id,
  sourceSha256: digest,
  discoveredAt: z.string().datetime({ offset: true }),
  linkedByUserId: z.number().int().positive(),
}).strict();

export type SharePointCanonicalReference = z.infer<typeof sharePointCanonicalReferenceSchema>;

export function canonicalSharePointIdentity(value: SharePointCanonicalReference): string {
  return [value.companyId, value.projectId, value.siteId, value.libraryId, value.providerItemId, value.providerVersionId].join(":");
}

export function linkSharePointReference(input: unknown, existing: SharePointCanonicalReference | null) {
  const value = sharePointCanonicalReferenceSchema.parse(input);
  if (!existing) return { outcome: "linked" as const, reference: value };
  const current = sharePointCanonicalReferenceSchema.parse(existing);
  if (canonicalSharePointIdentity(current) !== canonicalSharePointIdentity(value)) {
    return { outcome: "new_revision_required" as const, reference: current };
  }
  if (current.sourceSha256 !== value.sourceSha256 || current.providerEtag !== value.providerEtag) {
    return { outcome: "manual_review" as const, reference: current };
  }
  return { outcome: "replay" as const, reference: current };
}
