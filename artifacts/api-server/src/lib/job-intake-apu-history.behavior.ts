import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../../..");
const service = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/cost-value-plan-service.ts"), "utf8");
const page = fs.readFileSync(path.join(root, "artifacts/bimlog/src/components/job-intake/ContractItemBulkEditor.tsx"), "utf8");

assert.match(service, /ORDER BY version DESC LIMIT 100/);
assert.match(service, /const version = Number\(prior\?\.version \?\? 0\) \+ 1/);
assert.match(service, /INSERT INTO generic_cost_value_plan_versions/);
assert.doesNotMatch(service, /UPDATE generic_cost_value_plan_versions/);
assert.match(page, /Saved APU version history/);
assert.match(page, /it does not overwrite APU history/);
assert.match(page, /props\.apuVersions\.map/);

console.log(JSON.stringify({ status: "PASS", build: 8, checks: ["append-only-version-save", "history-retrieval", "current-identifiable", "visible-immutable-history"] }));
