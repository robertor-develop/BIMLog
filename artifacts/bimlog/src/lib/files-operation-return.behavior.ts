import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canonicalDocumentLauncher, parseOperationalDocumentReturn } from "./job-operations-daily-work";

const launch = canonicalDocumentLauncher(18, "floor-7-shop-drawings", "file_revision");
const context = parseOperationalDocumentReturn(new URL(launch, "https://bimlog.app").search, 18);
assert.deepEqual(context, { taskId: "floor-7-shop-drawings", returnTo: "/projects/18/operations?taskId=floor-7-shop-drawings" });

const source = readFileSync(new URL("../pages/project/FilesTab.tsx", import.meta.url), "utf8");
assert.match(source, /Return to selected task/);
assert.match(source, /parseOperationalDocumentReturn\(search, projectId\)/);
console.log("Files preserves the exact Operations task return: PASS");
