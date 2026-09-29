import assert from "node:assert/strict";
import { financialAuthorityDate } from "./financial-authority-presentation";
import { calendarDate, formatCalendarDate, formatOptionalInstantDate } from "../../../../lib/api-zod/src/calendar-date";
import { intakeReadinessLabel } from "./intake-readiness-presentation";
import { uniqueRfiPriorities, withCurrentPriority } from "./rfi-priority-options";
import { submittalToEditorForm, buildSubmittalUpdateRequest } from "./submittal-editor-contract";

assert.equal(intakeReadinessLabel("activated", true, "saved", "en"), "Active job");
assert.equal(intakeReadinessLabel("activated", false, "saved", "en"), "Active job");
assert.match(intakeReadinessLabel("activated", true, "unsaved", "en"), /changes pending/);
assert.match(intakeReadinessLabel("activated", true, "error", "es"), /guardado/);
assert.equal(intakeReadinessLabel("draft", true, "saved", "en"), "Draft ready to activate");
assert.match(intakeReadinessLabel("draft", false, "saved", "es"), /incompleta/);
const priorities = [{value:"low",label:"Low",labelEs:"Baja"},{value:"medium",label:"Medium",labelEs:"Media"},{value:"low",label:"Duplicate",labelEs:"Duplicada"},{value:"legacy",label:"Legacy",labelEs:"Anterior"}];
assert.deepEqual(uniqueRfiPriorities(priorities).map(x=>x.value),["low","medium","legacy"]);
assert.equal(uniqueRfiPriorities(priorities)[0].labelEs,"Baja");
assert.equal(priorities.length,4);
assert.deepEqual(withCurrentPriority(priorities,"retired").map(x=>x.value),["low","medium","legacy","retired"]);
assert.equal(withCurrentPriority(priorities,"low").length,3);
for (const zone of ["America/New_York","Pacific/Honolulu","Pacific/Kiritimati","UTC"]) {
  process.env.TZ=zone;
  assert.equal(financialAuthorityDate({grantId:"commercial-entitlement:5:financial_viewer",effectiveFrom:"1970-01-01T00:00:00.000Z"},"en"),"Included with Commercial access");
  assert.equal(financialAuthorityDate({grantId:"commercial-entitlement:5:financial_viewer",effectiveFrom:"1970-01-01T00:00:00.000Z"},"es"),"Incluido con acceso Comercial");
  assert.equal(financialAuthorityDate({grantId:"recorded-grant",effectiveFrom:null},"en"),"Not recorded");
  assert.equal(financialAuthorityDate({grantId:"recorded-grant",effectiveFrom:"1970-01-01T00:00:00.000Z"},"en"),new Date(0).toLocaleDateString("en-US"));
  const localDay = ["America/New_York", "Pacific/Honolulu"].includes(zone) ? 25 : 26;
  assert.equal(formatOptionalInstantDate("2026-09-26T00:00:00Z"), `9/${localDay}/2026`);
  assert.equal(formatOptionalInstantDate("2026-09-26T00:00:00Z", "es"), `${localDay}/9/2026`);
  for (const absent of [null, undefined, "", 0, "bad", new Date(NaN)]) assert.equal(formatOptionalInstantDate(absent,"en-US","Not recorded"),"Not recorded");
  for (const value of ["2026-09-26","2026-09-26T00:00:00.000Z","2026-09-26T23:00:00-04:00",new Date("2026-09-26T00:00:00Z")]) {
    assert.equal(calendarDate(value),"2026-09-26");
    assert.equal(formatCalendarDate(value),"Sep 26, 2026");
    assert.match(formatCalendarDate(value,"es"),/26 sept 2026/);
  }
  for (const value of [null,undefined,"",0,"2026-02-30","2026-02-30T00:00:00Z","bad",new Date(NaN)]) assert.equal(formatCalendarDate(value,"en-US","Not recorded"),"Not recorded");
  const form=submittalToEditorForm({dateSubmitted:"2026-09-26T00:00:00Z",dateRequired:"2026-09-30T00:00:00Z"});
  const payload=buildSubmittalUpdateRequest(form,"2026-09-29T12:01:00Z");
  assert.equal(payload.dateSubmitted,"2026-09-26");
  assert.equal(payload.dateRequired,"2026-09-30");
  assert.equal(payload.expectedUpdatedAt,"2026-09-29T12:01:00Z");
  assert.equal(submittalToEditorForm({dateSubmitted:null}).dateSubmitted,"");
  assert.equal(submittalToEditorForm({dateRequired:null,dueDate:"2026-09-30T00:00:00Z"}).dateRequired,"2026-09-30");
}
console.log("UX block 02: readiness, stable priorities, calendar/editor round trip and null dates PASS (four time zones)");
