import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const directory = fs.readFileSync(path.join(root, "artifacts/bimlog/src/lib/capability-directory.ts"), "utf8");
const panel = fs.readFileSync(path.join(root, "artifacts/bimlog/src/pages/AdminPanel.tsx"), "utf8");
const backend = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/admin.ts"), "utf8");

assert.match(directory, /id: "audit-activity"[\s\S]*href: "\/admin\?tab=audit-activity"[\s\S]*audience: "project_administration"/);
assert.equal((directory.match(/id: "audit-activity"/g) || []).length, 1, "audit capability must be unique");
assert.match(directory, /"audit-activity": standardGuidance/);
assert.match(panel, /requested === "audit-activity"\) setActiveTab\(5\)/);
assert.match(panel, /i === 5\) url\.searchParams\.set\("tab", "audit-activity"\)/);
assert.match(panel, /Project Activity records operational events/);
assert.match(panel, /Admin Log is the immutable evidence trail/);
assert.match(panel, /role="status"[\s\S]*Loading project activity/);
assert.match(panel, /role="alert"[\s\S]*Unable to load project activity/);
assert.match(panel, /No project activity is recorded/);
assert.match(panel, /Loading admin actions/);
assert.match(panel, /Unable to load the admin action log/);
assert.match(panel, /No admin actions recorded yet/);
assert.match(panel, /activeTab === 5 && <ActivityFeedTab/);
assert.match(panel, /activeTab === 7 && <AdminActionsLogTab/);
assert.match(backend, /\/actions-log/);
assert.match(backend, /\/activity/);

console.log("PARITY_P029_ADMIN_AUDIT_ACTIVITY=PASS distinctTrails=2 directEntry=1");
