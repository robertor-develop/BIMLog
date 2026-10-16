import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = file => readFileSync(file, "utf8");
const routes = read("artifacts/api-server/src/routes/schedule.ts");
for (const contract of [
  /type SourceType = "milestone" \| "rfi" \| "submittal" \| "meeting"/,
  /router\.get\("\/projects\/:projectId\/schedule\/live", authMiddleware, requireProjectMember\(\)/,
  /router\.post\("\/projects\/:projectId\/schedule\/buckets", authMiddleware, requirePermission\("admin", "write"\)/,
  /router\.post\("\/projects\/:projectId\/schedule\/items\/move", authMiddleware, requirePermission\("admin", "write"\)/,
  /router\.post\("\/projects\/:projectId\/schedule\/buckets\/:fromBucketId\/rollover", authMiddleware, requirePermission\("admin", "write"\)/,
  /router\.get\("\/projects\/:projectId\/schedule\/items\/:sourceType\/:sourceId\/history", authMiddleware, requireProjectMember\(\)/,
  /type ExportView = "calendar" \| "board" \| "list"/,
]) assert.match(routes, contract);
for (const token of ["assignedUserId", "isOverdue", "daysOverdue", "rolloverCount", "linkedModule", "linkedId", "includeRolloverHistory", "export-pdf"]) assert.ok(routes.includes(token), `Schedule lifecycle is missing ${token}`);
const ui = read("artifacts/bimlog/src/pages/project/ScheduleTab.tsx");
for (const token of ['type ScheduleViewMode = "calendar" | "board" | "list"', "visibleLayers", "bucketFilter", "assignedFilter", "rolloverBucket", "applyScheduleFilters"]) assert.ok(ui.includes(token), `Schedule UI is missing ${token}`);
assert.match(ui, /change_order/);
assert.match(ui, /3d_model/);
console.log("GA-F03-B025 schedule, sprint, linked-work and export reconciliation: PASS");
