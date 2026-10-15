import assert from "node:assert/strict";
import { GAUNTLET_CATALOG_KINDS, inspectGauntletCatalogs } from "./gauntlet-catalog-acceptance";

const values = GAUNTLET_CATALOG_KINDS.map((kind, index) => ({ kind, companyId: 71, code: `${kind}-${index + 1}`, label: `Synthetic ${kind}`, active: true }));
const consumers = {
  client: ["job_intake", "directory"], company: ["directory", "rfi", "submittal"], document_type: ["files", "reports"],
  discipline: ["job_intake", "files", "schedule"], location: ["job_intake", "files", "schedule"], level: ["job_intake", "files", "schedule"],
  zone: ["files", "schedule"], system: ["files", "schedule"], status: ["workflow", "reports"], role: ["team", "workflow"],
  workflow: ["job_intake", "operations"], delivery: ["job_intake", "operations"], apu_library: ["job_intake", "commercial"],
} as const;
const accepted = inspectGauntletCatalogs({ companyId: 71, values, consumers });
assert.equal(accepted.ready, true);
assert.deepEqual(accepted.missingKinds, []);
assert.deepEqual(accepted.missingConsumers, []);
assert.throws(() => inspectGauntletCatalogs({ companyId: 71, values: values.map((value, i) => i === 0 ? { ...value, companyId: 72 } : value), consumers }), /COMPANY_LEAK/);
assert.throws(() => inspectGauntletCatalogs({ companyId: 71, values: [...values, values[0]], consumers }), /DUPLICATE/);
assert.deepEqual(inspectGauntletCatalogs({ companyId: 71, values: values.filter(value => value.kind !== "level"), consumers }).missingKinds, ["level"]);
assert.deepEqual(inspectGauntletCatalogs({ companyId: 71, values, consumers: { ...consumers, rfi: [] } as any }).ready, true);
assert.equal(inspectGauntletCatalogs({ companyId: 71, values, consumers: { ...consumers, company: ["directory"] } }).ready, false);
console.log("B-GA012 company-scoped catalog completeness and downstream-consumer contract: PASS");
