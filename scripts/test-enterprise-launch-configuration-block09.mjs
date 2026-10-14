import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),"utf8");
const store=read("artifacts/api-server/src/lib/launch-configuration-store.ts"), restore=read("artifacts/api-server/src/lib/launch-configuration-restore.ts"), route=read("artifacts/api-server/src/routes/launch-configuration.ts"), panel=read("artifacts/bimlog/src/components/admin/LaunchConfigurationPanel.tsx");
assert.match(store,/readLaunchConfigurationVersion/); assert.match(restore,/current\?\.secretEnvelopes/); assert.doesNotMatch(restore,/historical\.secretEnvelopes\s*\?\?/);
assert.match(route,/LAUNCH_CONFIGURATION_RESTORE_INVALID/); assert.match(route,/sourceRevision >= expectedRevision/); assert.match(route,/action: "restored"/); assert.match(route,/private, no-store/);
for(const token of ["Restore as new revision","Restaurar como revisión nueva","never revives an old credential","ni recupera una credencial anterior"]) assert.ok(panel.includes(token),token);
console.log("Enterprise launch configuration Block 9 Builds 41-45: PASS");
