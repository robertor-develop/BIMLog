import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../routes/submittals.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../../../bimlog/src/pages/project/SubmittalsTab.tsx", import.meta.url), "utf8");

const checks = [
  ["list requires project membership", api, /submittals", authMiddleware, requireProjectMember\(\)/],
  ["create requires project write permission", api, /router\.post\("\/projects\/:projectId\/submittals", authMiddleware, requirePermission\("admin", "write"\)/],
  ["project ID is schema parsed", api, /ListSubmittalsParams\.parse\(\{ projectId: req\.params\.projectId \}\)/],
  ["list excludes deleted rows in the project", api, /eq\(submittalsTable\.projectId, projectId\), isNull\(submittalsTable\.deletedAt\)/],
  ["update parses route project and submittal IDs", api, /UpdateSubmittalParams\.parse\(\{[\s\S]*projectId: req\.params\.projectId, submittalId: req\.params\.submittalId/],
  ["authoritative item lookup binds project and submittal", api, /eq\(submittalsTable\.id, submittalId\), eq\(submittalsTable\.projectId, projectId\)/],
  ["UI list query is project-bound", ui, /useListSubmittals\(projectId\)/],
  ["UI mutations use project and item IDs", ui, /`\/api\/v1\/projects\/\$\{projectId\}\/submittals\/\$\{deleteTarget\.id\}`/],
  ["linked items receive authoritative project and item IDs", ui, /<LinkedItemsPanel projectId=\{projectId\} entityType="submittal" entityId=\{submittal\.id\}/],
];

for (const [label, source, pattern] of checks) assert.match(source, pattern, label);
console.log(`PASS post-P17 Build 31 Submittal identity and project scope (${checks.length} checks)`);
