import { z } from "zod/v4";

const id = z.string().trim().min(1).max(1_024);
const digest = z.string().regex(/^[a-f0-9]{64}$/);

export const sharePointReconciliationInputSchema = z.object({
  provider: z.literal("sharepoint"),
  providerItemId: id,
  providerVersionId: id,
  providerEtag: id,
  providerByteSize: z.number().int().nonnegative(),
  providerSha256: digest.nullable(),
  registeredRevision: z.object({
    providerItemId: id,
    providerVersionId: id,
    byteSize: z.number().int().nonnegative(),
    contentSha256: digest,
    isCurrent: z.boolean(),
  }).strict().nullable(),
}).strict();

export type SharePointReconciliationInput = z.infer<typeof sharePointReconciliationInputSchema>;
export type SharePointReconciliationDecision =
  | { status: "import_required"; reason: "unregistered_provider_item" | "new_provider_version" }
  | { status: "current"; reason: "immutable_identity_and_digest_match" }
  | { status: "manual_review"; reason: "digest_unavailable" | "immutable_content_mismatch" | "registered_revision_not_current" };

export function reconcileSharePointItem(input: unknown): SharePointReconciliationDecision {
  const value = sharePointReconciliationInputSchema.parse(input);
  const registered = value.registeredRevision;
  if (!registered) return { status: "import_required", reason: "unregistered_provider_item" };
  if (registered.providerItemId !== value.providerItemId || registered.providerVersionId !== value.providerVersionId) {
    return { status: "import_required", reason: "new_provider_version" };
  }
  if (!value.providerSha256) return { status: "manual_review", reason: "digest_unavailable" };
  if (registered.contentSha256 !== value.providerSha256 || registered.byteSize !== value.providerByteSize) {
    return { status: "manual_review", reason: "immutable_content_mismatch" };
  }
  if (!registered.isCurrent) return { status: "manual_review", reason: "registered_revision_not_current" };
  return { status: "current", reason: "immutable_identity_and_digest_match" };
}
