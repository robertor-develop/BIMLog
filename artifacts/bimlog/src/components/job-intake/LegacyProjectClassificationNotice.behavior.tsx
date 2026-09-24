import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clearLegacyProjectClassification, LegacyProjectClassificationNotice } from "./LegacyProjectClassificationNotice";

const prior = {
  classification: { disciplineId: "D1", serviceId: "S1", serviceName: "Shop Drawings", phaseId: "P1", phaseName: "Preliminary" },
  scopeItems: [{ workPackages: [{ classification: { serviceId: "S2", phaseId: "P2" } }] }],
  review: { scopeConfirmed: true },
};
const html = renderToStaticMarkup(<LegacyProjectClassificationNotice data={prior} setData={() => undefined} tt={en => en} />);
assert.match(html, /Legacy project Service\/Phase selection/);
assert.match(html, /Shop Drawings/);
const cleared = clearLegacyProjectClassification(prior);
assert.equal(cleared.classification.disciplineId, "D1");
assert.equal(cleared.classification.serviceId, "");
assert.equal(cleared.classification.phaseId, "");
assert.equal(cleared.scopeItems, prior.scopeItems, "package classifications must remain untouched");
assert.equal(cleared.review.scopeConfirmed, false);
assert.equal(renderToStaticMarkup(<LegacyProjectClassificationNotice data={cleared} setData={() => undefined} tt={en => en} />), "");
console.log("Legacy project classification notice: visible, explicit clearing, package preservation PASS");
