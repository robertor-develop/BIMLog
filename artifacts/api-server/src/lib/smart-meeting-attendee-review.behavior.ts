import assert from "node:assert/strict";
import test from "node:test";
import { parseAttendeeCandidates, reviewAttendeeCandidates } from "./smart-meeting-attendee-review";

test("parses paste-friendly attendee rows without inventing email addresses", () => {
  assert.deepEqual(parseAttendeeCandidates("Ruben Crespo, RUBEN@Example.com, BIMTECH\nNew Person,not-an-email,Mega"), [
    { fullName: "Ruben Crespo", email: "ruben@example.com", company: "BIMTECH" },
    { fullName: "New Person", email: null, company: "Mega" },
  ]);
});

test("classifies exact matches, new contacts and conflicts for explicit review", () => {
  const reviewed = reviewAttendeeCandidates(parseAttendeeCandidates("Ruben Crespo,ruben@example.com,BIMTECH\nNew Person,new@example.com,Mega\nRuben Crespo,other@example.com,BIMTECH"), [
    { id: 7, fullName: "Ruben Crespo", email: "ruben@example.com" },
  ]);
  assert.deepEqual(reviewed.map((row) => row.matchStatus), ["matched", "new_contact", "conflict"]);
  assert.equal(reviewed[0].directoryEntryId, 7);
});

test("rejects more than the governed attendee maximum", () => {
  assert.throws(() => parseAttendeeCandidates(Array.from({ length: 501 }, (_, index) => `Person ${index}`).join("\n")), /meeting_attendee_limit_exceeded/);
});
