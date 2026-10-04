import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("./commercial-workspace.ts",import.meta.url),"utf8");
assert.match(source,/router\.get\("\/admin\/commercial-launch",authMiddleware,isSuperAdminMiddleware/);
assert.match(source,/deriveCommercialLaunchActivation\(process\.env\)/);
assert.match(source,/Cache-Control","private, no-store, max-age=0/);
assert.match(source,/Vary","Authorization/);
assert.doesNotMatch(source,/res\.json\([^\n]*(STRIPE_SECRET_KEY|SENDGRID_API_KEY)/);
console.log("B252 protected commercial launch activation endpoint: PASS");
