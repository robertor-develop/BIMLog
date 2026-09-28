import assert from "node:assert/strict";
import { businessDuration, type BusinessCalendar } from "./business-calendar";

const calendar: BusinessCalendar = {
  version: "BIMTECH-2026.1",
  timeZone: "America/New_York",
  workingWeekdays: [1, 2, 3, 4, 5],
  workdayStart: "09:00",
  workdayEnd: "17:00",
  holidays: ["2026-09-28"],
};

const normal = businessDuration({ from: "2026-09-25T13:00:00Z", to: "2026-09-25T21:00:00Z", calendar });
assert.equal(normal.hours, 8);
assert.equal(normal.calendarVersion, "BIMTECH-2026.1");

const weekendAndHoliday = businessDuration({ from: "2026-09-25T21:00:00Z", to: "2026-09-29T13:00:00Z", calendar });
assert.equal(weekendAndHoliday.hours, 0, "weekend and the configured Monday holiday are excluded");

const boundary = businessDuration({ from: "2026-09-29T12:59:30Z", to: "2026-09-29T13:00:30Z", calendar });
assert.equal(boundary.minutes, 0.5, "the opening boundary is measured without rounding up the excluded segment");

const dstCalendar: BusinessCalendar = { ...calendar, version: "DST-2026", workingWeekdays: [0], workdayStart: "01:00", workdayEnd: "04:00", holidays: [] };
const dst = businessDuration({ from: "2026-03-08T06:00:00Z", to: "2026-03-08T08:00:00Z", calendar: dstCalendar });
assert.equal(dst.hours, 2, "spring-forward uses actual elapsed instants while applying local working boundaries");

assert.equal(businessDuration({ from: "bad", to: "2026-09-29T13:00:00Z", calendar }).state, "unknown");

console.log("C032 versioned business calendar: PASS");
