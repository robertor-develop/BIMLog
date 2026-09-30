import assert from "node:assert/strict";
import { verifyInclusiveAcceptance, type InclusiveJourney } from "./ux-inclusive-acceptance";

const journeys: InclusiveJourney[] = [];
for (const viewport of ["mobile", "desktop"] as const) for (const input of ["keyboard", "pointer"] as const) for (const locale of ["en", "es"] as const)
  journeys.push({ id: `${viewport}-${input}-${locale}`, viewport, input, locale, completed: true, focusOrderValid: true });
const native = [
  { client: "native-2021" as const, status: "deferred" as const, reason: "Physical affected-model field acceptance remains required." },
  { client: "native-2025" as const, status: "deferred" as const, reason: "Physical affected-model field acceptance remains required." },
];
assert.equal(verifyInclusiveAcceptance(journeys, native).status, "passed");
assert.equal(verifyInclusiveAcceptance(journeys.filter((item) => item.id !== "mobile-keyboard-es"), native).status, "blocked");
assert.equal(verifyInclusiveAcceptance(journeys, [{ client: "native-2021", status: "deferred", reason: "" }, native[1]]).status, "blocked");
console.log("UX098 mobile, keyboard, locale and native acceptance: PASS");
