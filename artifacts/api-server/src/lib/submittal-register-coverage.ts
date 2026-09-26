import { db } from "@workspace/db";
import { activityLogTable, linkedItemsTable, submittalsTable, submittalRegisterTable } from "@workspace/db/schema";
import { and, eq, isNull } from "drizzle-orm";

const relation = "register_package";
const requirementType = "submittal_register";

export class RegisterCoverageError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function deleteUnlinkedRegisterRequirement(projectId: number, requirementId: number) {
  return db.transaction(async tx => {
    const [requirement] = await tx.select({ id: submittalRegisterTable.id }).from(submittalRegisterTable)
      .where(and(eq(submittalRegisterTable.id, requirementId), eq(submittalRegisterTable.projectId, projectId))).for("update");
    if (!requirement) throw new RegisterCoverageError(404, "Requirement not found.");
    const links = await tx.select({ id: linkedItemsTable.id }).from(linkedItemsTable)
      .where(and(eq(linkedItemsTable.projectId, projectId), eq(linkedItemsTable.fromType, requirementType),
        eq(linkedItemsTable.fromId, requirementId), eq(linkedItemsTable.linkType, relation))).limit(1);
    if (links.length) throw new RegisterCoverageError(409, "Unlink the packages in Submittal Tracking before deleting this requirement.");
    await tx.delete(submittalRegisterTable).where(and(eq(submittalRegisterTable.id, requirementId), eq(submittalRegisterTable.projectId, projectId)));
  });
}

export async function readRegisterCoverage(projectId: number) {
  return db.transaction(async tx => {
    const requirements = await tx.select().from(submittalRegisterTable)
      .where(eq(submittalRegisterTable.projectId, projectId)).orderBy(submittalRegisterTable.id);
    const packages = await tx.select({
      id: submittalsTable.id, number: submittalsTable.number, title: submittalsTable.title,
      status: submittalsTable.status, revisionNumber: submittalsTable.revisionNumber,
      parentSubmittalId: submittalsTable.parentSubmittalId,
    }).from(submittalsTable).where(and(eq(submittalsTable.projectId, projectId), isNull(submittalsTable.deletedAt)))
      .orderBy(submittalsTable.id);
    const links = await tx.select({ requirementId: linkedItemsTable.fromId, packageId: linkedItemsTable.toId })
      .from(linkedItemsTable).where(and(eq(linkedItemsTable.projectId, projectId),
        eq(linkedItemsTable.fromType, requirementType), eq(linkedItemsTable.toType, "submittal"),
        eq(linkedItemsTable.linkType, relation)));
    // Missing/deleted endpoints never count as coverage. Legacy duplicate links count once.
    const requirementIds = new Set(requirements.map(item => item.id));
    const packageIds = new Set(packages.map(item => item.id));
    const seen = new Set<string>();
    return { requirements, packages, links: links.filter(link => {
      const key = `${link.requirementId}:${link.packageId}`;
      if (!requirementIds.has(link.requirementId) || !packageIds.has(link.packageId) || seen.has(key)) return false;
      seen.add(key); return true;
    }) };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

export async function changeRegisterPackageLink(input: {
  projectId: number; requirementId: number; packageId: number; remove: boolean;
  actor: { userId: number; fullName?: string | null; companyName?: string | null };
}) {
  const { projectId, requirementId, packageId, actor, remove } = input;
  if (![projectId, requirementId, packageId].every(id => Number.isSafeInteger(id) && id > 0))
    throw new RegisterCoverageError(400, "Valid requirement and package IDs are required.");
  return db.transaction(async tx => {
    // One requirement lock serializes repeated clicks and concurrent link/unlink requests.
    // It also serializes with the existing requirement DELETE without a new database schema.
    const [requirement] = await tx.select({ id: submittalRegisterTable.id }).from(submittalRegisterTable)
      .where(and(eq(submittalRegisterTable.id, requirementId), eq(submittalRegisterTable.projectId, projectId))).for("update");
    const [pkg] = await tx.select({ id: submittalsTable.id }).from(submittalsTable)
      .where(and(eq(submittalsTable.id, packageId), eq(submittalsTable.projectId, projectId), isNull(submittalsTable.deletedAt))).for("update");
    if (!requirement || !pkg) throw new RegisterCoverageError(404, "Requirement and package must exist in this project.");
    const scope = and(eq(linkedItemsTable.projectId, projectId), eq(linkedItemsTable.fromType, requirementType),
      eq(linkedItemsTable.fromId, requirementId), eq(linkedItemsTable.toType, "submittal"),
      eq(linkedItemsTable.toId, packageId), eq(linkedItemsTable.linkType, relation));
    const existing = await tx.select({ id: linkedItemsTable.id }).from(linkedItemsTable).where(scope);
    if (remove ? existing.length === 0 : existing.length > 0) return { changed: false };
    if (remove) await tx.delete(linkedItemsTable).where(scope);
    else await tx.insert(linkedItemsTable).values({ projectId, fromType: requirementType, fromId: requirementId,
      toType: "submittal", toId: packageId, linkType: relation, createdById: actor.userId });
    await tx.insert(activityLogTable).values({ projectId, userId: actor.userId,
      userFullName: actor.fullName ?? "", userCompanyName: actor.companyName ?? "",
      actionType: remove ? "unlink" : "link", entityType: requirementType, entityId: requirementId,
      details: `${remove ? "Unlinked" : "Linked"} requirement #${requirementId} and submittal #${packageId}` });
    return { changed: true };
  });
}
