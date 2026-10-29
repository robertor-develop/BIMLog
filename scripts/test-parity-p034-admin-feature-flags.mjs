import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("artifacts/bimlog/src/pages/AdminPanel.tsx");
const routes = read("artifacts/api-server/src/routes/admin.ts");

assert.match(panel, /\/admin\/feature-flags\?scope=mine/);
assert.match(panel, /Feature Flags shows the governed legacy projection/);
assert.match(panel, /Loading governed feature flags/);
assert.match(panel, /No feature flags are available in this administered scope/);
assert.match(panel, /disabled=\{!isSuperAdmin \|\| savingId !== null\}/);
assert.match(panel, /aria-pressed=\{Boolean\(f\.enabled\)\}/);
assert.match(panel, /Feature flag updated and the governed projection was refreshed/);
assert.match(routes, /router\.get\("\/admin\/feature-flags"/);
assert.match(routes, /router\.patch\("\/admin\/feature-flags\/:id", isSuperAdminMiddleware/);
assert.match(routes, /action: "toggle_legacy_feature_flag"/);
assert.match(routes, /operationalCapabilityProven: false/);

console.log("P034 governed feature flags parity checks passed");
