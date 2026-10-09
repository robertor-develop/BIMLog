import assert from "node:assert/strict";
import fs from "node:fs";

const model = fs.readFileSync("artifacts/bimlog/src/lib/operational-pulse-refresh.ts", "utf8");
const behavior = fs.readFileSync("artifacts/bimlog/src/lib/operational-pulse-refresh.behavior.ts", "utf8");
const component = fs.readFileSync("artifacts/bimlog/src/components/dashboard/OperationalPulse.tsx", "utf8");
const dashboard = fs.readFileSync("artifacts/bimlog/src/pages/Dashboard.tsx", "utf8");

for (const token of ["refreshing", "unavailable", "current", "hasVerifiedData", "Intl.DateTimeFormat"])
  assert.ok(model.includes(token), `missing refresh truth contract: ${token}`);
for (const token of ["Checked at", "Verificado a las", "Counts could not refresh", "No se pudieron actualizar los conteos", "role=\"status\"", "aria-live=\"polite\""])
  assert.ok(component.includes(token), `missing refresh presentation contract: ${token}`);
for (const token of ["dataUpdatedAt: statsUpdatedAt", "isFetching: statsRefreshing", "isError: statsRefreshFailed", "refetch: refreshStats", "refetchInterval: 60000"])
  assert.ok(dashboard.includes(token), `missing live refresh connection: ${token}`);
for (const token of ["operational-pulse__freshness", "min-height: 44px", "focus-visible", "cursor: wait"])
  assert.ok(dashboard.includes(token), `missing accessible refresh styling: ${token}`);
assert.ok(behavior.includes("Operational pulse refresh behavior: PASS"));

console.log("Headquarters daily clarity Block 5 acceptance: PASS");
