export type RfiActor = {
  userId: number;
  fullName?: string | null;
  companyName?: string | null;
  isSuperAdmin?: boolean;
};

export function canAdministerRfi(actor: Pick<RfiActor, "isSuperAdmin">, projectRole?: string | null): boolean {
  return actor.isSuperAdmin === true || projectRole === "project_admin";
}

export function rfiAuditRecord(input: {
  projectId: number;
  rfiId: number;
  actor: RfiActor;
  actionType: string;
  details: Record<string, unknown>;
}) {
  return {
    projectId: input.projectId,
    userId: input.actor.userId,
    userFullName: input.actor.fullName || "User",
    userCompanyName: input.actor.companyName || "",
    actionType: input.actionType,
    entityType: "rfi",
    entityId: input.rfiId,
    details: JSON.stringify(input.details),
  } as const;
}

export function requireProjectScopedRfi(input: { routeProjectId: number; recordProjectId: number; routeRfiId: number; recordRfiId: number }): void {
  if (input.routeProjectId !== input.recordProjectId || input.routeRfiId !== input.recordRfiId) {
    throw new Error("RFI_PROJECT_OBJECT_SCOPE_MISMATCH");
  }
}
