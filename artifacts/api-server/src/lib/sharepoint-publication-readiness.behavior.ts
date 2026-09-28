import assert from "node:assert/strict";
import { projectSharePointPublicationReadiness } from "./sharepoint-publication-readiness";

const blocked = projectSharePointPublicationReadiness({ sourceText: null, importId: null, profile: null,
  projectMapping: null, verifiedSiteUrl: null, verifiedLibraryId: null });
assert.deepEqual(blocked, { state: "blocked", blockers: ["IMPORT_MISSING"], requiresConfirmation: false });
