import { db } from "@workspace/db";
import {
  companiesTable,
  projectInvitations,
  projectMembersTable,
  usersTable,
} from "@workspace/db/schema";
import { and, eq, sql } from "drizzle-orm";
import {
  invitationEmailLockKey,
  normalizeInvitationEmail,
  projectInvitationLockKey,
} from "./project-invitation-contract";
import { waitForProjectInvitationMigration } from "./project-invitation-migration";

type ProjectInvitationActionResult =
  | {
      kind: "existing";
      user: typeof usersTable.$inferSelect;
      member: typeof projectMembersTable.$inferSelect;
      alreadyMember: boolean;
    }
  | { kind: "not_found"; email: string }
  | { kind: "invited"; row: typeof projectInvitations.$inferSelect };

export async function inviteOrAddProjectMember(input: {
  projectId: number;
  invitedByUserId: number;
  email: unknown;
  fullName?: string | null;
  role: string;
  existingOnly?: boolean;
}): Promise<ProjectInvitationActionResult> {
  await waitForProjectInvitationMigration();
  const email = normalizeInvitationEmail(input.email);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${invitationEmailLockKey(email)}))`,
    );
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${projectInvitationLockKey(input.projectId, email)}))`,
    );
    const inviter = await tx
      .select({
        companyId: usersTable.companyId,
        companyName: companiesTable.name,
      })
      .from(usersTable)
      .innerJoin(companiesTable, eq(companiesTable.id, usersTable.companyId))
      .where(eq(usersTable.id, input.invitedByUserId))
      .limit(1);
    if (!inviter[0]) throw new Error("Inviting user or company not found");

    const existingUser = await tx
      .select()
      .from(usersTable)
      .where(sql`lower(trim(${usersTable.email})) = ${email}`)
      .limit(2);
    if (existingUser.length > 1)
      throw new Error(
        "Multiple accounts use this normalized email. An administrator must repair the duplicate identities before membership can change.",
      );
    if (existingUser[0]) {
      const existingMember = await tx
        .select()
        .from(projectMembersTable)
        .where(
          and(
            eq(projectMembersTable.projectId, input.projectId),
            eq(projectMembersTable.userId, existingUser[0].id),
          ),
        )
        .limit(1);
      const member =
        existingMember[0] ??
        (
          await tx
            .insert(projectMembersTable)
            .values({
              projectId: input.projectId,
              userId: existingUser[0].id,
              role: input.role,
              status: "active",
            })
            .returning()
        )[0];
      if (!member) throw new Error("Project membership could not be created");
      return {
        kind: "existing" as const,
        user: existingUser[0],
        member,
        alreadyMember: Boolean(existingMember[0]),
      };
    }
    if (input.existingOnly) return { kind: "not_found" as const, email };

    const pending = await tx
      .select()
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.projectId, input.projectId),
          sql`lower(trim(${projectInvitations.email})) = ${email}`,
          eq(projectInvitations.status, "pending"),
        ),
      )
      .limit(1);
    const values = {
      invitedByUserId: input.invitedByUserId,
      companyId: inviter[0].companyId,
      email,
      fullName: input.fullName?.trim() || null,
      companyName: inviter[0].companyName,
      role: input.role,
    };
    const [row] = pending[0]
      ? await tx
          .update(projectInvitations)
          .set(values)
          .where(eq(projectInvitations.id, pending[0].id))
          .returning()
      : await tx
          .insert(projectInvitations)
          .values({ projectId: input.projectId, ...values, status: "pending" })
          .returning();
    if (!row) throw new Error("Project invitation could not be created");
    return { kind: "invited" as const, row };
  });
}
