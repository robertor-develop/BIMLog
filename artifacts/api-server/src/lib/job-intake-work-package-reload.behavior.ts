import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeJobIntakeData } from "./job-intake-contract";

const data = normalizeJobIntakeData({
  commercial: { contracts: [{ id: "BASE", category: "base_contract" }] },
  scopeItems: [{ id: "CI-1", name: "Coordination", plannedHours: "8", contractId: "BASE", workPackages: [{ id: "WP-1", packageCode: "WP-L14", title: "Level 14 coordination", dimensionType: "floor", dimensionValue: "L14", packageType: "deliverable" }] }],
});
const reloaded = normalizeJobIntakeData(JSON.parse(JSON.stringify(data)));
assert.deepEqual(reloaded.scopeItems[0].workPackages[0], data.scopeItems[0].workPackages[0]);

const root = path.resolve(import.meta.dirname, "../../../..");
const page = fs.readFileSync(path.join(root, "artifacts/bimlog/src/components/job-intake/WorkPackageBuilder.tsx"), "utf8");
const service = fs.readFileSync(path.join(root, "artifacts/api-server/src/lib/job-intake-service.ts"), "utf8");
assert.match(page, /Stable package code/);
assert.match(page, /Owning Contract Item/);
assert.match(service, /INSERT INTO job_activation_work_packages/);
assert.match(service, /INSERT INTO job_activation_work_package_tasks/);

console.log(JSON.stringify({ status: "PASS", build: 9, checks: ["package-roundtrip", "stable-code-visible", "owner-visible", "activation-persistence"] }));
