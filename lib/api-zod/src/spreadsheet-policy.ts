export type SpreadsheetInputType = "buffer" | "binary" | "array" | "base64" | "string";

// Canonical BIMLog spreadsheet temporal policy:
// - date-only values are calendar values and never inherit the machine timezone;
// - only timestamps carrying Z/an explicit offset are treated as instants;
// - timezone-less date-times and unknown cells remain text until an owning importer classifies them.

export type SpreadsheetTemporalClassification =
  | { kind: "date-only"; value: string }
  | { kind: "explicit-instant"; value: string }
  | { kind: "timezone-less-date-time"; value: string }
  | { kind: "text"; value: string };

type DateParts = { y: number; m: number; d: number };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXPLICIT_INSTANT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i;
const TIMEZONE_LESS_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?$/;

function validDateParts(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(y, m - 1, d);
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function datePartsText(parts: DateParts): string | null {
  if (!validDateParts(parts.y, parts.m, parts.d)) return null;
  return `${String(parts.y).padStart(4, "0")}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}

export function classifySpreadsheetTemporalText(value: string): SpreadsheetTemporalClassification {
  const text = value.trim();
  const dateOnly = DATE_ONLY.exec(text);
  if (dateOnly) {
    const canonical = datePartsText({ y: Number(dateOnly[1]), m: Number(dateOnly[2]), d: Number(dateOnly[3]) });
    if (canonical) return { kind: "date-only", value: canonical };
  }
  if (EXPLICIT_INSTANT.test(text) && !Number.isNaN(Date.parse(text))) {
    return { kind: "explicit-instant", value: new Date(text).toISOString() };
  }
  if (TIMEZONE_LESS_DATE_TIME.test(text)) return { kind: "timezone-less-date-time", value: text };
  return { kind: "text", value: text };
}

export function canonicalSpreadsheetReadOptions<const T extends Record<string, unknown>>(
  fileName: string,
  type: SpreadsheetInputType,
  additional: T,
): T & { type: SpreadsheetInputType; UTC: true; raw?: true } {
  const options = { ...additional, type, UTC: true } as T & { type: SpreadsheetInputType; UTC: true; raw?: true };
  if (/\.csv$/i.test(fileName)) {
    options.raw = true;
  }
  return options;
}

export function canonicalSpreadsheetInput<const T extends Record<string, unknown>>(
  input: string | ArrayBuffer | Uint8Array,
  fileName: string,
  type: SpreadsheetInputType,
  additional: T,
) {
  if (!/\.csv$/i.test(fileName)) return { data: input, options: canonicalSpreadsheetReadOptions(fileName, type, additional) };
  let text: string;
  if (typeof input === "string" && type !== "binary") text = input;
  else {
    const bytes = typeof input === "string"
      ? Uint8Array.from(input, character => character.charCodeAt(0) & 0xff)
      : input instanceof Uint8Array ? input : new Uint8Array(input);
    const Utf8Decoder = (globalThis as unknown as {
      TextDecoder: new (label: string, options: { fatal: boolean }) => { decode(value: Uint8Array): string };
    }).TextDecoder;
    if (!Utf8Decoder) throw new Error("UTF-8 decoding is unavailable in this runtime.");
    text = new Utf8Decoder("utf-8", { fatal: true }).decode(bytes);
  }
  return {
    data: text.replace(/^\uFEFF/, ""),
    options: canonicalSpreadsheetReadOptions(fileName, "string", additional),
  };
}

export function canonicalSpreadsheetJsonOptions<const T extends Record<string, unknown>>(additional: T): T & { UTC: true } {
  return { ...additional, UTC: true };
}

export function canonicalSpreadsheetWriteOptions<const T extends Record<string, unknown>>(additional: T): T & { UTC: true } {
  return { ...additional, UTC: true };
}

export function normalizeSpreadsheetDateOnly(
  value: unknown,
  parseSerial?: (serial: number) => DateParts | null | undefined,
): string | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return datePartsText({ y: value.getUTCFullYear(), m: value.getUTCMonth() + 1, d: value.getUTCDate() });
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !parseSerial) return null;
    const parts = parseSerial(value);
    return parts ? datePartsText(parts) : null;
  }
  if (typeof value !== "string") return null;
  const classified = classifySpreadsheetTemporalText(value);
  return classified.kind === "date-only" ? classified.value : null;
}

export function spreadsheetDateOnlyToUtcDate(
  value: unknown,
  parseSerial?: (serial: number) => DateParts | null | undefined,
): Date | null {
  const canonical = normalizeSpreadsheetDateOnly(value, parseSerial);
  if (!canonical) return null;
  return new Date(`${canonical}T00:00:00.000Z`);
}

export function explicitSpreadsheetInstant(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  if (typeof value !== "string") return null;
  const classified = classifySpreadsheetTemporalText(value);
  return classified.kind === "explicit-instant" ? new Date(classified.value) : null;
}
