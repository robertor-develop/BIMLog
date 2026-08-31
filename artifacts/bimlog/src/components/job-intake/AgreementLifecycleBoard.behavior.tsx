import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AgreementLifecycleBoard } from "./AgreementLifecycleBoard";

const data = { relationships: { participants: [{ id: "A", companyName: "BIMTech" }, { id: "B", companyName: "GC" }], engagements: [{ id: "E", providerParticipantId: "A", customerParticipantId: "B" }] }, commercial: { contracts: [{ id: "BASE", title: "Base coordination", agreementKind: "base", status: "active", engagementId: "E" }, { id: "CO", title: "Added floor", agreementKind: "addition", status: "proposed", engagementId: "E", parentContractId: "BASE" }] }, scopeItems: [] };
const html = renderToStaticMarkup(<AgreementLifecycleBoard data={data} setData={() => undefined as never} tt={(en) => en}/>);
assert.match(html, /What has been proposed or agreed/);
assert.match(html, /BIMTech/);
assert.match(html, /Base coordination/);
assert.match(html, /Added floor/);
assert.match(html, /BIMLog never generates a legal number here/);
console.log("Agreement Lifecycle Board UI behavior: PASS");
