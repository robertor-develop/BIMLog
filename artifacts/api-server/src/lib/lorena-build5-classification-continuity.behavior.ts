import assert from "node:assert/strict";
import fs from "node:fs";

const intake = fs.readFileSync(new URL("./job-intake-service.ts", import.meta.url), "utf8");
const operations = fs.readFileSync(new URL("./job-operations-service.ts", import.meta.url), "utf8");

assert.match(intake, /workflow-phase:[\s\S]*?item\.classification\.disciplineId[\s\S]*?item\.classification\.serviceId[\s\S]*?phase\.id/);
assert.match(intake, /job_activation_work_packages\([\s\S]*?discipline_id[\s\S]*?service_id[\s\S]*?phase_id[\s\S]*?item\.classification\.disciplineId[\s\S]*?item\.classification\.serviceId[\s\S]*?phase\.id/);
assert.match(operations, /scopeClassificationByWorkItemId/);
assert.match(operations, /row\.disciplineId \|\| fallback\.disciplineId/);
assert.match(operations, /row\.serviceId \|\| fallback\.serviceId/);
assert.match(operations, /const safeTasks = tasks\.rows\.map\(\(sourceRow\)[\s\S]*?withScopeClassification\(sourceRow\)/);
assert.match(operations, /const safePackages = packages\.rows\.map\(\(sourceRow\)[\s\S]*?withScopeClassification\(sourceRow\)/);
assert.doesNotMatch(operations, /phaseId: row\.phaseId \|\| fallback\.phaseId/, "phase identity must remain the activated phase, never an item fallback");

console.log("Lorena Build 5 classification continuity: PASS (8 checks)");
