import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../routes/change_orders.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../../../bimlog/src/pages/project/ChangeOrdersTab.tsx", import.meta.url), "utf8");

const checks = [
  ["list requires project membership", api, /change-orders", authMiddleware, requireProjectMember\(\)/],
  ["create requires write permission", api, /router\.post\("\/projects\/:projectId\/change-orders", authMiddleware, requirePermission\("admin", "write"\)/],
  ["list excludes deleted records in current project", api, /eq\(changeOrdersTable\.projectId, projectId\), isNull\(changeOrdersTable\.deletedAt\)/],
  ["detail binds authoritative record to project", api, /eq\(changeOrdersTable\.id, coId\), eq\(changeOrdersTable\.projectId, projectId\)/],
  ["update binds authoritative record to project", api, /eq\(changeOrdersTable\.id, coId\), eq\(changeOrdersTable\.projectId, projectId\)\)\)\.returning/],
  ["delete binds authoritative record to project", api, /eq\(changeOrdersTable\.id, changeOrderId\), eq\(changeOrdersTable\.projectId, projectId\)/],
  ["UI list is current-project bound", ui, /`\$\{API\}\/projects\/\$\{projectId\}\/change-orders`/],
  ["UI actions retain project and record identity", ui, /`\$\{API\}\/projects\/\$\{projectId\}\/change-orders\/\$\{id\}\/\$\{act\}`/],
];

for (const [label, source, pattern] of checks) assert.match(source, pattern, label);
console.log(`PASS post-P17 Build 41 Change Order identity and scope (${checks.length} checks)`);
