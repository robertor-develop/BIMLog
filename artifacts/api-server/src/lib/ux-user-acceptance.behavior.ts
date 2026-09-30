import assert from "node:assert/strict";
import { verifyUserAcceptance, type UserJourneyAcceptance } from "./ux-user-acceptance";

const record = (participant: UserJourneyAcceptance["participant"]): UserJourneyAcceptance => ({
  participant, journeyId: `intake-${participant}`, observedAt: "2026-09-30T12:00:00.000Z",
  completedWithoutCoaching: true, recoveredWithHelpAlone: true, wrongTurns: 0, repeatedEntries: 0,
  confusingStateIds: [], resolutionIds: [],
});
const valid = [record("roberto"), record("ruben"), record("representative-user")];
assert.equal(verifyUserAcceptance(valid).status, "passed");
assert.equal(verifyUserAcceptance(valid.slice(1)).status, "blocked");
assert.equal(verifyUserAcceptance(valid.map((item) => item.participant === "ruben" ? { ...item, confusingStateIds: ["state-1"] } : item)).status, "blocked");
assert.equal(verifyUserAcceptance(valid.map((item) => item.participant === "roberto" ? { ...item, completedWithoutCoaching: false, recoveredWithHelpAlone: false } : item)).status, "blocked");
console.log("UX099 representative-user acceptance evidence: PASS");
