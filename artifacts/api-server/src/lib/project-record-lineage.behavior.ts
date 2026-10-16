import assert from "node:assert/strict";
import { ProjectRecordLineageError, requireProjectRecordLineage } from "./project-record-lineage";

requireProjectRecordLineage({ routeProjectId: 35, recordProjectId: 35, state: "active" });
for (const sample of [
  { routeProjectId: 35, recordProjectId: 26, state: "active" as const, code: "PROJECT_LINEAGE_MISMATCH" },
  { routeProjectId: 35, recordProjectId: 35, state: "archived" as const, code: "PROJECT_RECORD_UNAVAILABLE" },
  { routeProjectId: 35, recordProjectId: 35, state: "missing" as const, code: "PROJECT_RECORD_UNAVAILABLE" },
  { routeProjectId: 35, recordProjectId: 35, state: "stale" as const, code: "PROJECT_RECORD_UNAVAILABLE" },
]) assert.throws(() => requireProjectRecordLineage(sample), (error: unknown) => error instanceof ProjectRecordLineageError && error.code === sample.code);
console.log("CORRECTIVE-B12 project/model/reference lineage: PASS");
