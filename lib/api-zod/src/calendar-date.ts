import { normalizeSpreadsheetDateOnly } from "./spreadsheet-policy";

/** Calendar fields retain their encoded day, including legacy ISO timestamp storage.
 * Do not use this for audit, custody, approval-event or other instant timestamps. */
export function calendarDate(value: unknown): string | null {
  if (value instanceof Date) return normalizeSpreadsheetDateOnly(value);
  if (typeof value !== "string" || !value) return null;
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    if (!Number.isFinite(Date.parse(value))) return null;
    return normalizeSpreadsheetDateOnly(value.slice(0, 10));
  }
  return normalizeSpreadsheetDateOnly(value);
}

export function formatCalendarDate(value: unknown, locale = "en-US", missing = "-"): string {
  const day = calendarDate(value);
  if (!day) return missing;
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }).format(new Date(`${day}T12:00:00Z`));
}

/** Effective-from/to timestamps retain their browser-local day. Guard absence
 * before Date construction so null never becomes the Unix epoch. */
export function formatOptionalInstantDate(value: unknown, locale = "en-US", missing = "-"): string {
  if ((typeof value !== "string" && !(value instanceof Date)) || value === "") return missing;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(locale) : missing;
}
