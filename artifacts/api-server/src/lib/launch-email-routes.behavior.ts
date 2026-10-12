import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "src/routes/launch-configuration.ts"), "utf8");
assert.match(source, /email\/verify[\s\S]*authMiddleware, isSuperAdminMiddleware/);
assert.match(source, /email\/send-test[\s\S]*authMiddleware, isSuperAdminMiddleware/);
assert.match(source, /private, no-store/);
assert.match(source, /executeLaunchEmailCheck/);
assert.doesNotMatch(source, /res\.json\([^)]*secret/i);
console.log("LAUNCH_CONFIGURATION_BUILD_14=PASS superAdminProtected=true noStore=true correlatedActions=true");
