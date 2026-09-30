export function safeEmailReturnTarget(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  const url = new URL(value, "https://bimlog.local");
  return url.origin === "https://bimlog.local" ? `${url.pathname}${url.search}${url.hash}` : null;
}
