import assert from "node:assert/strict";
import { buildMeetingLookahead } from "./meeting-lookahead";

const base = { commitmentId: "A-1", sourceKind: "rfi", sourceId: "RFI-10", sourceVersion: 2, contractualDueDate: "2026-10-01", plannedStart: "2026-09-29", plannedFinish: "2026-10-03", placementVersion: 1, ownerUserId: 20, title: "Resolve duct route" };
const two = buildMeetingLookahead({ asOfDate: "2026-09-28", weeks: 2, items: [{ ...base, constraints: [{ id: "C-1", state: "open", ownerUserId: 25, evidenceIds: ["SUB-3"] }] }] });
assert.equal(two.horizonEnd, "2026-10-12");
assert.equal(two.items[0].condition, "blocked");
const six = buildMeetingLookahead({ asOfDate: "2026-09-28", weeks: 6, items: [{ ...base, commitmentId: "A-2", plannedStart: "2026-10-20", plannedFinish: "2026-10-22", constraints: [] }] });
assert.equal(six.items.length, 1);
assert.throws(() => buildMeetingLookahead({ asOfDate: "2026-09-28", weeks: 2, items: [{ ...base, constraints: [{ id: "C-2", state: "open", ownerUserId: 0, evidenceIds: [] }] }] }), /ACCOUNTABILITY_REQUIRED/);
console.log("C054 two/six-week lookahead and constraint truth: PASS");
