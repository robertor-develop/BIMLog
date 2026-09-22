import assert from "node:assert/strict";
import fs from "node:fs";
import { classificationColumn, normalizeCompanyCatalogUsage } from "./company-master-catalog-usage";

assert.equal(classificationColumn("client"), null);
assert.equal(classificationColumn("discipline"), "discipline_id");
assert.equal(classificationColumn("service"), "service_id");
assert.equal(classificationColumn("phase"), "phase_id");
assert.deepEqual(normalizeCompanyCatalogUsage({ intakeCount: "2", taskCount: 3, workPackageCount: 4 }), {
  intakeCount: 2,
  taskCount: 3,
  workPackageCount: 4,
  totalCount: 9,
});
assert.deepEqual(normalizeCompanyCatalogUsage({ intakeCount: -1, taskCount: "bad" }), {
  intakeCount: 0,
  taskCount: 0,
  workPackageCount: 0,
  totalCount: 0,
});

const route = fs.readFileSync(new URL("../routes/company-master-catalogs.ts", import.meta.url), "utf8");
assert.match(route, /master-catalogs\/:kind\/:id\/usage/);
assert.match(route, /entry\.company_id=\$2/);
assert.match(route, /ji\.company_id=\$2/);
assert.match(route, /job_activation_tasks/);
assert.match(route, /job_activation_work_packages/);
assert.doesNotMatch(route, /DELETE FROM company_master_catalog_entries/i);

console.log("EDT_ENGINE_BUILD283_RESULT=PASS");
