import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { FolderWizardPublishCandidateService, type FolderWizardCandidateSnapshot } from "./folder-wizard-publish-candidate";
import type { StorageAdapter } from "./storage-adapter";

const bytes = Buffer.from("synthetic candidate");
const snapshot: FolderWizardCandidateSnapshot = {
  importId: "import-1", sourceText: JSON.stringify({ generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)",
    destination: { sharepoint_url: "https://bimtech.sharepoint.com/sites/QA", base_path: "Shared Documents" },
    blueprints: [{ name: "Shop", include: true, tiers: [{ label: "TYPE", items: ["SHOP"], mode: "none", start: 0, width: 0, sep: "_", case: "upper" }] }] }),
  profile: { definition: { selectors: [], tierMappings: [] }, importId: "import-1", scope: "project" },
  mapping: { state: "active", credentialState: "active", credentialId: "credential-1", siteId: "site-1", libraryId: "drive-1" },
  verifiedSiteUrl: "https://bimtech.sharepoint.com/sites/QA", verifiedLibraryId: "drive-1",
  file: { id: 7, projectId: 5, name: "proof.txt", storageKey: "opaque", sha256: createHash("sha256").update(bytes).digest("hex"), byteSize: bytes.length, status: "active" },
};
const storage = { health: async () => ({ backendType: "durable-filesystem", capabilities: ["bounded-read"], maxReadBytes: 10_485_760 }),
  downloadBounded: async () => bytes } as unknown as StorageAdapter;
const service = new FolderWizardPublishCandidateService({ read: async () => snapshot }, storage);
assert.deepEqual(await service.preview({ projectId: 5, actorUserId: 2, fileId: 7, tags: {} }), {
  ready: true, blockers: [], fileId: 7, filename: "proof.txt", byteSize: bytes.length,
  siteUrl: "https://bimtech.sharepoint.com/sites/qa", driveRelativePath: "SHOP/proof.txt",
  requestDigest: (await service.preview({ projectId: 5, actorUserId: 2, fileId: 7, tags: {} }) as { requestDigest: string }).requestDigest,
  publicationState: "not_submitted",
});
assert.deepEqual(await new FolderWizardPublishCandidateService({ read: async () => ({ ...snapshot, mapping: null }) }, storage)
  .preview({ projectId: 5, actorUserId: 2, fileId: 7, tags: {} }), { ready: false, blockers: ["PROJECT_MAPPING_MISSING"] });
await assert.rejects(new FolderWizardPublishCandidateService({ read: async () => ({ ...snapshot, file: { ...snapshot.file!, projectId: 6 } }) }, storage)
  .preview({ projectId: 5, actorUserId: 2, fileId: 7, tags: {} }), /SOURCE_FORBIDDEN/);
console.log("Folder Wizard read-only publish candidate: PASS");
