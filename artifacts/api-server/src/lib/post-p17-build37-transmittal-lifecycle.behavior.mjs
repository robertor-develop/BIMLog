import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const api = await readFile(new URL("../routes/transmittals.ts", import.meta.url), "utf8");
const checks = [
  ["new records begin as drafts", /status: "draft"/],
  ["send requires write permission", /transmittalId\/send", authMiddleware, requirePermission\("admin", "write"\)/],
  ["send binds current project record", /send[\s\S]*eq\(transmittalsTable\.id, txId\), eq\(transmittalsTable\.projectId, projectId\)/],
  ["send records state and timestamp", /status: "sent", sentAt, updatedAt: new Date\(\)/],
  ["send creates audit history", /actionType: "send", entityType: "transmittal"/],
  ["acknowledge is project scoped", /status: "acknowledged", acknowledgedAt: new Date\(\)[\s\S]*eq\(transmittalsTable\.id, txId\), eq\(transmittalsTable\.projectId, projectId\)/],
  ["delete is reason-bearing soft deletion", /set\(\{ deletedAt: new Date\(\), deleteReason: reason \}\)/],
  ["delete is audited", /actionType: "delete", entityType: "transmittal"[\s\S]*JSON\.stringify\(\{ reason, number: existing\.number, title: existing\.title \}\)/],
];
for (const [label, pattern] of checks) assert.match(api, pattern, label);
console.log(`PASS post-P17 Build 37 Transmittal lifecycle (${checks.length} checks)`);
