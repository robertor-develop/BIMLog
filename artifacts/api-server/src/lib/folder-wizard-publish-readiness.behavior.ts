import assert from "node:assert/strict";
import { evaluateFolderWizardPublishReadiness as check } from "./folder-wizard-publish-readiness";

const sourceText = JSON.stringify({ generated_by: "BT Folder Wizard", version: "3.1 (BIMLOG export)",
  destination: { sharepoint_url: "https://bimtech.sharepoint.com/sites/QA", base_path: "Shared Documents" },
  blueprints: [{ name: "Test", include: true, tiers: [{ label: "TYPE", items: ["SHOP"], mode: "none", start: 0, width: 0, sep: "_", case: "upper" }] }] });
const valid = { sourceText, importId: "import-1", profile: { definition: { selectors: [], tierMappings: [] }, importId: "import-1", scope: "project" as const },
  projectMapping: { state: "active", credentialState: "active", siteId: "site-1", libraryId: "library-1" },
  verifiedSiteUrl: "https://BIMTECH.sharepoint.com/sites/qa/", verifiedLibraryId: "library-1" };
assert.deepEqual(check(valid), { ready: true, blockers: [] });
assert.deepEqual(check({ ...valid, sourceText: null }).blockers, ["IMPORT_MISSING"]);
assert.deepEqual(check({ ...valid, profile: null }).blockers, ["ROUTING_MISSING"]);
assert.deepEqual(check({ ...valid, profile: { ...valid.profile, importId: "old" } }).blockers, ["ROUTING_STALE"]);
assert.deepEqual(check({ ...valid, projectMapping: null }).blockers, ["PROJECT_MAPPING_MISSING"]);
assert.deepEqual(check({ ...valid, verifiedSiteUrl: "https://other.sharepoint.com/sites/QA" }).blockers, ["SITE_IDENTITY_UNVERIFIED"]);
assert.deepEqual(check({ ...valid, verifiedLibraryId: "other" }).blockers, ["LIBRARY_IDENTITY_UNVERIFIED"]);
assert.deepEqual(check({ ...valid, projectMapping: { ...valid.projectMapping, credentialState: "revoked" } }).blockers, ["CREDENTIAL_INACTIVE"]);
console.log("Folder Wizard publishing readiness contract: PASS");
