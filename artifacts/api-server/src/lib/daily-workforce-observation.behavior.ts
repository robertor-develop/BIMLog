import assert from "node:assert/strict";
import { recordWorkforceObservation, workforceObservationSummary } from "./daily-workforce-observation";

const observation = recordWorkforceObservation({ observationId: "OBS-1", projectId: 8, dailyRecordId: "DR-8-1", assignmentId: "ASSIGN-22", companyId: 4, activity: "Duct installation", observedHeadcount: 6, observedHours: 30, observedAt: "2026-09-28T15:00:00Z", observerId: "user-4" });
assert.equal(observation.financialAuthority, "none", "field observations never become payable time authority");
const unknownHours = recordWorkforceObservation({ ...observation, observationId: "OBS-2", observedHours: null });
const summary = workforceObservationSummary({ projectId: 8, observations: [observation, unknownHours, { ...observation, observationId: "foreign", projectId: 9 }] });
assert.equal(summary.observations, 2);
assert.equal(summary.observedHeadcount, 12);
assert.equal(summary.observedHours, null, "missing observed duration remains unknown rather than becoming zero");
assert.match(summary.notice, /not an approved time entry/i);
assert.throws(() => recordWorkforceObservation({ ...observation, observationId: "bad", assignmentId: "" }), /assignment identity/);
console.log("C072 assignment-linked non-payroll workforce observations: PASS");
