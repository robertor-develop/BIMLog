import { db } from "@workspace/db";
import { companiesTable, projectDirectoryTable, projectMembersTable, usersTable, namingConventionsTable, namingFieldsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { conventionCompanyCodes, uniqueProjectCompanyLabels } from "@workspace/api-zod";

/** Caller must authorize membership first. All reads remain bound to projectId. */
export async function loadProjectCompanyChoices(projectId: number) {
  const [directory, members, conventions] = await Promise.all([
    db.select({ name: projectDirectoryTable.companyName }).from(projectDirectoryTable).where(eq(projectDirectoryTable.projectId, projectId)),
    db.select({ name: companiesTable.name }).from(projectMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, projectMembersTable.userId))
      .innerJoin(companiesTable, eq(companiesTable.id, usersTable.companyId))
      .where(eq(projectMembersTable.projectId, projectId)),
    db.select().from(namingConventionsTable).where(eq(namingConventionsTable.projectId, projectId)).limit(1),
  ]);
  const convention = conventions[0];
  const fields = convention ? await db.select().from(namingFieldsTable).where(eq(namingFieldsTable.conventionId, convention.id)) : [];
  const codes = conventionCompanyCodes(convention ? { companyCode: convention.companyCode, fields } : null);
  return { companies: uniqueProjectCompanyLabels([...directory.map(row => row.name), ...members.map(row => row.name), ...codes]), conventionCodes: codes };
}
