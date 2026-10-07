import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { evidenceHistoryHref, EVIDENCE_HISTORY_SOURCES } from "../pages/project/report-experience";
import { parseReportEvidenceReturn } from "./report-evidence-return";

const projectId = 63;
const reportsPath = `/projects/${projectId}/reports`;
const expectedSources = ["files", "rfis", "submittals", "meetings", "change-orders", "transmittals"];

assert.deepEqual(EVIDENCE_HISTORY_SOURCES.map((source) => source.path), expectedSources);
for (const source of EVIDENCE_HISTORY_SOURCES) {
  const launch = new URL(evidenceHistoryHref(projectId, source.path), "https://bimlog.app");
  assert.equal(launch.pathname, `/projects/${projectId}/${source.path}`);
  assert.deepEqual(parseReportEvidenceReturn(launch.search, projectId), { returnTo: reportsPath });
}

assert.equal(parseReportEvidenceReturn(`?from=${encodeURIComponent("/projects/62/reports")}`, projectId), null);
assert.equal(parseReportEvidenceReturn(`?from=${encodeURIComponent(reportsPath)}&extra=1`, projectId), null);
assert.equal(parseReportEvidenceReturn(`?from=${encodeURIComponent(reportsPath)}&from=${encodeURIComponent(reportsPath)}`, projectId), null);

for (const file of [
  "../pages/project/FilesTab.tsx",
  "../pages/project/RfisTab.tsx",
  "../pages/project/SubmittalsTab.tsx",
  "../pages/project/MeetingsTab.tsx",
  "../pages/project/ChangeOrdersTab.tsx",
  "../pages/project/TransmittalsTab.tsx",
]) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  assert.match(source, /<ReportsReturnBanner projectId=\{projectId\} \/>/);
}

console.log("Human flow continuity block 4: Reports evidence round trips PASS");
