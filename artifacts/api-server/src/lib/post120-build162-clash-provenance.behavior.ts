import assert from "node:assert/strict";
import { ClashProvenanceError, requireClashLinkProvenance, requireClashProvenance } from "./clash-report-provenance";

requireClashProvenance({ routeProjectId: 1, routeReportId: 2, routeClashId: 3, recordProjectId: 1, recordReportId: 2, recordClashId: 3 });
for (const candidate of [
  { routeProjectId: 1, routeReportId: 2, routeClashId: 3, recordProjectId: 9, recordReportId: 2, recordClashId: 3 },
  { routeProjectId: 1, routeReportId: 2, routeClashId: 3, recordProjectId: 1, recordReportId: 8, recordClashId: 3 },
  { routeProjectId: 1, routeReportId: 2, routeClashId: 3, recordProjectId: 1, recordReportId: 2, recordClashId: 7 },
]) assert.throws(() => requireClashProvenance(candidate), ClashProvenanceError);

requireClashLinkProvenance({ projectId: 1, sourceProjectId: 1, sourceReportId: 2, reportProjectId: 1, targetProjectId: 1 });
assert.throws(() => requireClashLinkProvenance({ projectId: 1, sourceProjectId: 1, sourceReportId: 2, reportProjectId: 1, targetProjectId: 9 }), /CLASH_PROVENANCE_MISMATCH/);

console.log("POST120_BUILD162=PASS project=bound report=bound clash=bound target=bound");
