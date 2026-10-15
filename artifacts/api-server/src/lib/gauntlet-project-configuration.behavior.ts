import assert from "node:assert/strict";
import { inspectGauntletProjectConfiguration, type GauntletProjectConfiguration } from "./gauntlet-project-configuration";

const fixture: GauntletProjectConfiguration = {
  projectId: 64001, code: "QA-GAUNTLET-SYNTHETIC", name: "Synthetic lifecycle acceptance",
  description: "Synthetic fixture only; no customer, invoice, payment, or external delivery.", companyId: 71, clientCompanyId: 72,
  location: "Synthetic test site", projectType: "coordination", deliveryMethod: "controlled_delivery",
  startDate: "2026-10-01", endDate: "2026-12-31", currency: "usd", disciplineIds: [4, 2],
  roleCodes: ["project_admin", "drafter", "read_only"], workflowVersionIds: ["workflow-v2"],
  templateVersionId: "template-v3", namingConventionVersionId: "convention-v1", synthetic: true,
  billingEnabled: false, externalNotificationsEnabled: false,
};
const first = inspectGauntletProjectConfiguration(fixture);
const reopened = inspectGauntletProjectConfiguration(JSON.parse(JSON.stringify(fixture)));
assert.deepEqual(reopened, first);
assert.deepEqual(first.disciplineIds, [2, 4]);
assert.match(first.fingerprint, /^[a-f0-9]{64}$/);
assert.throws(() => inspectGauntletProjectConfiguration({ ...fixture, billingEnabled: true }), /EXTERNAL_EFFECT_FORBIDDEN/);
assert.throws(() => inspectGauntletProjectConfiguration({ ...fixture, disciplineIds: [2, 2] }), /DISCIPLINES_REQUIRED/);
assert.throws(() => inspectGauntletProjectConfiguration({ ...fixture, endDate: "2026-09-30" }), /DATES_INVALID/);
console.log("B-GA011 synthetic project configuration persistence and external-effect boundary: PASS");
