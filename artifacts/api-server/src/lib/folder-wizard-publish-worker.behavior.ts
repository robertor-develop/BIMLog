import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseFolderWizardExport } from "./folder-wizard-export";
import { planFolderWizardPublish } from "./folder-wizard-publish-plan";
import { createFolderWizardPublishJob } from "./folder-wizard-publish-job";
import { FolderWizardPublishWorker } from "./folder-wizard-publish-worker";
import type { FolderWizardLease } from "./folder-wizard-publish-lease";
import type { FolderWizardCandidateSnapshot } from "./folder-wizard-publish-candidate";
import type { StorageAdapter } from "./storage-adapter";

const sourceText = JSON.stringify({ generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)",
  destination: { sharepoint_url: "https://bimtech.sharepoint.com/sites/QA", base_path: "Shared Documents" },
  blueprints: [{ name: "Shop", include: true, tiers: [{ label: "TYPE", items: ["SHOP"], mode: "none", start: 0, width: 0, sep: "_", case: "upper" }] }] });
const bytes = Buffer.from("synthetic worker input");
const snapshot: FolderWizardCandidateSnapshot = { importId: "import-1", sourceText,
  profile: { definition: { selectors: [], tierMappings: [] }, importId: "import-1", scope: "project" },
  mapping: { state: "active", credentialState: "active", credentialId: "credential-1", siteId: "site-1", libraryId: "drive-1" },
  verifiedSiteUrl: "https://bimtech.sharepoint.com/sites/QA", verifiedLibraryId: "drive-1",
  file: { id: 7, projectId: 5, name: "proof.txt", storageKey: "opaque",
    sha256: createHash("sha256").update(bytes).digest("hex"), byteSize: bytes.length, status: "active" } };
const plan = planFolderWizardPublish({ document: parseFolderWizardExport(sourceText).document,
  importId: "import-1", profile: { selectors: [], tierMappings: [] }, tags: {}, filename: "proof.txt",
  sourceFileId: 7, sourceSha256: snapshot.file!.sha256, sourceBytes: bytes.length,
  credentialId: "credential-1", siteId: "site-1", libraryId: "drive-1",
  verifiedSiteUrl: snapshot.verifiedSiteUrl!, verifiedLibraryId: "drive-1" });
const job = createFolderWizardPublishJob({ companyId: 3, projectId: 5, actorUserId: 2, plan, jobId: "job-0001" });
const lease: FolderWizardLease = { jobId: job.id, companyId: 3, projectId: 5,
  credentialId: job.credentialId, createdById: 2, requestDigest: job.requestDigest,
  leaseOwner: "worker-1", leaseToken: "11111111-1111-4111-8111-111111111111",
  fencingToken: 1, attempts: 1, payload: job.payload };
const storage = { health: async () => ({ backendType: "durable-filesystem", capabilities: ["bounded-read"], maxReadBytes: 10_485_760 }),
  downloadBounded: async () => Buffer.from(bytes) } as unknown as StorageAdapter;
for (const stale of [false, true]) {
  let uploadCount = 0;
  let outcomeKind = "";
  const worker = new FolderWizardPublishWorker({ read: async () => stale ? { ...snapshot, mapping: null } : snapshot },
    storage, { create: async ({ bytes: actual }) => { uploadCount++; assert.deepEqual(actual, bytes); return { itemId: "item-1" }; } },
    { settle: async (_lease, outcome) => { outcomeKind = outcome.kind;
      return outcome.kind === "completed" ? "completed" : "dead_letter"; } });
  assert.equal(await worker.run(lease), stale ? "dead_letter" : "completed");
  assert.equal(uploadCount, stale ? 0 : 1);
  assert.equal(outcomeKind, stale ? "failed" : "completed");
}
console.log("Folder Wizard isolated publish worker: PASS");
