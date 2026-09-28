import assert from "node:assert/strict";
import { requireSharePointPublicationAuthority } from "./sharepoint-publication-authority";
import { sanitizeSharePointPublicationDiagnostic } from "./sharepoint-publication-security";
import { publicationLifecycleAuthority } from "./sharepoint-publication-lifecycle";
import { verifyPublicationRecoveryPoint } from "./sharepoint-publication-recovery";

requireSharePointPublicationAuthority({ companyId: 31, projectId: 26, actorCompanyId: 31, actorProjectIds: [26], canPublish: true });
assert.deepEqual(sanitizeSharePointPublicationDiagnostic({ state: "completed", token: "never" }), { state: "completed" });
assert.equal(publicationLifecycleAuthority("completed", true).immutableEvidence, true);
const point = { sourceCommit: "a".repeat(40), jobCount: 1, eventCount: 2, digest: "b".repeat(64), loginVerified: true };
assert.equal(verifyPublicationRecoveryPoint(point, point), true);
console.log("SharePoint publication security/privacy/recovery acceptance: PASS");
