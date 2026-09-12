import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const api = await readFile(new URL("../routes/change_orders.ts", import.meta.url), "utf8");
const rfiUi = await readFile(new URL("../../../bimlog/src/pages/project/RfisTab.tsx", import.meta.url), "utf8");
const linked = await readFile(new URL("../../../bimlog/src/components/LinkedItemsPanel.tsx", import.meta.url), "utf8");

const checks = [
  ["RFI promotion creates in its active project", rfiUi, /`\/api\/v1\/projects\/\$\{projectId\}\/change-orders`/],
  ["RFI promotion carries authoritative RFI ID", rfiUi, /linked_rfi_ids: \[rfi\.id\]/],
  ["detail resolves stored RFI and Submittal identities", api, /linkedRfiIds[\s\S]*linkedSubIds[\s\S]*linkedRfis: rfis, linkedSubmittals: subs/],
  ["delete cleans document relationships only", api, /db\.delete\(changeOrderDocumentsTable\).*changeOrderId/s],
  ["generic links are cleaned in current project", api, /eq\(linkedItemsTable\.projectId, projectId\)[\s\S]*fromType, "change_order"[\s\S]*toType, "change_order"/],
  ["authoritative RFIs and Submittals are never deleted", api, /db\.delete\((?:rfisTable|submittalsTable)\)/, true],
  ["import requires write permission and bounded upload", api, /change-orders\/import"[\s\S]*requirePermission\("admin", "write"\)[\s\S]*fileSize: 50 \* 1024 \* 1024/],
  ["duplicate imported numbers receive deterministic DRF identity", api, /-DRF-\$\{String\(i\)\.padStart\(3,"0"\)\}/],
  ["imported records remain project-bound", api, /await db\.insert\(changeOrdersTable\)\.values\(\{\s*projectId,/],
  ["linked-item candidates remain current-project sourced", linked, /fetch\(`\$\{API\}\/projects\/\$\{projectId\}\/change-orders`/],
];

for (const [label, source, pattern, absent] of checks) {
  if (absent) assert.doesNotMatch(source, pattern, label);
  else assert.match(source, pattern, label);
}
console.log(`PASS post-P17 Build 43 Change Order links and import isolation (${checks.length} checks)`);
