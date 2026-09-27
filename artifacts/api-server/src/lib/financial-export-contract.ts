/** Strict calendar dates; Date.parse alone normalizes impossible month days. */
export function isFinancialCalendarDate(value: string): boolean {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) || value.startsWith("0000-")) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

/** Preserve exact decimal text and CSV quoting while preventing formula interpretation. */
export function financialCsvCell(value: unknown): string {
  const text = String(value ?? "");
  const decimal = /^-?[0-9]+(?:\.[0-9]+)?$/.test(text);
  const neutral = !decimal && /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${neutral.replaceAll('"', '""')}"`;
}
