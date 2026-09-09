import assert from "node:assert/strict";
import { reconcileSharePointItem } from "./sharepoint-reconciliation";

const base = { provider: "sharepoint", providerItemId: "item-1", providerVersionId: "v1", providerEtag: "etag-1", providerByteSize: 42, providerSha256: "a".repeat(64), registeredRevision: { providerItemId: "item-1", providerVersionId: "v1", byteSize: 42, contentSha256: "a".repeat(64), isCurrent: true } } as const;
assert.deepEqual(reconcileSharePointItem(base), { status: "current", reason: "immutable_identity_and_digest_match" });
assert.deepEqual(reconcileSharePointItem({ ...base, registeredRevision: null }), { status: "import_required", reason: "unregistered_provider_item" });
assert.deepEqual(reconcileSharePointItem({ ...base, providerVersionId: "v2" }), { status: "import_required", reason: "new_provider_version" });
assert.deepEqual(reconcileSharePointItem({ ...base, providerSha256: null }), { status: "manual_review", reason: "digest_unavailable" });
assert.deepEqual(reconcileSharePointItem({ ...base, providerByteSize: 43 }), { status: "manual_review", reason: "immutable_content_mismatch" });
assert.deepEqual(reconcileSharePointItem({ ...base, registeredRevision: { ...base.registeredRevision, isCurrent: false } }), { status: "manual_review", reason: "registered_revision_not_current" });
console.log("sharepoint reconciliation behavior: PASS");
