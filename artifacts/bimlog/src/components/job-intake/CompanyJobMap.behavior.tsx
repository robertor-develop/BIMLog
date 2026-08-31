import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CompanyJobMap } from "./CompanyJobMap";

const data = { relationships: { participants: [{ id: "BIMTECH", companyName: "BIMTech", role: "service_provider" }, { id: "GC", companyName: "General Contractor", role: "general_contractor" }], engagements: [{ id: "E1", providerParticipantId: "BIMTECH", customerParticipantId: "GC", description: "Coordination" }] }, commercial: { contracts: [{ id: "PRIMARY" }] }, scopeItems: [{ id: "CI-1" }] };
const html = renderToStaticMarkup(<CompanyJobMap data={data} setData={() => undefined} tt={(en) => en}/>);
assert.match(html, /Who is connected to this job/);
assert.match(html, /BIMTech/);
assert.match(html, /General Contractor/);
assert.match(html, /Coordination/);
assert.match(html, /Hiring and service relationships/);
assert.match(html, /Draft map · autosaved/);
console.log("Company Job Map UI behavior: PASS");
