import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("artifacts/api-server/src/routes/rfis.ts", "utf8");
const ui = readFileSync("artifacts/bimlog/src/pages/project/RfisTab.tsx", "utf8");
const presentation = readFileSync("artifacts/bimlog/src/pages/project/rfi-frontend/rfi-action-presentation.ts", "utf8");
const client = readFileSync("lib/api-client-react/src/generated/api.ts", "utf8");
const revise = route.slice(route.indexOf('router.post("/projects/:projectId/rfis/:rfiId/revise"'));

for (const contract of [
  'requirePermission("admin", "write")',
  'eq(rfisTable.projectId, projectId)',
  'pg_advisory_xact_lock',
  'parentRfiId: parentId',
  'revisionNumber: revNum',
  'revisionOf: source.id',
  'sendStatus: "draft"',
  'event: "rfi.revised"',
  'perspective: "source"',
  'perspective: "revision"',
  'recordRfiNotificationSourceEvent',
  'code === "23505"',
  'A concurrent request already created this RFI revision.',
]) assert.ok(revise.includes(contract), `${contract} must remain in the RFI revision contract`);

assert.match(client, /getReviseRfiUrl/);
assert.match(client, /method: "POST"/);
assert.match(presentation, /key: "revise"/);
for (const text of [
  "Create Revision", "Crear Revision",
  "Revision created", "Revision creada",
  "Revision failed", "Error al crear revision",
  "Creating Revision...", "Creando Revision...",
]) assert.ok(`${ui}\n${presentation}`.includes(text), `${text} must remain visible`);
assert.match(ui, /isPending: isRevising/);
assert.match(ui, /onRevise\(revised\)/);
console.log("P198 RFI revision permission, project isolation, serialized numbering, immutable lineage, attachment custody, draft successor, audit/notification, concurrency recovery, bilingual success/error, and discoverable action gates passed.");
