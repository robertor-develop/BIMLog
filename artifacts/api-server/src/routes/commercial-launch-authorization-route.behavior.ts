import assert from "node:assert/strict";
import fs from "node:fs";

const source=fs.readFileSync(new URL("./commercial-workspace.ts",import.meta.url),"utf8");
assert.match(source,/router\.get\("\/admin\/commercial-launch\/authorization",authMiddleware,isSuperAdminMiddleware/);
assert.match(source,/readLatestCommercialLaunchVerification\(pool\)/);
assert.match(source,/resolveReleaseMetadata\(process\.env\)\.sourceCommit/);
assert.match(source,/deriveCommercialLaunchAuthorization/);
assert.match(source,/COMMERCIAL_LAUNCH_AUTHORIZATION_UNAVAILABLE/);
console.log("B278 protected canonical commercial launch authorization route: PASS");
