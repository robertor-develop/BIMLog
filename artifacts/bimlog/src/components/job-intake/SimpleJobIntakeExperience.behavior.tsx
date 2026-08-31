import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SimpleJobIntakeExperience } from "./SimpleJobIntakeExperience";

const data = {
  identity: { jobName: "River Avenue", jobCode: "RA-01", clientCompany: "GC One", primaryContact: "Ruben", currency: "USD" },
  commercial: { contracts: [{ id: "PRIMARY", counterpartyName: "GC One", agreementKind: "base", contractType: "consultant_agreement" }] },
  scopeItems: [{ id: "CI-1", name: "HVAC shop drawings", plannedHours: "80", billingHourlyRate: "35.47", contractId: "PRIMARY" }],
  team: { projectLeaderUserId: 7, assignments: [{ id: "A-1", userId: 7, personName: "Ana", role: "BIM Coordinator", scopeItemId: "CI-1", plannedHours: "80" }] },
  review: { scopeConfirmed: false, teamConfirmed: false },
};
const tt = (en: string) => en;
const html = renderToStaticMarkup(<SimpleJobIntakeExperience data={data} setData={() => undefined} members={[{ id: 7, name: "Ana" }]} defaultRate="35.47" tt={tt} onAdvanced={() => undefined}/>);
assert.match(html, /Two-minute setup/);
assert.match(html, /Question 1 of 7/);
assert.match(html, /What job are you creating/);
assert.match(html, /Advanced setup/);
assert.doesNotMatch(html, /immutable snapshot|authority receipt/i);

const source = readFileSync(new URL("./SimpleJobIntakeExperience.tsx", import.meta.url), "utf8");
for (const question of ["What job are you creating?", "Who hired you?", "What are they hiring you to do?", "What kind of agreement is this?", "How should it be estimated?", "Who will work on it?", "Is this summary correct?"]) assert.match(source, new RegExp(question.replace(/[?]/g, "\\?")));
assert.match(source, /guarda automáticamente/);
assert.match(source, /Configuración avanzada/);
assert.match(source, /patchIdentity\("clientName"/);
assert.match(source, /Standard review and delivery workflow/);
console.log("Simple Job Intake experience behavior: PASS");
