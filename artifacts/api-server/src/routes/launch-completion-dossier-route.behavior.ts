import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(fileURLToPath(new URL("./launch-configuration.ts", import.meta.url)), "utf8");
assert.match(source, /inspectLaunchCompletionDossier/);
assert.match(source, /pendingOwnerSteps: ownerInputChecklist\.pendingCount/);
assert.match(source, /ownerInputChecklist, completionDossier/);
assert.match(source, /authMiddleware, isSuperAdminMiddleware/);
assert.match(source, /private, no-store, max-age=0/);
console.log("PASS protected completion dossier route (5 checks)");
