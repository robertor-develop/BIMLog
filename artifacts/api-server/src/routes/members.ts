import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectMembersTable, usersTable, companiesTable, activityLogTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { AddMemberBody, UpdateMemberBody, ListMembersParams, AddMemberParams, UpdateMemberParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/projects/:projectId/members", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListMembersParams.parse({ projectId: req.params.projectId });

    const members = await db
      .select()
      .from(projectMembersTable)
      .where(eq(projectMembersTable.projectId, projectId));

    const results = await Promise.all(
      members.map(async (m) => {
        const user = await db.select().from(usersTable).where(eq(usersTable.id, m.userId)).limit(1);
        let companyName = "";
        if (user[0]) {
          const company = await db.select().from(companiesTable).where(eq(companiesTable.id, user[0].companyId)).limit(1);
          companyName = company[0]?.name || "";
        }
        return {
          id: m.id,
          projectId: m.projectId,
          userId: m.userId,
          userFullName: user[0]?.fullName || "",
          userEmail: user[0]?.email || "",
          userCompanyName: companyName,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        };
      })
    );

    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/projects/:projectId/members", authMiddleware, requireProjectMember("project_admin", "company_lead"), async (req, res) => {
  try {
    const { projectId } = AddMemberParams.parse({ projectId: req.params.projectId });
    const body = AddMemberBody.parse(req.body);

    const users = await db.select().from(usersTable).where(eq(usersTable.email, body.email)).limit(1);
    if (users.length === 0) {
      res.status(404).json({ error: "User not found with that email" });
      return;
    }

    const user = users[0];

    const existing = await db
      .select()
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.id)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "User is already a member of this project" });
      return;
    }

    const [member] = await db.insert(projectMembersTable).values({
      projectId,
      userId: user.id,
      role: body.role,
    }).returning();

    const company = await db.select().from(companiesTable).where(eq(companiesTable.id, user.companyId)).limit(1);

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "add_member",
      entityType: "member",
      entityId: member.id,
      details: `Added ${user.fullName} as ${body.role}`,
    });

    res.status(201).json({
      id: member.id,
      projectId: member.projectId,
      userId: member.userId,
      userFullName: user.fullName,
      userEmail: user.email,
      userCompanyName: company[0]?.name || "",
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

router.patch("/projects/:projectId/members/:memberId", authMiddleware, requireProjectMember("project_admin"), async (req, res) => {
  try {
    const { projectId, memberId } = UpdateMemberParams.parse({ projectId: req.params.projectId, memberId: req.params.memberId });
    const body = UpdateMemberBody.parse(req.body);

    const existing = await db
      .select()
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.id, memberId), eq(projectMembersTable.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    const [updated] = await db
      .update(projectMembersTable)
      .set({ role: body.role })
      .where(eq(projectMembersTable.id, memberId))
      .returning();

    const user = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
    const company = await db.select().from(companiesTable).where(eq(companiesTable.id, user[0]?.companyId || 0)).limit(1);

    res.json({
      id: updated.id,
      projectId: updated.projectId,
      userId: updated.userId,
      userFullName: user[0]?.fullName || "",
      userEmail: user[0]?.email || "",
      userCompanyName: company[0]?.name || "",
      role: updated.role,
      joinedAt: updated.joinedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

router.delete("/projects/:projectId/members/:memberId", authMiddleware, requireProjectMember("project_admin"), async (req, res) => {
  try {
    const { projectId, memberId } = UpdateMemberParams.parse({ projectId: req.params.projectId, memberId: req.params.memberId });

    const existing = await db
      .select()
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.id, memberId), eq(projectMembersTable.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    await db.delete(projectMembersTable).where(eq(projectMembersTable.id, memberId));

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;
