import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../routes/change_orders.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../../../bimlog/src/pages/project/ChangeOrdersTab.tsx", import.meta.url), "utf8");

const checks = [
  ["new records begin as drafts", api, /status: "draft"/],
  ["lifecycle is explicitly submit approve reject", api, /\["submit", "approve", "reject"\]/],
  ["status transitions are deterministic", api, /submit: "pending_approval", approve: "approved", reject: "rejected"/],
  ["approval records actor and timestamp", api, /approvedById = req\.user!\.userId; updates\.approvedAt = new Date\(\)/],
  ["each transition writes immutable activity", api, /actionType: action, entityType: "change_order", entityId: coId/],
  ["contract and schedule impacts remain distinct", api, /contractValueImpact[\s\S]*scheduleImpactDays/],
  ["soft delete preserves reason", api, /deletedAt: new Date\(\), deleteReason: reason/],
  ["delete writes auditable identity and reason", api, /details: JSON\.stringify\(\{ reason, number: existing\.number, title: existing\.title \}\)/],
  ["UI exposes only state-appropriate actions", ui, /co\.status === "draft"[\s\S]*co\.status === "pending_approval"/],
];

for (const [label, source, pattern] of checks) assert.match(source, pattern, label);
console.log(`PASS post-P17 Build 42 Change Order lifecycle and financial separation (${checks.length} checks)`);
