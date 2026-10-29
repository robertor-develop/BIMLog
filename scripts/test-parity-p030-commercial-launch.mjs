import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = fs.readFileSync(path.join(root, "artifacts/bimlog/src/lib/capability-directory.ts"), "utf8");
const control = fs.readFileSync(path.join(root, "artifacts/bimlog/src/pages/TotalControl.tsx"), "utf8");
const panel = fs.readFileSync(path.join(root, "artifacts/bimlog/src/components/admin/CommercialLaunchPanel.tsx"), "utf8");
const route = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/commercial-workspace.ts"), "utf8");

assert.match(directory, /id: "commercial-launch"[\s\S]*href: "\/total-control\?tab=commercial-launch"[\s\S]*audience: "total_control"/);
assert.equal((directory.match(/id: "commercial-launch"/g) || []).length, 1);
assert.match(directory, /"commercial-launch": standardGuidance/);
assert.match(control, /requested === "commercial-launch"\) setActiveTab\(7\)/);
assert.match(control, /i === 7\) url\.searchParams\.set\("tab", "commercial-launch"\)/);
assert.match(control, /activeTab === 7 && token && <CommercialLaunchPanel/);
assert.match(panel, /Verify live services/);
assert.match(panel, /disabled=\{!data\?\.ready\|\|verifying\}/);
assert.match(panel, /role="status"/);
assert.match(panel, /role="alert"/);
assert.match(panel, /Retry status load/);
assert.match(panel, /Verification history/);
assert.match(panel, /Current authorization/);
assert.match(panel, /sourceCommit/);
assert.match(route, /router\.post\("\/admin\/commercial-launch\/verify",authMiddleware,isSuperAdminMiddleware/);

console.log("PARITY_P030_COMMERCIAL_LAUNCH=PASS directEntry=1 evidenceHistory=1");
