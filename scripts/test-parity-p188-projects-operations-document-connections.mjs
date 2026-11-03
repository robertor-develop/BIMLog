import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const route = readFileSync("artifacts/api-server/src/routes/job-operations.ts", "utf8");
const service = readFileSync("artifacts/api-server/src/lib/job-operations-service.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/JobOperationsWorkspace.tsx", "utf8");
for (const identity of [
  'post("/projects/:projectId/operations/document-connections"',
  'delete("/projects/:projectId/operations/document-connections/:connectionId"',
]) assert.ok(route.toLowerCase().includes(identity.toLowerCase()), `${identity} must remain routed`);
for (const contract of [/canonicalDocumentEntity\(client, projectId/, /JOB_OPERATIONS_DOCUMENT_CONNECTION_ID_CONFLICT/, /JOB_OPERATIONS_DOCUMENT_TARGET_STALE/, /JOB_OPERATIONS_DOCUMENT_CONNECTION_CONFLICT/, /eventType: "document_connection_linked"/, /eventType: "document_connection_unlinked"/]) assert.match(service, contract);
for (const text of ["Document connections", "Conexiones de documentos", "No canonical documents are available to link", "No hay documentos canónicos disponibles para vincular", "The canonical document will not be deleted or changed", "El documento canónico no se eliminará ni cambiará"]) assert.match(ui, new RegExp(text));
assert.match(ui, /selectedAlreadyLinked/);
assert.match(ui, /current permission does not allow this document connection change/);
assert.match(ui, /Canonical record unavailable/);

const tsx = "artifacts/api-server/node_modules/tsx/dist/cli.mjs";
for (const test of [
  "artifacts/api-server/src/lib/job-document-connections.behavior.ts",
  "artifacts/api-server/src/lib/job-operations.behavior.ts",
]) {
  const result = spawnSync(process.execPath, [tsx, test], { stdio: "inherit", env: { ...process.env, PROD_DATABASE_URL: process.env.PROD_DATABASE_URL ?? "postgresql://bimlog_test:bimlog_test@127.0.0.1:55439/bimlog_rfi_test" }, windowsHide: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("P188 document connection create/remove, canonical identity, authorization, isolation, idempotency, stale recovery, localization, and evidence gates passed.");
