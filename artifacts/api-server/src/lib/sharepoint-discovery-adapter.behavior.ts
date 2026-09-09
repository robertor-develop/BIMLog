import assert from "node:assert/strict";
import { SharePointDiscoveryAdapter } from "./sharepoint-discovery-adapter";

let authorized = 0;
let reads = 0;
const adapter = new SharePointDiscoveryAdapter(
  { assertReadScope: async (scope) => { authorized += 1; assert.equal(scope.projectId, 7); assert.equal(scope.companyId, 3); } },
  { discover: async ({ pageSize }) => { reads += 1; return { items: [{ providerItemId: "item-1", providerVersionId: "v1", parentItemId: null, name: "Coordination.ifc", kind: "file", byteSize: 42, modifiedAt: "2026-09-09T10:00:00Z", etag: "etag-1" }].slice(0, pageSize), nextCursor: null }; } },
);

const page = await adapter.discover({ projectId: 7, companyId: 3, actorUserId: 11, credentialId: "cred-1", siteId: "site-1", libraryId: "library-1", folderId: null, cursor: null, pageSize: 50 });
assert.equal(page.items.length, 1);
assert.equal(authorized, 1);
assert.equal(reads, 1);
await assert.rejects(() => adapter.discover({ projectId: 7, companyId: 3, actorUserId: 11, credentialId: "cred-1", siteId: "site-1", libraryId: "library-1", folderId: null, cursor: null, pageSize: 201 }));
assert.equal(reads, 1);
console.log("sharepoint discovery adapter behavior: PASS");
