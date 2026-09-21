import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chunkClashSource, deduplicateClashRows, normalizeAiClashRows, parseAiJsonArray } from "./clash-report-contracts";
import { requireClashLinkProvenance, requireClashProvenance } from "./clash-report-provenance";
import { classifyVisualPackageTruth } from "./clash-visual-package-truth";

const largeSource = "x".repeat(240_001);
const chunks = chunkClashSource(largeSource);
assert.deepEqual(chunks.map(chunk => chunk.length), [80_000, 80_000, 80_000, 1]);
assert.equal(chunks.join(""), largeSource);

const largeRecords = Array.from({ length: 12_000 }, (_, index) => ({
  viewpoint: `C.${String(index).padStart(5, "0")}`,
  description: `Coordination item ${index}`,
  discipline: index % 2 ? "PB" : "HVAC",
}));
const normalized = normalizeAiClashRows(largeRecords, "document");
assert.equal(normalized.length, 12_000);
assert.equal(deduplicateClashRows([...normalized, normalized[0]]).length, 12_000);

for (const malformed of ["", "not-json", "{}", "null", "```json\n{\"viewpoint\":\"C.1\"}\n```"]) {
  assert.throws(() => parseAiJsonArray(malformed));
}

for (const mismatch of [
  { routeProjectId: 5, routeReportId: 7, recordProjectId: 6, recordReportId: 7 },
  { routeProjectId: 5, routeReportId: 7, recordProjectId: 5, recordReportId: 8 },
  { routeProjectId: 0, routeReportId: 7, recordProjectId: 0, recordReportId: 7 },
]) assert.throws(() => requireClashProvenance(mismatch), /CLASH_PROVENANCE_MISMATCH/);

assert.throws(() => requireClashLinkProvenance({ projectId: 5, sourceProjectId: 5, sourceReportId: 7, reportProjectId: 6, targetProjectId: 5 }), /CLASH_PROVENANCE_MISMATCH/);
assert.equal(classifyVisualPackageTruth({ visualStateJson: "{}", visualStateDigest: "broken" }).state, "invalid_partial");

const routeSource = readFileSync(fileURLToPath(new URL("../routes/clash_reports.ts", import.meta.url)), "utf8");
for (const required of [
  "clashScopeWhere(projectId, reportId)",
  "clashScopeWhere(projectId, reportId, clashId)",
  "clashReportScopeWhere(projectId, reportId)",
  "classifyVisualPackageTruth(r)",
  "presentLensReferenceAttachment(projectId, item)",
]) assert.ok(routeSource.includes(required), `missing governed route binding: ${required}`);

console.log("POST120_BUILD164=PASS large=12000 malformed=fail_closed tenant=deny project=deny object=deny visual=deny");
