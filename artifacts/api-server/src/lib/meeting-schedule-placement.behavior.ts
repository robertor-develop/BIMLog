import assert from "node:assert/strict";
import { placeMeetingCommitment } from "./meeting-schedule-placement";

const first = placeMeetingCommitment({ commitmentId: "A-1", sourceKind: "rfi", sourceId: "RFI-10", sourceVersion: 2, contractualDueDate: "2026-10-01", plannedStart: "2026-09-29", plannedFinish: "2026-10-03" });
const moved = placeMeetingCommitment({ ...first, sourceVersion: 3, plannedStart: "2026-10-02", plannedFinish: "2026-10-06", prior: first });
assert.equal(moved.placementVersion, 2);
assert.equal(moved.contractualDueDate, "2026-10-01");
assert.throws(() => placeMeetingCommitment({ ...moved, contractualDueDate: "2026-10-10", prior: moved }), /CONTRACTUAL_DATE_IMMUTABLE/);
assert.throws(() => placeMeetingCommitment({ ...moved, sourceVersion: 1, prior: moved }), /SOURCE_VERSION_STALE/);
console.log("C053 schedule placement preserves source deadline authority: PASS");
