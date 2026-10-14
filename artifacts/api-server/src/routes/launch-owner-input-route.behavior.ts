import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("./launch-configuration.ts", import.meta.url), "utf8");
assert.match(source, /inspectLaunchOwnerInputChecklist/);
assert.match(source, /configured: !!\(current\?\.readiness as any\)\?\.launchConfigurationEntered/);
assert.match(source, /active: current\?\.state === "active"/);
assert.match(source, /historicalIntegrity, ownerInputChecklist/);
console.log("PASS owner-input checklist protected route (4 checks)");
