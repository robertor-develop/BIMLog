const stages = new Set(["documents", "identity", "contract", "scope", "delivery", "team", "review"]);
export type IntakeStage = "documents" | "identity" | "contract" | "scope" | "delivery" | "team" | "review";
export type IntakeReturnContext = { projectId: number; stage: IntakeStage; item?: string; href: string };

export function intakeReturnActionHref(context: IntakeReturnContext): string {
  const separator = context.href.includes("?") ? "&" : "?";
  return `${context.href}${separator}resume=prerequisite`;
}

export function parseIntakeReturn(search: string): IntakeReturnContext | null {
  const raw = new URLSearchParams(search).get("returnTo");
  if (!raw || raw.length > 500 || raw.includes("#") || raw.includes("\\")) return null;
  const [pathname, query = ""] = raw.split("?");
  const match = pathname.match(/^\/projects\/(\d+)\/intake$/);
  const projectId = Number(match?.[1]);
  if (!match || !Number.isSafeInteger(projectId) || projectId < 1) return null;
  const params = new URLSearchParams(query);
  const stage = (params.get("stage") || "documents") as IntakeStage;
  if (!stages.has(stage) || [...params.keys()].some(key => !["stage", "item"].includes(key))) return null;
  const item = params.get("item") || undefined;
  if (item && !/^ji-[a-zA-Z0-9_-]{1,100}$/.test(item)) return null;
  return { projectId, stage, item, href: intakeOrigin(projectId, stage, item) };
}
export function intakeOrigin(projectId: number, stage: string, item?: string): string {
  const query = new URLSearchParams({ stage: stages.has(stage) ? stage : "documents" });
  if (item && /^ji-[a-zA-Z0-9_-]{1,100}$/.test(item)) query.set("item", item);
  return `/projects/${projectId}/intake?${query}`;
}
export function validatedReturn(search: string, projectId: number): string | null {
  const context = parseIntakeReturn(search);
  return context?.projectId === projectId ? context.href : null;
}
export function withIntakeReturn(destination: string, projectId: number, stage: string, item?: string) {
  return `${destination}${destination.includes("?") ? "&" : "?"}returnTo=${encodeURIComponent(intakeOrigin(projectId, stage, item))}`;
}

/** Recovery on company-level prerequisites; the destination still enforces project access. */
export function intakePrerequisiteReturn(search: string): string | null {
  return parseIntakeReturn(search)?.href ?? null;
}
