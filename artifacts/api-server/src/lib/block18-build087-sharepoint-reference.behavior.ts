import assert from "node:assert/strict";
import { canonicalSharePointIdentity, linkSharePointReference } from "./block18-build087-sharepoint-reference";

const reference = { projectId: 26, companyId: 9, credentialId: "credential-1", siteId: "site-1", libraryId: "library-1", providerItemId: "item-1", providerVersionId: "version-1", providerEtag: "etag-1", sourceSha256: "a".repeat(64), discoveredAt: "2026-09-20T12:00:00Z", linkedByUserId: 14 } as const;
assert.equal(canonicalSharePointIdentity(reference), "9:26:site-1:library-1:item-1:version-1");
assert.equal(linkSharePointReference(reference, null).outcome, "linked");
assert.equal(linkSharePointReference({ ...reference, discoveredAt: "2026-09-20T12:01:00Z" }, reference).outcome, "replay");
assert.equal(linkSharePointReference({ ...reference, providerVersionId: "version-2" }, reference).outcome, "new_revision_required");
assert.equal(linkSharePointReference({ ...reference, providerEtag: "etag-forged" }, reference).outcome, "manual_review");
assert.equal(linkSharePointReference({ ...reference, sourceSha256: "b".repeat(64) }, reference).outcome, "manual_review");
assert.throws(() => linkSharePointReference({ ...reference, storagePath: "private/path" }, null));
assert.equal(JSON.stringify(linkSharePointReference(reference, null)).includes("storagePath"), false);
console.log("block18 build087 sharepoint canonical reference: PASS");
