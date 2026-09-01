import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JobCommandCenter, commandCenterSummary } from "./JobCommandCenter";

const data = {
  identity: { jobName: "River Avenue", jobCode: "RA-01", currency: "USD" },
  relationships: { participants: [{ id: "A" }, { id: "B" }], engagements: [{ id: "E" }] },
  commercial: { contracts: [{ id: "C", engagementId: "E" }] },
  apuDrafts: [{ id: "APU", contractId: "C" }],
  workPackages: [{ id: "WP", apuDraftId: "APU" }],
  resourcePlans: [{ id: "R", workPackageId: "WP", role: "Coordinator", plannedHours: "20", internalHourlyRate: "37.99" }],
};
const summary = commandCenterSummary(data, [{ id: 1, fileName: "Scope.pdf" }]);
assert.equal(summary.attention.length, 0);
assert.equal(summary.hours, 20);
assert.equal(summary.cost.toFixed(2), "759.80");
const html = renderToStaticMarkup(<JobCommandCenter data={data} documents={[{ id: 1, fileName: "Scope.pdf" }]} completion={{ percent: 85 }} status="draft" tt={(en) => en} />);
assert.match(html, /JOB COMMAND CENTER/);
assert.match(html, /River Avenue/);
assert.match(html, /USD 759\.80/);
assert.match(html, /Ready for review/);
console.log("Job Command Center UI behavior: PASS");
