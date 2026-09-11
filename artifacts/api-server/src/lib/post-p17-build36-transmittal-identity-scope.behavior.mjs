import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const api = await readFile(new URL("../routes/transmittals.ts", import.meta.url), "utf8");
const ui = await readFile(new URL("../../../bimlog/src/pages/project/TransmittalsTab.tsx", import.meta.url), "utf8");
const checks = [
  ["list membership", /router\.get\("\/projects\/:projectId\/transmittals", authMiddleware, requireProjectMember\(\)/],
  ["create write authority", /router\.post\("\/projects\/:projectId\/transmittals", authMiddleware, requirePermission\("admin", "write"\)/],
  ["project-scoped active list", /eq\(transmittalsTable\.projectId, projectId\), isNull\(transmittalsTable\.deletedAt\)/],
  ["detail membership", /router\.get\("\/projects\/:projectId\/transmittals\/:transmittalId", authMiddleware, requireProjectMember\(\)/],
  ["detail identity binds project", /eq\(transmittalsTable\.id, txId\), eq\(transmittalsTable\.projectId, projectId\)/],
  ["update write authority", /router\.patch\("\/projects\/:projectId\/transmittals\/:transmittalId", authMiddleware, requirePermission\("admin", "write"\)/],
];
for (const [label, pattern] of checks) assert.match(api, pattern, label);
assert.match(ui, /fetch\(`\$\{API\}\/projects\/\$\{projectId\}\/transmittals`/);
assert.match(ui, /parseExactTransmittalDeepLink/);
console.log("PASS post-P17 Build 36 Transmittal identity and scope (8 checks)");
