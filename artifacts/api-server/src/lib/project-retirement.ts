import { db } from "@workspace/db";
import { adminActionsLogTable, filesTable, projectMembersTable, projectsTable, usersTable } from "@workspace/db/schema";
import { and, count, eq } from "drizzle-orm";

export const COMPLETE_PROJECT_DEPENDENT_TABLE_COUNT = 137;

export class ProjectRetirementError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message); this.name = "ProjectRetirementError";
  }
}

type Actor = { userId: number; email: string };
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = typeof db | Tx;

async function requireAuthority(executor: Executor, actor: Actor, project: { id: number; createdById: number }, adminRoles: string[]) {
  const [fresh] = await executor.select({ email: usersTable.email, isSuperAdmin: usersTable.isSuperAdmin })
    .from(usersTable).where(eq(usersTable.id, actor.userId)).limit(1);
  if (!fresh || fresh.email.toLowerCase() !== actor.email.toLowerCase())
    throw new ProjectRetirementError("PROJECT_RETIREMENT_ACTOR_MISMATCH", 403, "The authenticated actor could not be verified.");
  if (fresh.isSuperAdmin || project.createdById === actor.userId) return fresh.email;
  const [member] = await executor.select({ role: projectMembersTable.role, status: projectMembersTable.status })
    .from(projectMembersTable).where(and(eq(projectMembersTable.projectId, project.id), eq(projectMembersTable.userId, actor.userId))).limit(1);
  if (!member || member.status !== "active" || !adminRoles.includes(member.role))
    throw new ProjectRetirementError("PROJECT_RETIREMENT_FORBIDDEN", 403, "Only an authorized project administrator can retire this project.");
  return fresh.email;
}

async function counts(executor: Executor, projectId: number) {
  const [[members], [files]] = await Promise.all([
    executor.select({ count: count() }).from(projectMembersTable).where(eq(projectMembersTable.projectId, projectId)),
    executor.select({ count: count() }).from(filesTable).where(eq(filesTable.projectId, projectId)),
  ]);
  return { memberCount: Number(members.count), fileCount: Number(files.count) };
}

export async function previewProjectRetirement(actor: Actor, projectId: number, adminRoles: string[]) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) throw new ProjectRetirementError("PROJECT_NOT_FOUND", 404, "Project not found.");
  await requireAuthority(db, actor, project, adminRoles);
  return { projectId, projectName: project.name, projectCode: project.code, currentStatus: project.status,
    expectedUpdatedAt: project.updatedAt.toISOString(), confirmationText: project.code, strategy: "archive",
    completeProjectDependentTableCount: COMPLETE_PROJECT_DEPENDENT_TABLE_COUNT, recordsPreserved: true,
    ...(await counts(db, projectId)) };
}

export async function retireProject(actor: Actor, projectId: number, adminRoles: string[], input: { confirmation?: unknown; expectedUpdatedAt?: unknown }) {
  return db.transaction(async (tx) => {
    const [project] = await tx.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) throw new ProjectRetirementError("PROJECT_NOT_FOUND", 404, "Project not found.");
    const email = await requireAuthority(tx, actor, project, adminRoles);
    if (input.confirmation !== project.code)
      throw new ProjectRetirementError("PROJECT_RETIREMENT_CONFIRMATION_MISMATCH", 409, `Type the exact project code "${project.code}" to confirm retirement.`);
    if (input.expectedUpdatedAt !== project.updatedAt.toISOString())
      throw new ProjectRetirementError("PROJECT_RETIREMENT_PREVIEW_STALE", 409, "The project changed after the retirement preview.");
    if (project.status === "archived") return { retired: true, alreadyRetired: true, projectId, status: "archived" };
    const impact = await counts(tx, projectId);
    const retiredAt = new Date();
    const [updated] = await tx.update(projectsTable).set({ status: "archived", updatedAt: retiredAt })
      .where(and(eq(projectsTable.id, projectId), eq(projectsTable.updatedAt, project.updatedAt))).returning();
    if (!updated) throw new ProjectRetirementError("PROJECT_RETIREMENT_CONCURRENT_CHANGE", 409, "The project changed during retirement. No retirement was committed.");
    await tx.insert(adminActionsLogTable).values({ adminUserId: actor.userId, adminEmail: email, action: "retire_project",
      targetType: "project", targetId: String(projectId), details: { projectName: project.name, projectCode: project.code,
        previousStatus: project.status, newStatus: "archived", retiredAt: retiredAt.toISOString(), strategy: "archive",
        completeProjectDependentTableCount: COMPLETE_PROJECT_DEPENDENT_TABLE_COUNT, recordsPreserved: true, ...impact } });
    return { retired: true, alreadyRetired: false, projectId, status: "archived", retiredAt: retiredAt.toISOString(),
      completeProjectDependentTableCount: COMPLETE_PROJECT_DEPENDENT_TABLE_COUNT, recordsPreserved: true, ...impact };
  });
}
