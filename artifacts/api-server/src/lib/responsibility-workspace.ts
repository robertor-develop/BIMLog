import type { CoordinatorActionItem, CoordinatorActionModule } from "./coordinator-action-register";

export type ResponsibilityContextGap =
  | "OWNER_MISSING"
  | "DEADLINE_MISSING"
  | "PROJECT_CONTEXT_MISSING";

export type ResponsibilityWorkspaceItem = {
  key: string;
  sourceIdentity: {
    module: CoordinatorActionModule;
    recordId: number;
  };
  project: {
    id: number;
    name: string;
    code: string;
  };
  title: string;
  status: string;
  owner: {
    userId: number | null;
    person: string | null;
    company: string | null;
  };
  deadline: string | null;
  sourceUpdatedAt: string | null;
  authorizedLink: string;
  contextGaps: ResponsibilityContextGap[];
  lensEvidence: {
    serverId: number;
    displayId: string | null;
    authorizedLink: string;
  } | null;
};

function authorizedProjectLink(projectId: number, value: string): string {
  const path = value.trim();
  const prefix = `/projects/${projectId}/`;
  if (!path.startsWith(prefix) || path.startsWith("//") || path.includes("\\")) {
    throw new Error("Responsibility source link escaped the authorized project scope");
  }
  return path;
}

export function projectResponsibilityItems(input: {
  project: { id: number; name?: string | null; code?: string | null };
  actions: CoordinatorActionItem[];
}): ResponsibilityWorkspaceItem[] {
  const projectName = String(input.project.name ?? "").trim();
  const projectCode = String(input.project.code ?? "").trim();
  const seen = new Set<string>();
  const projected: ResponsibilityWorkspaceItem[] = [];

  for (const action of input.actions) {
    if (action.projectId !== input.project.id) throw new Error("Responsibility source project mismatch");
    const sourceKey = `${action.sourceModule}:${action.sourceId}`;
    if (seen.has(sourceKey)) continue;
    seen.add(sourceKey);

    const gaps: ResponsibilityContextGap[] = [];
    if (!action.responsibility.userId && !action.responsibility.person && !action.responsibility.company)
      gaps.push("OWNER_MISSING");
    if (!action.dueAt) gaps.push("DEADLINE_MISSING");
    if (!projectName || !projectCode) gaps.push("PROJECT_CONTEXT_MISSING");

    projected.push({
      key: `${input.project.id}:${sourceKey}`,
      sourceIdentity: { module: action.sourceModule, recordId: action.sourceId },
      project: { id: input.project.id, name: projectName, code: projectCode },
      title: action.title,
      status: action.presentationStatus,
      owner: {
        userId: action.responsibility.userId,
        person: action.responsibility.person,
        company: action.responsibility.company,
      },
      deadline: action.dueAt,
      sourceUpdatedAt: action.sourceUpdatedAt,
      authorizedLink: authorizedProjectLink(input.project.id, action.internalLink),
      contextGaps: gaps,
      lensEvidence: action.related.lens
        ? {
            serverId: action.related.lens.serverId,
            displayId: action.related.lens.displayId,
            authorizedLink: `/projects/${input.project.id}/clash-reports?view=lens&viewpoint=${action.related.lens.serverId}`,
          }
        : null,
    });
  }
  return projected;
}
