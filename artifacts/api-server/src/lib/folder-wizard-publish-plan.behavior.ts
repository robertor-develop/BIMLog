import assert from "node:assert/strict";
import { parseFolderWizardExport } from "./folder-wizard-export";
import { planFolderWizardPublish } from "./folder-wizard-publish-plan";

const document = parseFolderWizardExport(JSON.stringify({ generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)",
  destination: { sharepoint_url: "https://bimtech.sharepoint.com/sites/QA", base_path: "Shared Documents" },
  blueprints: [{ name: "Shop", include: true, tiers: [{ label: "TYPE", items: ["SHOP"], mode: "none", start: 0, width: 0, sep: "_", case: "upper" }] }] })).document;
const input = { document, importId: "import-1", profile: { selectors: [], tierMappings: [] }, tags: {}, filename: "proof.txt",
  sourceFileId: 8, sourceSha256: "a".repeat(64), sourceBytes: 16, credentialId: "credential-1", siteId: "site-1",
  libraryId: "drive-1", verifiedSiteUrl: "https://BIMTECH.sharepoint.com/sites/qa/", verifiedLibraryId: "drive-1" };
const first = planFolderWizardPublish(input);
assert.equal(first.driveRelativePath, "SHOP/proof.txt");
assert.equal(first.requestDigest, planFolderWizardPublish(input).requestDigest);
assert.notEqual(first.requestDigest, planFolderWizardPublish({ ...input, sourceSha256: "b".repeat(64) }).requestDigest);
assert.throws(() => planFolderWizardPublish({ ...input, verifiedLibraryId: "other" }), /AUTHORITY_INVALID/);
assert.throws(() => planFolderWizardPublish({ ...input, verifiedSiteUrl: "https://other.sharepoint.com/sites/QA" }), /AUTHORITY_INVALID/);
assert.throws(() => planFolderWizardPublish({ ...input, filename: "../proof.txt" }), /FILENAME_INVALID/);
console.log("Folder Wizard deterministic publish plan: PASS");
