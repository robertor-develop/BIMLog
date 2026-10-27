import assert from "node:assert/strict";
import { normalizeJobIntakeData } from "./job-intake-contract";

const itemClassification = { disciplineId: "discipline-plumbing", disciplineCode: "PLUMBING", disciplineName: "Plumbing", serviceId: "service-shop", serviceCode: "SHOP", serviceName: "Shop Drawings", phaseId: "", phaseCode: "", phaseName: "" };
const raw = {
  classification: { disciplineId: 7, disciplineCode: "MECH", disciplineName: "Mechanical", serviceId: "service-1", serviceCode: "SHOP", serviceName: "Shop Drawings", phaseId: "phase-1", phaseCode: "COORD", phaseName: "Coordination" },
  scopeItems: [{ id: "CI-TRADE-SERVICE", name: "UNDERGROUND_PB_SH", quantity: "8", classification: itemClassification }],
};
const normalized = normalizeJobIntakeData(raw);
assert.deepEqual(normalized.classification, { disciplineId: "7", disciplineCode: "MECH", disciplineName: "Mechanical", serviceId: "service-1", serviceCode: "SHOP", serviceName: "Shop Drawings", phaseId: "phase-1", phaseCode: "COORD", phaseName: "Coordination" });
assert.deepEqual(normalized.scopeItems[0]?.classification, itemClassification, "each Contract Item preserves its governed Trade and Service snapshot");
const renamed = normalizeJobIntakeData(normalized);
assert.deepEqual(renamed.classification, normalized.classification, "historical snapshots survive refresh without free-text reconstruction");
assert.deepEqual(renamed.scopeItems[0]?.classification, itemClassification, "Contract Item Trade and Service survive save, reopen, and refresh normalization");
console.log("master catalog Intake stable-ID and historical-label persistence: PASS");
