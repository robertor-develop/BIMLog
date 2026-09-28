import assert from "node:assert/strict";
import { createReportingBaseline } from "./reporting-baseline";
import { compareReportingBaselines } from "./reporting-baseline-comparison";

const source = (recordId: string, version: number, status: string) => ({ dataset: "rfi" as const, recordId, version, status, sourceUpdatedAt: "2026-09-28T12:00:00Z" });
const make = (id: string, sources: ReturnType<typeof source>[]) => createReportingBaseline({ id, tenantId: 31, projectId: 26, capturedAt: id === "from" ? "2026-09-21T13:00:00Z" : "2026-09-28T13:00:00Z", capturedByUserId: 7, sources });
const from = make("from", [source("pending", 1, "open"), source("returned", 1, "open"), source("closed", 1, "open"), source("revised", 1, "open"), source("voided", 1, "open"), source("removed", 1, "open")]);
const to = make("to", [source("pending", 1, "open"), source("returned", 1, "returned"), source("closed", 1, "closed"), source("revised", 2, "open"), source("voided", 2, "voided"), source("opened", 1, "open"), source("late", 3, "open")]);
const result = compareReportingBaselines({ from, to, knownAtFrom: new Set(["rfi:late"]) });
assert.deepEqual(result.totals, { opened: 1, returned: 1, closed: 2, pending: 1, revised: 1, voided: 1, late_imported: 1 });
assert.equal(result.distinctRecords, result.changes.length, "records must not be double counted across delta classes");
assert.throws(() => compareReportingBaselines({ from, to: createReportingBaseline({ id: "other", tenantId: 32, projectId: 26, capturedAt: "2026-09-28T13:00:00Z", capturedByUserId: 7, sources: [] }) }), /SCOPE_MISMATCH/);
console.log("C043 deterministic baseline deltas without double counting: PASS");
