import assert from "node:assert/strict";
import { dailyEvidenceForRecord, linkDailyEvidence } from "./daily-evidence-link";

const photo = linkDailyEvidence({ linkId: "LINK-1", projectId: 8, dailyRecordId: "DR-8-1", custodyObjectId: "custody/photo/original-91", originalFileId: 91, note: "North elevation", state: "linked", failureCode: null, linkedBy: "user-4", linkedAt: "2026-09-28T16:00:00Z" }, []);
assert.equal(linkDailyEvidence(photo, [photo]), photo, "retry returns the exact existing custody link");
assert.equal(dailyEvidenceForRecord({ projectId: 8, dailyRecordId: "DR-8-1", links: [photo, { ...photo, linkId: "foreign", projectId: 9 }] }).length, 1);
assert.throws(() => linkDailyEvidence({ ...photo, custodyObjectId: "changed" }, [photo]), /conflicts/);
const failed = linkDailyEvidence({ linkId: "LINK-2", projectId: 8, dailyRecordId: "DR-8-1", custodyObjectId: null, originalFileId: null, note: null, state: "upload_failed", failureCode: "UPLOAD_TIMEOUT", linkedBy: "user-4", linkedAt: "2026-09-28T16:01:00Z" }, [photo]);
assert.equal(failed.failureCode, "UPLOAD_TIMEOUT", "upload failure remains visible and does not impersonate custody");
assert.throws(() => linkDailyEvidence({ ...failed, linkId: "LINK-3", state: "privacy_restricted", failureCode: null }, []), /visible failure code/);
console.log("C073 custody-preserving daily photos and notes: PASS");
