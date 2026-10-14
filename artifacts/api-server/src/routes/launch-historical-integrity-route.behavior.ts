import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./launch-configuration.ts", import.meta.url), "utf8");
assert.match(source, /router\.get\("\/admin\/launch-configuration\/:environment", authMiddleware, isSuperAdminMiddleware/);
assert.match(source, /const historicalIntegrity = inspectLaunchHistoricalIntegrity\(\)/);
assert.match(source, /res\.json\(\{[^}]*historicalIntegrity[^}]*\}\)/);
assert.match(source, /Cache-Control", "private, no-store, max-age=0"/);
console.log("PASS protected historical-integrity projection route (4 checks)");
