import assert from "node:assert/strict";
import fs from "node:fs";
const service = fs.readFileSync(new URL("./job-operations-service.ts", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("../../../bimlog/src/pages/JobOperationsWorkspace.tsx", import.meta.url), "utf8");
for (const field of ["snapshotFingerprint", "pricingSnapshot", "stableLineId", "apuPlanVersion", "quantity", "unitRate", "contractValue"]) assert.match(service + ui, new RegExp(field));
assert.match(ui, /Immutable APU history/);
assert.match(ui, /String\(snapshot\.snapshotFingerprint\)\.slice\(0,12\)/);
console.log("POST-P17 Build 17 immutable APU history/provenance: PASS");
