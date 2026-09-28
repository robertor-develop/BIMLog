import assert from "node:assert/strict";
import { publicationLifecycleAuthority } from "./sharepoint-publication-lifecycle";
assert.deepEqual(publicationLifecycleAuthority("completed", false), { exportAllowed: true, correctionMode: "append_only", archiveAllowed: true, deleteAllowed: false, immutableEvidence: true });
assert.equal(publicationLifecycleAuthority("cancelled", true).deleteAllowed, false);
assert.equal(publicationLifecycleAuthority("retry", false).archiveAllowed, false);
