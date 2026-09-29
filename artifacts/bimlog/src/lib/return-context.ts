const stages = new Set(["documents", "identity", "contract", "scope", "delivery", "team", "review"]);
export function intakeOrigin(projectId: number, stage: string, item?: string): string {
  const query = new URLSearchParams({ stage: stages.has(stage) ? stage : "documents" });
  if (item && /^ji-[a-zA-Z0-9_-]{1,100}$/.test(item)) query.set("item", item);
  return `/projects/${projectId}/intake?${query}`;
}
export function validatedReturn(search: string, projectId: number): string | null {
  const raw = new URLSearchParams(search).get("returnTo");
  if (!raw || raw.length > 500 || !Number.isSafeInteger(projectId) || projectId < 1) return null;
  const [pathname, query = ""] = raw.split("?");
  if (pathname !== `/projects/${projectId}/intake` || raw.includes("#") || raw.includes("\\")) return null;
  const params = new URLSearchParams(query);
  const stage = params.get("stage") || "documents";
  if (!stages.has(stage) || [...params.keys()].some(key => !["stage", "item"].includes(key))) return null;
  const item = params.get("item");
  if (item && !/^ji-[a-zA-Z0-9_-]{1,100}$/.test(item)) return null;
  return intakeOrigin(projectId, stage, item || undefined);
}
export function withIntakeReturn(destination: string, projectId: number, stage: string, item?: string) {
  return `${destination}${destination.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(intakeOrigin(projectId, stage, item))}`;
}
