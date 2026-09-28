import assert from "node:assert/strict";
import { verifyPublicationRecoveryPoint } from "./sharepoint-publication-recovery";
const point = { sourceCommit: "a".repeat(40), jobCount: 2, eventCount: 5, digest: "b".repeat(64), loginVerified: true };
assert.equal(verifyPublicationRecoveryPoint(point, point), true);
assert.equal(verifyPublicationRecoveryPoint(point, { ...point, eventCount: 4 }), false);
assert.equal(verifyPublicationRecoveryPoint(point, { ...point, loginVerified: false }), false);
