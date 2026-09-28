const blocked = /authorization|cookie|token|secret|password|credential|database|connection|string|payload/i;
export function sanitizeSharePointPublicationDiagnostic(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([key, value]) => !blocked.test(key) && ["string", "number", "boolean"].includes(typeof value)).map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 160) : value]));
}
