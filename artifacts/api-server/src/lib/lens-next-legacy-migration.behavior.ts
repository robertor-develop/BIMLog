import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../../..");
const route = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/clash_reports.ts"), "utf8");
const workingView = fs.readFileSync(path.join(root, "artifacts/bimlog/src/features/lens-next/lens-next-working-view.ts"), "utf8");
const panel = fs.readFileSync(path.join(root, "artifacts/bimlog/src/features/lens-next/LensNextPanel.tsx"), "utf8");

assert.match(route, /visual_state_identity_mismatch/);
assert.match(route, /validatePersistedLensNextVisualState/);
assert.match(route, /isNull\(lensViewpointsTable\.visualStateJson\)/);
assert.match(route, /isNull\(lensViewpointsTable\.visualStateDigest\)/);
assert.match(route, /legacy_visual_state_migrated/);
assert.match(route, /visual_state_already_present/);
assert.match(route, /current\?\.visualStateDigest === visualStateDigest && current\.visualStateJson === visualStateJson/);
assert.match(workingView, /A bounded migration reason is required/);
assert.match(panel, /repairBimlogWorkingViewFromCurrent\([^;]+reason\)/s);
assert.doesNotMatch(workingView, /delete|removeSaved|create.*duplicate/i);

console.log("PASS Lens Next historical migration is exact, atomic, idempotent, digest-verified, and preserve-first");
