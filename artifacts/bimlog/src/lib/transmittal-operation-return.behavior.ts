import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonicalDocumentLauncher, parseOperationalDocumentReturn } from "./job-operations-daily-work";

const launch = canonicalDocumentLauncher(22, "coordination-04", "transmittal");
assert.deepEqual(parseOperationalDocumentReturn(new URL(launch, "https://bimlog.app").search, 22), {
  taskId: "coordination-04",
  returnTo: "/projects/22/operations?taskId=coordination-04",
});
const source = readFileSync(new URL("../pages/project/TransmittalsTab.tsx", import.meta.url), "utf8");
assert.match(source, /Transmittal for the selected Operations task/);
assert.match(source, /operationReturn\.returnTo/);
console.log("Transmittal preserves the exact Operations task return: PASS");
