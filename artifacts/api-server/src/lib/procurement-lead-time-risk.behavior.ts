import assert from "node:assert/strict";
import { assessProcurementLeadTime } from "./procurement-lead-time-risk";

const calendar = { id: "standard", version: 2, workingWeekdays: [1, 2, 3, 4, 5], holidays: ["2026-10-12"] };
const risk = assessProcurementLeadTime({ requiredOnSiteDate: "2026-10-09", forecastStartDate: "2026-10-05", leadTimeWorkingDays: 5, calendar, contractualMilestoneDate: "2026-10-20" });
assert.equal(risk.state, "at_risk");
assert.equal(risk.forecastArrivalDate, "2026-10-13", "weekends and versioned holidays are excluded");
assert.equal(risk.contractualMilestoneDate, "2026-10-20", "forecasting does not alter contractual milestones");
const unknown = assessProcurementLeadTime({ requiredOnSiteDate: "2026-10-09", forecastStartDate: "2026-10-05", leadTimeWorkingDays: null, calendar, contractualMilestoneDate: null });
assert.equal(unknown.state, "unknown");
assert.equal(unknown.forecastArrivalDate, null);
console.log("C069 explicit-calendar procurement lead-time risk: PASS");
