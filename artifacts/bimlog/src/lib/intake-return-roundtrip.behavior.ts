import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { intakeReturnActionHref, parseIntakeResume, parseIntakeReturn, withIntakeReturn } from "./return-context";

for (const stage of ["documents", "identity", "contract", "scope", "delivery", "team", "review"] as const) {
  const outbound = withIntakeReturn(`/projects/63/${stage === "delivery" ? "convention" : "financial/apu"}`, 63, stage, `ji-${stage}`);
  const context = parseIntakeReturn(outbound.slice(outbound.indexOf("?") + 1));
  assert.ok(context);
  const returnHref = intakeReturnActionHref(context);
  const returnQuery = returnHref.slice(returnHref.indexOf("?") + 1);
  assert.deepEqual(parseIntakeResume(returnQuery, 63), context);
}

for (const search of [
  "stage=delivery&resume=prerequisite&returnTo=https%3A%2F%2Fevil.test",
  "stage=delivery&resume=prerequisite&projectId=64",
  "stage=delivery&item=other-control&resume=prerequisite",
]) assert.equal(parseIntakeResume(search, 63), null);

const notice = readFileSync(new URL("../components/job-intake/IntakeResumeNotice.tsx", import.meta.url), "utf8");
const intake = readFileSync(new URL("../pages/JobIntakeWorkspace.tsx", import.meta.url), "utf8");
assert.match(notice, /Returned to your saved Job Intake/);
assert.match(notice, /Regresó a su Ingreso del Trabajo guardado/);
assert.match(notice, /window\.history\.replaceState/);
assert.match(intake, /intakeResumeTarget\(returnContext\)/);
assert.match(intake, /data-intake-return-focus/);
assert.match(intake, /focus\(\{ preventScroll: true \}\)/);
console.log("Intake prerequisite round trip: exact return, saved stage, field focus and unsafe-query denial PASS");
