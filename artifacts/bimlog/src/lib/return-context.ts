const stages = new Set(["documents", "identity", "contract", "scope", "delivery", "team", "review"]);
export function intakeOrigin(projectId: number, stage: string, item?: string): string {
  const query = new URLSearchParams({ stage: stages.has(stage) ? stage : "documents" });
  if (item && /^ji-[a-zA-Z0-9_-]{1,100}$/.test(item)) query.set("item", item);
  return `/projects/${projectId}/intake?${query}`;
}
export function validatedReturn(search: string, projectId: number): string | null {
  const raw = new URLSearchParams(search).get("returnTo");
  if (!raw || raw.length > 500 || !Number.isSafeInteger(projectId) || projectId < 1) return null;
  let url: URL;
  try { url = new URL(raw, "https://bimlog.invalid"); } catch { return null; }
  if (url.origin !== "https://bimlog.invalid" || url.pathname !== `/projects/${projectId}/intake` || url.hash || raw.includes("\\")) return null;
  const stage = url.searchParams.get("stage") || "documents";
  if (!stages.has(stage) || [...url.searchParams.keys()].some(key => !["stage", "item"].includes(key))) return null;
  const item = url.searchParams.get("item");
  if (item && !/^ji-[a-zA-Z0-9_-]{1,100}$/.test(item)) return null;
  return intakeOrigin(projectId, stage, item || undefined);
}
export function withIntakeReturn(destination: string, projectId: number, stage: string, item?: string) {
  return `${destination}${destination.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(intakeOrigin(projectId, stage, item))}`;
}
