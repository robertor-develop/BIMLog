import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const route = readFileSync(fileURLToPath(new URL("../routes/launch-configuration.ts", import.meta.url)), "utf8");
const panel = readFileSync(fileURLToPath(new URL("../../../bimlog/src/components/admin/LaunchConfigurationPanel.tsx", import.meta.url)), "utf8");
for (const token of ["readLatestLaunchEmailVerification", "LAUNCH_EMAIL_NOT_VERIFIED", '["verified", "sent"]', "target === \"production\""]) assert.ok(route.includes(token), token);
for (const token of ["emailVerification", "Latest check", "Última verificación", "Production activation requires"]) assert.ok(panel.includes(token), token);
console.log("launch email activation evidence: PASS");
