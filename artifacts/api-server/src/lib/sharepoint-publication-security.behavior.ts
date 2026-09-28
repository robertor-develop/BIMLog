import assert from "node:assert/strict";
import { sanitizeSharePointPublicationDiagnostic } from "./sharepoint-publication-security";
assert.deepEqual(sanitizeSharePointPublicationDiagnostic({ jobId: "job-1", state: "retry", token: "hidden", credentialId: "hidden", payload: { bytes: "hidden" }, attempts: 2 }), { jobId: "job-1", state: "retry", attempts: 2 });
