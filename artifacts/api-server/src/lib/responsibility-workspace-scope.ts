import type { ResponsibilityWorkspaceItem } from "./responsibility-workspace";

export const RESPONSIBILITY_SCOPES = ["my_work", "my_company", "authorized_projects"] as const;
export type ResponsibilityScope = typeof RESPONSIBILITY_SCOPES[number];

function normalized(value: string | null | undefined): string {
  return String(value ?? "").trim().toLocaleLowerCase("en-US");
}

export function parseResponsibilityScope(value: unknown): ResponsibilityScope {
  const scope = String(value ?? "my_work").trim().toLowerCase();
  if (!RESPONSIBILITY_SCOPES.includes(scope as ResponsibilityScope))
    throw new Error("RESPONSIBILITY_SCOPE_INVALID");
  return scope as ResponsibilityScope;
}

export function scopeResponsibilityItems(input: {
  items: ResponsibilityWorkspaceItem[];
  scope: ResponsibilityScope;
  userId: number;
  companyName: string;
}): ResponsibilityWorkspaceItem[] {
  if (input.scope === "authorized_projects") return [...input.items];
  if (input.scope === "my_work")
    return input.items.filter((item) => item.owner.userId === input.userId);
  const company = normalized(input.companyName);
  if (!company) return [];
  return input.items.filter((item) => normalized(item.owner.company) === company);
}
