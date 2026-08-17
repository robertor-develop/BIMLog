import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalDocumentConnectionId, currentDocumentConnectionCanRemove, presentDocumentConnection, presentDocumentConnectionListView, presentDocumentConnectionOptionView } from "./job-operations-service";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => fs.readFileSync(path.resolve(here, relative), "utf8");
const migration = read("./job-intake-migration.ts");
const service = read("./job-operations-service.ts");
const routes = read("../routes/job-operations.ts");
const projectDetail = read("../../../bimlog/src/pages/ProjectDetail.tsx");
const rfiTab = read("../../../bimlog/src/pages/project/RfisTab.tsx");
const filesTab = read("../../../bimlog/src/pages/project/FilesTab.tsx");
const transmittalsTab = read("../../../bimlog/src/pages/project/TransmittalsTab.tsx");
const schema = read("../../../../lib/db/src/schema/job-intakes.ts");

assert.doesNotMatch(migration, /\b(?:DROP|TRUNCATE)\b|\bDELETE\s+FROM\b/i, "document-connections migration must remain additive");
assert.match(migration, /CREATE TABLE IF NOT EXISTS job_activation_document_connections/);
assert.match(schema, /pgTable\("job_activation_document_connections"/);
for (const definition of [
  "target_type IN('task','work_package')",
  "entity_type IN('rfi','file_revision','transmittal')",
  "id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'",
  "entity_id>0",
  "octet_length(note)<=500",
]) assert.ok(migration.includes(definition), `missing startup definition: ${definition}`);
assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS job_activation_document_connection_target_entity_uidx ON job_activation_document_connections\(project_id,target_type,target_id,entity_type,entity_id\)/);
assert.match(schema, /job_activation_document_connection_target_entity_uidx/);
assert.match(schema, /job_activation_document_connections_project_id_fkey/);
assert.match(schema, /job_activation_document_connections_linked_by_id_fkey/);

assert.match(service, /JOB_OPERATIONS_COMPANY_MISMATCH/, "operations scope must enforce the current company boundary");
assert.match(service, /DOCUMENT_TARGET_TYPES/);
assert.match(service, /DOCUMENT_ENTITY_TYPES/);
assert.match(service, /job_activation_document_connections/);
assert.match(service, /FROM rfis WHERE id=\$1 AND project_id=\$2 AND deleted_at IS NULL/);
assert.match(service, /FROM files WHERE id=\$1 AND project_id=\$2 AND COALESCE\(status,''\)<>'deleted'/);
assert.match(service, /FROM transmittals WHERE id=\$1 AND project_id=\$2 AND deleted_at IS NULL/);
assert.match(service, /ON CONFLICT DO NOTHING/, "the unique junction must provide concurrency-safe idempotency");
assert.match(service, /document_connection_linked/);
assert.match(service, /document_connection_unlinked/);
assert.match(service, /currentDocumentConnectionCanRemove/);
assert.match(service, /documentTargetAccess\(client, actorUserId, projectId, documentTargetType/);
assert.match(service, /\{ allowStale: true, access \}/);
assert.match(service, /documentConnections/);
assert.match(service, /documentConnectionMeta/);
assert.match(service, /documentConnectionOptions/);
assert.doesNotMatch(service, /linked_items|linkedItems/, "typed operations connections must not use the generic linked-items authority");
for (const field of ["entityIdentity", "displayCode", "title", "status", "version", "deepLink"]) assert.match(service, new RegExp(field));
const optionsSource = service.slice(service.indexOf("export function presentDocumentConnectionOptionView"), service.indexOf("async function documentConnectionRows"));
assert.match(optionsSource, /const options = \{\s*rfis:/);
assert.match(optionsSource, /fileRevisions:/);
assert.match(optionsSource, /transmittals:/);
assert.match(optionsSource, /parentFileId:/);
assert.match(service, /DOCUMENT_CONNECTION_OPTION_LIMIT = 200/);
assert.match(optionsSource, /ORDER BY lower\(number\),id LIMIT \$2/);
assert.match(optionsSource, /ORDER BY lower\(file_name\),version DESC,id LIMIT \$2/);
assert.match(optionsSource, /status: row\.status == null \? null : String\(row\.status\)/);
for (const group of ["rfis", "fileRevisions", "transmittals"]) assert.match(optionsSource, new RegExp(`${group}: \\{ total: totals\\.${group}, limited: totals\\.${group} > options\\.${group}\\.length, max: DOCUMENT_CONNECTION_OPTION_LIMIT \\}`));
assert.doesNotMatch(optionsSource, /capPerType|total: \{ \.\.\.total|any:/, "option metadata must match the exact UI parser contract");
assert.doesNotMatch(optionsSource, /entityIdentity|entityType|entityId/, "GET options must use the exact grouped canonical option shape");
const connectionListSource = service.slice(service.indexOf("async function documentConnectionList"), service.indexOf("export async function currentDocumentConnectionCanRemove"));
assert.match(connectionListSource, /WITH current_task_control AS/);
assert.match(connectionListSource, /LEFT JOIN job_activation_resource_assignments ra ON ra\.task_id=t\.id AND ra\.user_id=\$2/);
assert.match(connectionListSource, /current_package_control AS/);
assert.match(connectionListSource, /COUNT\(\*\) OVER\(\)::integer "connectionTotal"/);
assert.match(connectionListSource, /WHERE c\.project_id=\$1\s+ORDER BY c\.linked_at DESC,c\.id\s+LIMIT \$3/);
assert.match(service, /DOCUMENT_CONNECTION_LIST_LIMIT = 200/);
const getSource = service.slice(service.indexOf("export async function getJobOperations"), service.indexOf("export async function createJobBudgetBaseline"));
assert.match(getSource, /documentConnectionList\(pool, projectId, input\.actorUserId, access\.canManage\)/);
assert.doesNotMatch(getSource, /currentDocumentConnectionCanRemove/, "GET must not issue per-connection authorization queries");

assert.deepEqual(presentDocumentConnectionOptionView(7, {
  rfis: [{ id: 31, display_code: "RFI-031", title: "Confirm rated wall detail", status: null, version: 2 }],
  fileRevisions: [{ id: 44, display_code: "A101.pdf", title: "A101.pdf", status: "active", version: 3, parent_file_id: 40 }],
  transmittals: [{ id: 18, display_code: "TR-018", title: "Issued coordination set", status: "issued", version: null }],
}, { rfis: 201, fileRevisions: 1, transmittals: 1 }), {
  options: {
    rfis: [{ id: 31, displayCode: "RFI-031", title: "Confirm rated wall detail", status: null, version: 2, deepLink: "/projects/7/rfis?rfi=31" }],
    fileRevisions: [{ id: 44, displayCode: "A101.pdf", title: "A101.pdf", status: "active", version: 3, deepLink: "/projects/7/files?file=44", parentFileId: 40 }],
    transmittals: [{ id: 18, displayCode: "TR-018", title: "Issued coordination set", status: "issued", version: null, deepLink: "/projects/7/transmittals?transmittal=18" }],
  },
  meta: {
    rfis: { total: 201, limited: true, max: 200 },
    fileRevisions: { total: 1, limited: false, max: 200 },
    transmittals: { total: 1, limited: false, max: 200 },
  },
});

const validConnectionId = "11111111-1111-4111-8111-111111111111";
assert.equal(canonicalDocumentConnectionId(validConnectionId), validConnectionId);
assert.equal(canonicalDocumentConnectionId("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"), "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
for (const invalidConnectionId of [
  "--------",
  "aaaaaaaa-aaaa-0aaa-8aaa-aaaaaaaaaaaa",
  "aaaaaaaa-aaaa-6aaa-8aaa-aaaaaaaaaaaa",
  "aaaaaaaa-aaaa-4aaa-7aaa-aaaaaaaaaaaa",
  "aaaaaaaaaaaa4aaa8aaaaaaaaaaaaaaa",
  "{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa}",
  " aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa ",
]) assert.throws(
  () => canonicalDocumentConnectionId(invalidConnectionId),
  (error: unknown) => Boolean(error && typeof error === "object" && "status" in error && error.status === 400 && "code" in error && error.code === "JOB_OPERATIONS_ID_INVALID"),
  `invalid RFC 4122 connectionId must be rejected: ${invalidConnectionId}`,
);
assert.match(service, /RFC4122_UUID = \/\^\[0-9a-f\]\{8\}-/);

assert.match(projectDetail, /tab === "files"\s*&& <FilesTab/);
assert.match(projectDetail, /tab === "rfis"\s*&& <RfisTab/);
assert.match(projectDetail, /tab === "transmittals"\s*&& <TransmittalsTab/);
assert.match(rfiTab, /sp\.get\("rfi"\)/, "RFI deep link must be consumed by the existing exact-record panel");
assert.match(rfiTab, /\/rfis\/\$\{rfiId\}/);
assert.match(filesTab, /getAll\("file"\)/, "Files must consume the exact file-revision query key");
assert.match(filesTab, /revision\.id === exactFileDeepLink\.id/, "Files must resolve the canonical revision id rather than a family/page approximation");
assert.match(filesTab, /file-revision-\$\{exactFileTarget\.revision\.id\}/, "Files must open the exact resolved revision");
assert.match(transmittalsTab, /getAll\("transmittal"\)/, "Transmittals must consume the exact canonical query key");
assert.match(transmittalsTab, /item\.id === exactTransmittalDeepLink\.id/, "Transmittals must resolve the canonical entity id");
assert.match(transmittalsTab, /setSelected\(resolvedTransmittalTarget\)/, "Transmittals must open the exact resolved record");

const linkSource = service.slice(service.indexOf("export async function linkJobOperationDocumentConnection"));
assert.match(linkSource, /WHERE id=\$1 AND project_id=\$2 FOR UPDATE/);
assert.match(linkSource, /SELECT 1 FROM job_activation_document_connections WHERE id=\$1/);
assert.match(linkSource, /Connection ID is unavailable\./, "cross-project ID collisions must return a generic conflict");
assert.match(service, /JOB_OPERATIONS_DOCUMENT_TARGET_STALE/);
assert.match(linkSource, /if \(!target\.canControl\)/);
const unlinkSource = service.slice(service.indexOf("export async function unlinkJobOperationDocumentConnection"));
assert.match(unlinkSource, /DELETE FROM job_activation_document_connections WHERE id=\$1 AND project_id=\$2/);
assert.match(unlinkSource, /currentDocumentConnectionCanRemove/);
assert.doesNotMatch(unlinkSource, /Number\(row\.linked_by_id\) !== input\.actorUserId/, "historical link ownership must never authorize unlink after reassignment");
assert.doesNotMatch(unlinkSource, /canonicalDocumentEntity/, "missing canonical records must not prevent an authorized unlink");
assert.doesNotMatch(unlinkSource, /DELETE FROM (?:rfis|files|transmittals|job_activation_tasks|job_activation_work_packages)/, "DELETE must remove only the typed junction");
const controlsSource = service.slice(service.indexOf("async function projectControlsView"), service.indexOf("export async function getJobOperations"));
assert.doesNotMatch(controlsSource, /job_activation_document_connections/, "document links must not participate in progress or value calculations");

const presented = JSON.parse(JSON.stringify(presentDocumentConnection({
  id: validConnectionId,
  projectId: 7,
  targetType: "task",
  targetId: "22222222-2222-2222-2222-222222222222",
  entityType: "rfi",
  entityId: 31,
  canonicalId: 31,
  displayCode: "RFI-031",
  title: "Confirm rated wall detail",
  status: null,
  version: 2,
  note: "Required before coordination closeout",
  linkedById: 9,
  linkedAt: "2026-08-13T00:00:00.000Z",
}, true)));
assert.deepEqual(presented, {
  id: validConnectionId,
  projectId: 7,
  targetType: "task",
  targetId: "22222222-2222-2222-2222-222222222222",
  entityType: "rfi",
  entityId: 31,
  note: "Required before coordination closeout",
  linkedById: 9,
  linkedAt: "2026-08-13T00:00:00.000Z",
  canRemove: true,
  entity: {
    id: 31,
    entityType: "rfi",
    entityId: 31,
    entityIdentity: "rfi:31",
    available: true,
    stale: false,
    displayCode: "RFI-031",
    title: "Confirm rated wall detail",
    status: null,
    version: 2,
    deepLink: "/projects/7/rfis?rfi=31",
  },
});
assert.equal(presented.entity.id, presented.entity.entityId, "populated connection entity id must match entityId for the UI guard");

const listView = presentDocumentConnectionListView([
  { ...presented, canonicalId: 31, currentCanControl: false, connectionTotal: 250, entity: undefined },
  { ...presented, id: "77777777-7777-4777-8777-777777777777", canonicalId: 31, currentCanControl: true, connectionTotal: 250, entity: undefined },
], false);
assert.deepEqual(listView.meta, { total: 250, limited: true, max: 200 }, "GET must report a truthful bounded connection list");
assert.equal(listView.connections[0].canRemove, false);
assert.equal(listView.connections[1].canRemove, true);
assert.ok(presentDocumentConnectionListView([{ ...presented, canonicalId: 31, currentCanControl: false, connectionTotal: 1, entity: undefined }], true).connections[0].canRemove, "manager access must apply without per-row queries");

const reassignedRow = {
  id: validConnectionId,
  projectId: 7,
  targetType: "task",
  targetId: "22222222-2222-2222-2222-222222222222",
  entityType: "rfi",
  entityId: 31,
  canonicalId: 31,
  displayCode: "RFI-031",
  title: "Confirm rated wall detail",
  status: "open",
  version: 2,
  note: "",
  linkedById: 9,
  linkedAt: "2026-08-13T00:00:00.000Z",
};
assert.equal(presentDocumentConnection(reassignedRow, false).canRemove, false, "the historical linker is revoked after losing current target control");
assert.equal(presentDocumentConnection(reassignedRow, true).canRemove, true, "the newly assigned current target controller may remove");

const targetAccess = { canManage: false } as any;
const managerAccess = { canManage: true } as any;
const taskClient = (assigneeUserId: number, resourceUserIds: number[] = []) => ({
  query: async (sql: string, params: unknown[] = []) => {
    if (sql.includes("FROM job_activation_tasks t JOIN job_activation_work_items")) return { rows: [{ id: reassignedRow.targetId, work_item_id: "33333333-3333-4333-8333-333333333333", assignee_user_id: assigneeUserId, status: "in_progress", work_item_status: "active" }] };
    if (sql.includes("FROM job_activation_resource_assignments")) return { rows: resourceUserIds.includes(Number(params[1])) ? [{ allowed: 1 }] : [] };
    throw new Error(`unexpected task authorization query: ${sql}`);
  },
}) as any;
assert.equal(await currentDocumentConnectionCanRemove(taskClient(10), 9, 7, reassignedRow, targetAccess), false, "historical linker authority is revoked after task reassignment");
assert.equal(await currentDocumentConnectionCanRemove(taskClient(10), 10, 7, reassignedRow, targetAccess), true, "current task assignee authority is effective for GET and DELETE");
assert.equal(await currentDocumentConnectionCanRemove(taskClient(10, [11]), 11, 7, reassignedRow, targetAccess), true, "current task resource authority is effective for GET and DELETE");
assert.equal(await currentDocumentConnectionCanRemove(taskClient(10), 9, 7, reassignedRow, managerAccess), true, "current project manager authority is effective for GET and DELETE");

const packageTargetId = "44444444-4444-4444-8444-444444444444";
const packageClient = {
  query: async (sql: string) => {
    if (sql.includes("FROM job_activation_work_packages p JOIN job_activation_work_items")) return { rows: [{ id: packageTargetId, work_item_id: "33333333-3333-4333-8333-333333333333", responsible_user_id: 12, status: "internal_review", work_item_status: "active" }] };
    throw new Error(`unexpected package authorization query: ${sql}`);
  },
} as any;
assert.equal(await currentDocumentConnectionCanRemove(packageClient, 12, 7, { ...reassignedRow, targetType: "work_package", targetId: packageTargetId }, targetAccess), true, "current package responsible authority is effective for GET and DELETE");

const unavailable = JSON.parse(JSON.stringify(presentDocumentConnection({
  ...reassignedRow,
  canonicalId: null,
  displayCode: "MUST-NOT-LEAK",
  title: "Deleted canonical title",
  status: "deleted",
  version: 99,
}, true)));
assert.equal(unavailable.canRemove, true, "a missing canonical source must not prevent the current controller from unlinking");
assert.deepEqual(unavailable.entity, {
  id: 31,
  entityType: "rfi",
  entityId: 31,
  entityIdentity: "rfi:31",
  available: false,
  stale: true,
  displayCode: "",
  title: "",
  status: null,
  version: null,
  deepLink: "",
});
assert.equal(unavailable.entity.id, unavailable.entity.entityId, "stale connection entity id must match entityId for the UI guard");
const deleted = presentDocumentConnection({ ...reassignedRow, entityId: 32, canonicalId: 32, status: "deleted" }, true);
assert.equal(deleted.entity.id, deleted.entity.entityId, "soft-deleted connection entity id must match entityId for the UI guard");
assert.equal(deleted.entity.available, false, "a soft-deleted canonical row must return a safe stale entity without bricking GET");
assert.equal(deleted.entity.stale, true);
assert.equal(deleted.canRemove, true, "the current target controller may unlink a soft-deleted canonical record");

assert.match(routes, /operations\/document-connections/);
assert.match(routes, /operations\/document-connections\/:connectionId/);
assert.match(routes, /res\.status\(201\)\.json\(await linkJobOperationDocumentConnection/);
assert.match(routes, /unlinkJobOperationDocumentConnection/);

console.log(JSON.stringify({
  status: "PASS",
  tests: [
    "additive-identical-schema",
    "typed-text-target-and-integer-entity",
    "active-company-project-boundary",
    "exact-canonical-source",
    "concurrency-idempotency",
    "immutable-link-unlink-events",
    "canonical-display-contract",
    "canonical-uuid-validation",
    "bounded-batch-connection-authorization",
    "truthful-connection-list-meta",
    "current-controller-reassignment-revocation",
    "manager-assignee-resource-package-authority",
    "missing-canonical-safe-get-and-unlink",
    "deleted-canonical-safe-get-and-unlink",
    "actual-deep-link-consumers",
    "junction-only-delete",
    "no-generic-linked-items",
  ],
}));
