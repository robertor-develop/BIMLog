import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../../../bimlog/src/pages/HelpCenter.tsx", import.meta.url), "utf8");
const content = fs.readFileSync(new URL("../../../bimlog/src/lib/help-content.ts", import.meta.url), "utf8");
for (const phrase of ["Help Center", "Centro de ayuda", "User Manual", "Manual del usuario", "Quick Guides", "Guías rápidas", "Troubleshooting", "Solución de problemas"]) assert.ok(page.includes(phrase));
for (const field of ["permissions", "validationRules", "auditTrail", "boundaries", "relatedWorkspaces", "outputs"]) assert.match(content, new RegExp(field));
assert.match(content, /Save needs attention/);
assert.match(page, /HELP_RELEASE_VERSION = "v1\.05\.N17-P18"/);
console.log("POST-P17 Build 19 bilingual Help/audit discoverability: PASS");
