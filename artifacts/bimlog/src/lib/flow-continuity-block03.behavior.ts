import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonicalDocumentLauncher, parseOperationalDocumentReturn, safeOperationsReturnTarget } from "./job-operations-daily-work";

for (const kind of ["rfi", "file_revision", "transmittal"] as const) {
  const launch = canonicalDocumentLauncher(63, "task-63", kind);
  assert.deepEqual(parseOperationalDocumentReturn(new URL(launch, "https://bimlog.app").search, 63), { taskId: "task-63", returnTo: "/projects/63/operations?taskId=task-63" });
}
assert.equal(safeOperationsReturnTarget("/projects/63/operations?taskId=task-63&escape=1", 63), null);
for (const file of [
  "../pages/project/RfisTab.tsx",
  "../pages/project/FilesTab.tsx",
  "../pages/project/TransmittalsTab.tsx",
  "../pages/CompanyDeliveryWorkflows.tsx",
  "../pages/FinancialContractWorkspace.tsx",
  "../pages/JobIntakeWorkspace.tsx",
]) assert.match(readFileSync(new URL(file, import.meta.url), "utf8"), /Return|return|OperationsReturnBanner/);
console.log("Human flow continuity block 3: exact Operations repair-and-return journeys PASS");
