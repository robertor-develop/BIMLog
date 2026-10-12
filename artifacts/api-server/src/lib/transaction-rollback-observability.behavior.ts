import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = [
  "connector-validation-operations-postgres-store.ts",
  "coordination-hub-configuration-postgres-store.ts",
  "coordination-hub-postgres-store.ts",
  "cost-value-forecast-service.ts",
  "cost-value-performance-service.ts",
  "cost-value-plan-service.ts",
];

for (const file of files) {
  const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
  assert.match(source, /rollbackWithOperationalEvidence/);
  assert.doesNotMatch(source, /query\("ROLLBACK"\)\.catch\(\(\) => undefined\)/);
}

console.log("BIMLog transaction rollback observability: PASS");
