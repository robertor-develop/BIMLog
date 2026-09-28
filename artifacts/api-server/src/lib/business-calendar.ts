export interface BusinessCalendar {
  version: string;
  timeZone: string;
  workingWeekdays: readonly number[];
  workdayStart: string;
  workdayEnd: string;
  holidays: readonly string[];
}

export interface BusinessDuration {
  calendarVersion: string;
  calendarTimeZone: string;
  minutes: number | null;
  hours: number | null;
  state: "measured" | "unknown";
}

type LocalMinute = { date: string; weekday: number; minuteOfDay: number };

const WEEKDAY: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function parseClock(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid business calendar clock: ${value}`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error(`Invalid business calendar clock: ${value}`);
  return hour * 60 + minute;
}

function validateCalendar(calendar: BusinessCalendar): void {
  if (!calendar.version.trim()) throw new Error("Business calendar version is required");
  new Intl.DateTimeFormat("en-US", { timeZone: calendar.timeZone }).format(new Date());
  if (calendar.workingWeekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) {
    throw new Error("Business calendar weekdays must be integers from 0 through 6");
  }
  if (parseClock(calendar.workdayEnd) <= parseClock(calendar.workdayStart)) {
    throw new Error("Business calendar workday end must follow its start");
  }
  if (calendar.holidays.some(day => !/^\d{4}-\d{2}-\d{2}$/.test(day))) {
    throw new Error("Business calendar holidays must use YYYY-MM-DD");
  }
}

function localMinute(date: Date, timeZone: string): LocalMinute {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    weekday: WEEKDAY[part("weekday")] ?? -1,
    minuteOfDay: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

export function businessDuration(input: {
  from: Date | string | null | undefined;
  to: Date | string | null | undefined;
  calendar: BusinessCalendar;
}): BusinessDuration {
  validateCalendar(input.calendar);
  const from = input.from ? new Date(input.from) : null;
  const to = input.to ? new Date(input.to) : null;
  if (!from || !to || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to < from) {
    return {
      calendarVersion: input.calendar.version,
      calendarTimeZone: input.calendar.timeZone,
      minutes: null,
      hours: null,
      state: "unknown",
    };
  }

  const startMinute = parseClock(input.calendar.workdayStart);
  const endMinute = parseClock(input.calendar.workdayEnd);
  const holidays = new Set(input.calendar.holidays);
  const workingDays = new Set(input.calendar.workingWeekdays);
  let minutes = 0;
  for (let cursor = from.getTime(); cursor < to.getTime();) {
    const nextMinuteBoundary = (Math.floor(cursor / 60_000) + 1) * 60_000;
    const segmentEnd = Math.min(nextMinuteBoundary, to.getTime());
    const local = localMinute(new Date(cursor), input.calendar.timeZone);
    if (
      workingDays.has(local.weekday) &&
      !holidays.has(local.date) &&
      local.minuteOfDay >= startMinute &&
      local.minuteOfDay < endMinute
    ) {
      minutes += (segmentEnd - cursor) / 60_000;
    }
    cursor = segmentEnd;
  }

  return {
    calendarVersion: input.calendar.version,
    calendarTimeZone: input.calendar.timeZone,
    minutes,
    hours: minutes / 60,
    state: "measured",
  };
}
