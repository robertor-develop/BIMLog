import assert from "node:assert/strict";
import { normalizeJobIntakeData } from "./job-intake-contract";

const raw = { classification: { disciplineId: 7, disciplineCode: "MECH", disciplineName: "Mechanical", serviceId: "service-1", serviceCode: "SHOP", serviceName: "Shop Drawings", phaseId: "phase-1", phaseCode: "COORD", phaseName: "Coordination" } };
const normalized = normalizeJobIntakeData(raw);
assert.deepEqual(normalized.classification, { disciplineId: "7", disciplineCode: "MECH", disciplineName: "Mechanical", serviceId: "service-1", serviceCode: "SHOP", serviceName: "Shop Drawings", phaseId: "phase-1", phaseCode: "COORD", phaseName: "Coordination" });
const renamed = normalizeJobIntakeData(normalized);
assert.deepEqual(renamed.classification, normalized.classification, "historical snapshots survive refresh without free-text reconstruction");
console.log("master catalog Intake stable-ID and historical-label persistence: PASS");
