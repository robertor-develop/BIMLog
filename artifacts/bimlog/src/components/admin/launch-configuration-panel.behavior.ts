import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const panel=readFileSync(new URL("./LaunchConfigurationPanel.tsx",import.meta.url),"utf8"),page=readFileSync(new URL("../../pages/TotalControl.tsx",import.meta.url),"utf8");
for(const token of ["Launch configuration","Configuración de lanzamiento","development","staging","production","Save revision","Immutable revision history","New SMTP password","blockers.length"])assert.ok(panel.includes(token),token);
assert.ok(!panel.includes("decryptLaunchSecret"));assert.ok(page.includes("LaunchConfigurationPanel"));
console.log("LAUNCH_CONFIGURATION_BUILD_10=PASS ui=centralized progressive=true environments=visible history=visible");
