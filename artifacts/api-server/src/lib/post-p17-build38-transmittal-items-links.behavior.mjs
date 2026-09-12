import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const api = await readFile(new URL("../routes/transmittals.ts", import.meta.url), "utf8");
const links = await readFile(new URL("./job-operations-service.ts", import.meta.url), "utf8");
const checks = [
  ["create persists explicit file/item references", /body\.items\.map\(i => \(\{ transmittalId: tx\.id, fileId: i\.file_id \?\? null, description: i\.description \?\? null, revision: i\.revision \?\? null \}\)\)/],
  ["detail returns authoritative items", /transmittalItemsTable\.transmittalId, txId[\s\S]*res\.json\(\{ \.\.\.tx, items \}\)/],
  ["delete removes transmittal items only", /db\.delete\(transmittalItemsTable\)\.where\(eq\(transmittalItemsTable\.transmittalId, transmittalId\)\)/],
  ["linked cleanup remains project scoped", /db\.delete\(linkedItemsTable\)\.where\(and\([\s\S]*eq\(linkedItemsTable\.projectId, projectId\)/],
  ["linked cleanup covers both directions", /fromType, "transmittal"[\s\S]*toType, "transmittal"/],
];
for (const [label, pattern] of checks) assert.match(api, pattern, label);
assert.match(links, /DELETE FROM job_activation_document_connections WHERE id=\$1 AND project_id=\$2/);
assert.match(links, /FROM transmittals WHERE id=\$1 AND project_id=\$2 AND deleted_at IS NULL/);
console.log("PASS post-P17 Build 38 Transmittal items and link isolation (7 checks)");
