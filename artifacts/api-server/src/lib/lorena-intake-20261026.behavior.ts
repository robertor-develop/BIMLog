import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../../../", import.meta.url);
const contract = readFileSync(new URL("api-server/src/lib/job-intake-contract.ts", root), "utf8");
const editor = readFileSync(new URL("bimlog/src/components/job-intake/ContractItemBulkEditor.tsx", root), "utf8");
const delivery = readFileSync(new URL("bimlog/src/components/job-intake/IntakeDeliveryItems.tsx", root), "utf8");
const activation = readFileSync(new URL("api-server/src/lib/job-intake-service.ts", root), "utf8");
const apu = readFileSync(new URL("api-server/src/lib/cost-value-plan-service.ts", root), "utf8");

assert.match(contract, /const plannedHours = quantity;/, "server must derive operational hours from Quantity");
assert.doesNotMatch(editor, /Planned labor hours row/, "Intake must not render a duplicate labor-hours field");
assert.doesNotMatch(editor, /Horas de trabajo previstas/, "Spanish Intake must not render the removed field");
assert.doesNotMatch(delivery, /Submittal strategy/, "removed delivery prose must not be rendered");
assert.doesNotMatch(delivery, /Milestones and distribution/, "removed milestone prose must not be rendered");
assert.match(delivery, /Apply this workflow to every matching Contract Item/, "workflow selection needs a bulk propagation action");
assert.doesNotMatch(contract, /Describe the Submittal delivery strategy and milestones for every Contract Item/, "removed prose cannot block activation");
assert.match(activation, /requireWorkflowPhaseHours\([\s\S]*?item\.plannedHours,[\s\S]*?workflowPhases,[\s\S]*?allocation\?\.rows/, "activation must allocate the authoritative total through the workflow");
assert.match(apu, /generic_project_apu_versions/, "a successfully applied company-library APU must be selectable in Intake");

console.log("lorena-intake-20261026.behavior: PASS");
