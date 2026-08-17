import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ResourceSchedulingWorkspaceView, validateResourcePlanningWorkspace, type ResourcePlanningWorkspace } from "./ResourceSchedulingPanel";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "ResourceSchedulingPanel.tsx"), "utf8");
const noop = () => undefined;
const profile = { weeklyCapacityHours: 40, timezone: "America/New_York", workingDays: [1, 2, 3, 4, 5], leave: [{ startDate: "2026-08-20", endDate: "2026-08-21", label: "Approved leave" }], internalHourlyRate: 45, billingHourlyRate: 95 };
const evaluation = { people: [{ userId: 5, capacityHours: 144, existingHours: 52, scenarioHours: 24, availableHours: 92, utilization: 0.5278, internalCost: null, billingValue: null, warnings: [] }], totals: { scenarioHours: 24, internalCost: null, billingValue: null }, warnings: [], decision: "review_required" };
const assignment = { taskId: "task-1", userId: 5, plannedHours: 24, startDate: "2026-08-17", endDate: "2026-08-21", category: "MEP coordination", reason: "Reviewed staffing proposal", expectedTaskVersion: 3, assignmentId: null, expectedAssignmentVersion: null };
const data: ResourcePlanningWorkspace = {
  project: { id: 7, code: "ELA01", name: "ELARA EAST" }, canManage: true, canViewRates: false, canManageRates: false,
  members: [{ id: 5, name: "Alicia Rivera", jobTitle: "BIM Coordinator", role: "discipline_lead", profile: { id: "profile-1", version: 2, content: profile }, crossProjectLoad: [{ projectId: 8, projectCode: "NORTH", projectName: "North Tower", remainingHours: "12.50" }], verifiedExperience: [{ category: "MEP coordination", evidenceCount: 7, lastEvidence: "2026-08-12" }] }],
  tasks: [{ id: "task-1", nameEn: "Coordinate MEP model", nameEs: "Coordinar modelo MEP", status: "active", plannedHours: "40", progress: 40, assigneeUserId: 5, version: 3, workItem: "MEP coordination", assignmentId: null, assignmentVersion: null }],
  scenarios: [{ id: "scenario-version-1", scenarioKey: "scenario-1", version: 1, content: { name: "August MEP plan", startDate: "2026-08-17", endDate: "2026-08-21", assignments: [assignment] }, evaluation, applied: false }],
  methodology: "Saved availability and leave define capacity. Existing commitments come only from authorized Job Operations projects.",
};

const props = (overrides: Record<string, unknown> = {}) => ({
  data, lang: "en", actorUserId: 5, loading: false, busy: false, error: "", notice: "", rows: [assignment], name: "August MEP plan", startDate: "2026-08-17", endDate: "2026-08-21", evaluation,
  profileDrafts: { 5: profile }, selectedScenarioId: "scenario-version-1", applicationReason: "Reviewed with the project lead", applicationConfirmed: false,
  onReload: noop, onAdd: noop, onRows: noop, onName: noop, onStartDate: noop, onEndDate: noop, onStartProfile: noop, onEvaluate: noop, onSave: noop, onProfileDrafts: noop, onSaveProfile: noop, onExport: noop, onSelectScenario: noop, onReason: noop, onConfirmed: noop, onApply: noop,
  ...overrides,
});
const render = (overrides: Record<string, unknown> = {}) => renderToStaticMarkup(<ResourceSchedulingWorkspaceView {...props(overrides) as any}/>);

assert.equal(validateResourcePlanningWorkspace(data), data);
for (const malformed of [null, {}, { ...data, members: null }, { ...data, tasks: null }, { ...data, methodology: null }, { ...data, members: [{ ...data.members[0], verifiedExperience: null }] }, { ...data, members: [{ ...data.members[0], profile: { version: 2, content: {} } }] }, { ...data, tasks: [{ ...data.tasks[0], assignmentId: 7 }] }, { ...data, scenarios: [{ ...data.scenarios[0], content: { ...data.scenarios[0].content, assignments: [{}] } }] }, { ...data, scenarios: [{ ...data.scenarios[0], evaluation: { ...evaluation, people: [{}] } }] }]) {
  assert.throws(() => validateResourcePlanningWorkspace(malformed), /RESOURCE_PLANNING_RESPONSE_INCOMPLETE/);
}

const english = render();
for (const expected of ["Resource Scheduling &amp; Assignment Execution", "nothing is secretly scored or automatically assigned", "Alicia Rivera", "NORTH", "12.50h", "Verified evidence", "Saved immutable scenarios", "Apply changes only eligible direct task assignees", "Review warnings, leave, the current capacity profile, authorized commitments, verified evidence", "Apply reviewed assignees", "Scenario hours are never written"]) assert.match(english, new RegExp(expected, "i"));
assert.match(english, /MEP coordination \(7\)/);
assert.match(english, /type="checkbox"/);
assert.match(english, /disabled=""[^>]*>.*Apply reviewed assignees/s);

const spanish = render({ lang: "es" });
for (const expected of ["Programación de Recursos", "nunca es una calificación inferida", "Evidencia verificada", "Escenarios inmutables guardados", "responsables directos elegibles", "Aplicar responsables revisados"]) assert.match(spanish, new RegExp(expected, "i"));
assert.match(spanish, /La disponibilidad y las ausencias guardadas definen la capacidad/);
assert.doesNotMatch(spanish, /Saved availability and leave define capacity/);

const missingProfileData = { ...data, members: [{ ...data.members[0], profile: null }] };
const missingProfile = render({ data: missingProfileData, profileDrafts: {} });
assert.match(missingProfile, /Capacity profile not configured/);
assert.match(missingProfile, /Configure my availability/);
assert.doesNotMatch(missingProfile, /value="40"/);

const loading = render({ data: null, loading: true });
assert.match(loading, /Loading verified capacity and assignment evidence/);
const failed = render({ data: null, error: "The resource-planning server response is incomplete." });
assert.match(failed, /Resource Scheduling is unavailable/);
assert.match(failed, /Reload/);
const empty = render({ data: { ...data, tasks: [], scenarios: [] }, rows: [], evaluation: null, selectedScenarioId: "" });
assert.match(empty, /No active Job Operations tasks are available/);
assert.match(empty, /disabled=""[^>]*>.*Add direct task assignment/s);
const denied = render({ data: { ...data, canManage: false }, selectedScenarioId: "" });
assert.doesNotMatch(denied, /Review &amp; apply/);
const pricedTaskData = { ...data, tasks: [{ ...data.tasks[0], assignmentId: "assignment-1", assignmentVersion: 2 }], scenarios: [] };
const pricedTask = render({ data: pricedTaskData, rows: [], evaluation: null, selectedScenarioId: "" });
assert.match(pricedTask, /All active tasks use priced resource assignments/);
assert.match(pricedTask, /Open Job Operations/);
assert.match(pricedTask, /disabled=""[^>]*>.*Add direct task assignment/s);
const warning = render({ evaluation: { ...evaluation, people: [{ ...evaluation.people[0], warnings: ["CAPACITY_EXCEEDED", "NO_VERIFIED_CATEGORY_EVIDENCE:MEP coordination"] }] } });
assert.match(warning, /Capacity exceeded/);
assert.match(warning, /No verified evidence for MEP coordination/);

for (const contract of ["/resource-planning", "verifiedExperience", "expectedTaskVersion", "expectedAssignmentVersion", "crypto.randomUUID()", "applicationConfirmed", "Review & apply", "CAPACITY_PROFILE_REQUIRED", "No empty or guessed plan was substituted", "@media(max-width:390px)", "PrintPdfButton"]) assert.match(`${source}\n${fs.readFileSync(path.resolve(here, "../../pages/TeamPerformanceWorkspace.tsx"), "utf8")}`, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(source, /window\.print|window\.confirm|mock data|defaultProfile/);

console.log(JSON.stringify({ status: "PASS", tests: ["strict-payload", "production-component-ssr", "populated-en", "populated-es", "missing-profile-no-invented-default", "loading", "fail-visible-malformed", "empty-tasks", "permission-limited", "capacity-warning", "verified-evidence-warning", "consequential-apply-confirmation", "responsive-390-contract", "no-browser-print"] }));
