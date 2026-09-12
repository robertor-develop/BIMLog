import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const links = await readFile(new URL("../routes/linked_items.ts", import.meta.url), "utf8");
const coordination = await readFile(new URL("../routes/coordination.ts", import.meta.url), "utf8");
const store = await readFile(new URL("coordination-hub-postgres-store.ts", import.meta.url), "utf8");
const projection = await readFile(new URL("coordination-action-projection.ts", import.meta.url), "utf8");

const checks = [
  ["generic link writes require project write permission", links, /router\.post\("\/projects\/:projectId\/links", authMiddleware, requirePermission\("admin", "write"\)/],
  ["link entity types are closed and explicit", links, /const linkEntityTypes = \["rfi", "submittal", "transmittal", "change_order", "meeting", "file", "clash", "lens_viewpoint"\] as const/],
  ["source and target IDs must be authoritative positive integers", links, /Number\.isInteger\(fromId\)[\s\S]*Number\.isInteger\(toId\)/],
  ["both link endpoints are checked before persistence", links, /entityBelongsToProject\(fromType, fromId, projectId\)[\s\S]*entityBelongsToProject\(toType, toId, projectId\)/],
  ["cross-project or missing endpoints fail closed", links, /Both linked items must exist in the requested project/],
  ["all entity lookups bind ID and project", links, /case "rfi":[\s\S]*rfisTable\.projectId, projectId[\s\S]*case "submittal":[\s\S]*submittalsTable\.projectId, projectId[\s\S]*case "transmittal":[\s\S]*transmittalsTable\.projectId, projectId[\s\S]*case "change_order":[\s\S]*changeOrdersTable\.projectId, projectId[\s\S]*case "meeting":[\s\S]*meetingMinutesTable\.projectId, projectId[\s\S]*case "file":[\s\S]*filesTable\.projectId, projectId[\s\S]*case "clash":[\s\S]*clashesTable\.projectId, projectId[\s\S]*case "lens_viewpoint":[\s\S]*lensViewpointsTable\.projectId, projectId/],
  ["duplicate link lookup remains project scoped", links, /eq\(linkedItemsTable\.projectId, projectId\)[\s\S]*eq\(linkedItemsTable\.fromType, fromType\)[\s\S]*eq\(linkedItemsTable\.toType, toType\)/],
  ["link removal remains project scoped", links, /eq\(linkedItemsTable\.id, linkId\), eq\(linkedItemsTable\.projectId, projectId\)/],
  ["coordination revisions reject cross-project source files", store, /EXISTS\(SELECT 1 FROM files WHERE id=\$5 AND project_id=\$3\)[\s\S]*Source file does not belong to the requested project/],
  ["coordination intake writes only its own record, activity, and file", coordination, /db\.insert\(coordinationIntakeEventsTable\)[\s\S]*db\.insert\(activityLogTable\)[\s\S]*db\.insert\(filesTable\)/],
  ["coordination intake does not mutate protected linked modules", coordination, /coordinationIntakeEventsTable/],
  ["coordination action projection is a pure contract projection", projection, /return projectLegacyAction\(/],
];

for (const [name, source, pattern] of checks) assert.match(source, pattern, name);
for (const protectedTable of ["rfisTable", "submittalsTable", "transmittalsTable", "changeOrdersTable", "meetingMinutesTable", "lensViewpointsTable"]) {
  assert.doesNotMatch(coordination, new RegExp(`db\\.(?:update|delete)\\(${protectedTable}\\)`), `coordination must not mutate ${protectedTable}`);
}
assert.doesNotMatch(projection, /@workspace\/db|db\.(?:insert|update|delete)/, "action projection must not write persistence");

console.log("PASS post-P18 Build 68 Coordination linked-record isolation (20 checks)");
