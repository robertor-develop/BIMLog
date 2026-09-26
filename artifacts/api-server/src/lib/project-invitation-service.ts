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
import { createInvitationCredential, type InvitationPurpose } from "./invitation-token";
import { getRolesByPermission, validateConfigValue } from "../middlewares/config-validator";

export type InvitationTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function requireInvitationAuthority(tx: InvitationTransaction, input: { invitedByUserId: number; projectId: number; role: string; purpose?: string }) {
  const actor = (await tx.execute(sql`SELECT u.id,u.company_id,u.is_super_admin,c.name,c.retired_into_company_id
    FROM users u JOIN companies c ON c.id=u.company_id WHERE u.id=${input.invitedByUserId} FOR SHARE OF u,c`)).rows[0];
  if (!actor || actor.retired_into_company_id !== null) throw new Error("INVITATION_AUTHORITY_DENIED");
  const roles = await getRolesByPermission("admin");
  const membership = (await tx.execute(sql`SELECT role FROM project_members WHERE project_id=${input.projectId}
    AND user_id=${input.invitedByUserId} AND status='active' FOR SHARE`)).rows[0];
  if (!actor.is_super_admin && (!membership || !roles.includes(String(membership.role)))) throw new Error("INVITATION_AUTHORITY_DENIED");
  if (!(await validateConfigValue("member_role", input.role))) throw new Error("INVITATION_ROLE_INVALID");
  if (input.purpose === "company_join" && !actor.is_super_admin) {
    const grant = (await tx.execute(sql`SELECT user_id FROM company_master_catalog_administrators
      WHERE company_id=${Number(actor.company_id)} AND user_id=${input.invitedByUserId} AND state='active' FOR SHARE`)).rows[0];
    if (!grant) throw new Error("INVITATION_COMPANY_AUTHORITY_REQUIRED");
  }
  return { companyId: Number(actor.company_id), companyName: String(actor.name) };
}

type ProjectInvitationActionResult =
  | {
      kind: "existing";
      user: typeof usersTable.$inferSelect;
      member: typeof projectMembersTable.$inferSelect;
      alreadyMember: boolean;
    }
  | { kind: "not_found"; email: string }
  | { kind: "invited"; row: typeof projectInvitations.$inferSelect; token: string };

export async function inviteOrAddProjectMember(input: {
  projectId: number;
  invitedByUserId: number;
  email: unknown;
  fullName?: string | null;
  role: string;
  existingOnly?: boolean;
  purpose?: InvitationPurpose;
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
    const authority = await requireInvitationAuthority(tx, input);
    const inviter = [authority];

    const existingUser = await tx
      .select()
      .from(usersTable)
      .where(sql`lower(trim(${usersTable.email})) = ${email}`)
      .limit(2);
    if (existingUser.length > 1)
      throw new Error(
        "Multiple accounts use this normalized email. An administrator must repair the duplicate identities before membership can change.",
      );
    if (existingUser[0] && input.existingOnly) {
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
    const credential = createInvitationCredential();
    const values = {
      invitedByUserId: input.invitedByUserId,
      companyId: inviter[0].companyId,
      email,
      fullName: input.fullName?.trim() || null,
      companyName: inviter[0].companyName,
      role: input.role,
      purpose: input.purpose ?? "project_collaboration",
      tokenHash: credential.tokenHash,
      expiresAt: credential.expiresAt,
      revokedAt: null,
      deliveryStatus: "not_sent",
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
    return { kind: "invited" as const, row, token: credential.token };
  });
}
