import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { filterLensNextIssues, sortLensNextIssuesBy } from "./lens-next-model";
import { summarizeLensNextIssues } from "./lens-next-issue-summary";
import { LENS_NEXT_DEFAULT_FILTERS, type LensNextIssue } from "./lens-next-types";

const records = Array.from({ length: 10_000 }, (_, index) => ({
  identity: { projectId: 26, serverId: index + 1, viewpointId: `view-${index + 1}`, lifecycleStatus: "active", revisionNumber: 1 },
  displayId: `CL-${index + 1}`, status: "open", priority: 2,
  trade: "HVAC", floor: "L2", responsibleCompany: index % 2 ? "A" : "B",
  reportType: "Coordination", note: `Coordination issue ${index + 1}`, openItems: "",
  capturedAt: "2026-09-16T12:00:00Z", screenshotUrl: index === 1 ? "/capture/2.png" : null,
  visualStateAvailable: true,
}) as LensNextIssue);

const started = performance.now();
const filtered = filterLensNextIssues(records, { ...LENS_NEXT_DEFAULT_FILTERS, responsibleCompany: "A", search: "coordination" });
const sorted = sortLensNextIssuesBy(filtered, "code");
const summary = summarizeLensNextIssues(sorted);
const elapsedMs = performance.now() - started;
assert.equal(filtered.length, 5_000);
assert.equal(summary.total, 5_000);
assert.equal(summary.withImageReference, 1);
assert.equal(sorted[0].identity.serverId, 2);
assert.equal(sorted.slice(0, 100).length, 100);
console.log(`Lens Next 10k-record synthetic filter/sort/summary: PASS (${elapsedMs.toFixed(1)} ms; not a live-render benchmark)`);
