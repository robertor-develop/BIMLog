import assert from "node:assert/strict";
import { previewIntakeCompatibility } from "./intake-release-readiness";

const legacy = previewIntakeCompatibility({
  identity: { jobName: "Legacy job", jobCode: "L-1", currency: "USD" },
  scopeItems: [{ id: "S-1", name: "Drafting", plannedHours: "10", billingHourlyRate: "20" }],
  commercial: { counterpartyName: "Legacy customer", contractNumber: "C-1" },
  team: { assignments: [{ id: "A-1", role: "Draftsperson", plannedHours: "10" }] },
});
assert.equal(legacy.mode, "legacy_preview");
assert.equal(legacy.idempotent, true);
assert.equal(legacy.preserved.scopeItems, true);
assert.equal(legacy.preserved.assignments, true);
assert.equal(legacy.normalized.scopeItems[0].name, "Drafting");
assert.equal(legacy.normalized.commercial.contracts[0].contractNumber, "C-1");

const participants = ["BIMTECH", "GC", "HVAC", "PLUMBING", "OWNER"].map((id) => ({ id, companyName: id, role: id === "OWNER" ? "owner" : "service_provider" }));
const engagements = [
  { id: "E1", providerParticipantId: "BIMTECH", customerParticipantId: "GC" },
  { id: "E2", providerParticipantId: "BIMTECH", customerParticipantId: "HVAC" },
  { id: "E3", providerParticipantId: "BIMTECH", customerParticipantId: "PLUMBING" },
  { id: "E4", providerParticipantId: "GC", customerParticipantId: "OWNER" },
];
const contracts = engagements.map((e, i) => ({ id: `C${i + 1}`, title: `Agreement ${i + 1}`, engagementId: e.id }));
const apuDrafts = contracts.flatMap((c, i) => i === 0 ? [{ id: "APU1", contractId: c.id, title: "Coordination", method: "hours_hourly_rate", hours: "20", hourlyRate: "37.99" }, { id: "APU2", contractId: c.id, title: "Audit", method: "fixed", fixedAmount: "500" }] : [{ id: `APU${i + 2}`, contractId: c.id, title: `Service ${i + 1}`, method: "fixed", fixedAmount: "500" }]);
const workPackages = apuDrafts.map((a, i) => ({ id: `WP${i + 1}`, apuDraftId: a.id, title: `Package ${i + 1}`, floor: i < 2 ? "Level 10" : "", task: "Deliver" }));
const resourcePlans = workPackages.map((p, i) => ({ id: `R${i + 1}`, workPackageId: p.id, role: i % 2 ? "Draftsperson" : "Coordinator", plannedHours: "10", internalHourlyRate: "35.47" }));
const complete = previewIntakeCompatibility({ identity: { jobName: "River Avenue", jobCode: "RA-1", currency: "USD" }, relationships: { participants, engagements }, commercial: { contracts }, scopeItems: [], apuDrafts, workPackages, resourcePlans, delivery: {}, team: {}, review: {} }, [{ id: 1 }]);
assert.equal(complete.mode, "current_format");
assert.equal(complete.ready, true);
assert.equal(complete.counts.companies, 5);
assert.equal(complete.counts.agreements, 4);
assert.equal(complete.counts.apus, 5);
assert.equal(complete.counts.packages, 5);
assert.equal(complete.counts.resources, 5);
console.log("Intake compatibility and complete-scenario release readiness: PASS");
