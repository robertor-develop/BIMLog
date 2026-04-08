import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, projectMembersTable, filesTable, rfisTable, submittalsTable, activityLogTable, namingConventionsTable, namingFieldsTable, usersTable, companiesTable } from "@workspace/db/schema";
import { eq, ne, count, inArray, and, sql, ilike } from "drizzle-orm";
import { CreateProjectBody, GetProjectParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import { getRolesByPermission, getDefaultValue } from "../middlewares/config-validator";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

router.get("/projects", authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const memberRows = await db
      .select({ projectId: projectMembersTable.projectId, role: projectMembersTable.role })
      .from(projectMembersTable)
      .where(eq(projectMembersTable.userId, userId));

    const projectIds = memberRows.map((m) => m.projectId);
    if (projectIds.length === 0) {
      res.json([]);
      return;
    }

    const roleMap: Record<number, string> = {};
    memberRows.forEach(m => { roleMap[m.projectId] = m.role; });

    const projects = await db
      .select()
      .from(projectsTable)
      .where(inArray(projectsTable.id, projectIds));

    const results = await Promise.all(
      projects.map(async (p) => {
        const [memberCount] = await db
          .select({ count: count() })
          .from(projectMembersTable)
          .where(eq(projectMembersTable.projectId, p.id));

        const [fileCount] = await db
          .select({ count: count() })
          .from(filesTable)
          .where(eq(filesTable.projectId, p.id));

        return {
          ...p,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
          memberCount: memberCount.count,
          fileCount: fileCount.count,
          userRole: roleMap[p.id] || "",
        };
      })
    );

    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/projects", authMiddleware, async (req, res) => {
  try {
    const body = CreateProjectBody.parse(req.body);
    const userId = req.user!.userId;

    const existing = await db.select({ id: projectsTable.id, name: projectsTable.name })
      .from(projectsTable)
      .where(and(eq(projectsTable.code, body.code), ne(projectsTable.status, "archived")))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: `An active project with code "${body.code}" already exists (ID ${existing[0].id}: "${existing[0].name}"). Archive it first or use a different code.` });
      return;
    }

    const defaultStatus = await getDefaultValue("project_status");
    const [project] = await db
      .insert(projectsTable)
      .values({
        name: body.name,
        description: body.description || null,
        code: body.code,
        status: defaultStatus,
        createdById: userId,
      })
      .returning();

    const adminRoles = await getRolesByPermission("admin");
    if (adminRoles.length === 0) {
      res.status(500).json({ error: "No admin role configured. Seed the config_options table with member_role entries." });
      return;
    }
    await db.insert(projectMembersTable).values({
      projectId: project.id,
      userId,
      role: adminRoles[0],
    });

    res.status(201).json({
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      memberCount: 1,
      fileCount: 0,
      userRole: adminRoles[0],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

router.get("/projects/:projectId", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = GetProjectParams.parse({ projectId: req.params.projectId });

    const projects = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId))
      .limit(1);

    if (projects.length === 0) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const p = projects[0];

    const [memberCount] = await db
      .select({ count: count() })
      .from(projectMembersTable)
      .where(eq(projectMembersTable.projectId, p.id));

    const [fileCount] = await db
      .select({ count: count() })
      .from(filesTable)
      .where(eq(filesTable.projectId, p.id));

    res.json({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      memberCount: memberCount.count,
      fileCount: fileCount.count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.delete("/projects/:projectId", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = GetProjectParams.parse({ projectId: req.params.projectId });
    const userId = req.user!.userId;

    const memberRow = await db
      .select()
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, userId)))
      .limit(1);

    if (memberRow.length === 0) {
      res.status(403).json({ error: "Not a project member." });
      return;
    }

    const adminRoles = await getRolesByPermission("admin");
    const isAdmin = adminRoles.includes(memberRow[0].role);

    const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const isCreator = project.length > 0 && project[0].createdById === userId;

    if (!isAdmin && !isCreator) {
      res.status(403).json({ error: "Only project admins or the project creator can delete a project." });
      return;
    }

    const conventions = await db
      .select({ id: namingConventionsTable.id })
      .from(namingConventionsTable)
      .where(eq(namingConventionsTable.projectId, projectId));

    if (conventions.length > 0) {
      const convIds = conventions.map(c => c.id);
      await db.delete(namingFieldsTable).where(inArray(namingFieldsTable.conventionId, convIds));
    }

    await db.delete(namingConventionsTable).where(eq(namingConventionsTable.projectId, projectId));
    await db.delete(filesTable).where(eq(filesTable.projectId, projectId));
    await db.delete(rfisTable).where(eq(rfisTable.projectId, projectId));
    await db.delete(submittalsTable).where(eq(submittalsTable.projectId, projectId));
    await db.delete(activityLogTable).where(eq(activityLogTable.projectId, projectId));
    await db.delete(projectMembersTable).where(eq(projectMembersTable.projectId, projectId));
    await db.delete(projectsTable).where(eq(projectsTable.id, projectId));

    res.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.post("/projects/:projectId/assign-company-user", authMiddleware, requireProjectMember("project_admin"), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const { companyCode, userId, newUserData } = req.body as {
      companyCode: string;
      userId?: number;
      newUserData?: { fullName: string; email: string; companyName: string };
    };

    if (!companyCode) {
      res.status(400).json({ error: "companyCode is required" });
      return;
    }

    const project = (await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1))[0];
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    let assignUserId: number;

    if (userId) {
      const existingUser = (await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
      if (!existingUser) { res.status(404).json({ error: "User not found" }); return; }
      assignUserId = existingUser.id;
    } else if (newUserData) {
      if (!newUserData.fullName || !newUserData.email || !newUserData.companyName) {
        res.status(400).json({ error: "newUserData requires fullName, email, companyName" });
        return;
      }

      const existingByEmail = (await db.select().from(usersTable).where(eq(usersTable.email, newUserData.email.toLowerCase())).limit(1))[0];
      if (existingByEmail) {
        assignUserId = existingByEmail.id;
      } else {
        let company = (await db.select().from(companiesTable).where(ilike(companiesTable.name, newUserData.companyName)).limit(1))[0];
        if (!company) {
          [company] = await db.insert(companiesTable).values({ name: newUserData.companyName }).returning();
        }

        const tempPassword = await bcrypt.hash(`temp-${Date.now()}`, 10);
        const [newUser] = await db.insert(usersTable).values({
          email: newUserData.email.toLowerCase(),
          fullName: newUserData.fullName,
          companyId: company.id,
          passwordHash: tempPassword,
        }).returning();
        assignUserId = newUser.id;
      }
    } else {
      res.status(400).json({ error: "Either userId or newUserData is required" });
      return;
    }

    const existingMember = (await db.select().from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, assignUserId))).limit(1))[0];

    if (existingMember) {
      res.json({ ok: true, message: "User already a project member", memberId: existingMember.id, userId: assignUserId });
      return;
    }

    const [member] = await db.insert(projectMembersTable).values({
      projectId,
      userId: assignUserId,
      role: "viewer",
      status: "active",
    }).returning();

    const user = (await db.select({ fullName: usersTable.fullName, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, assignUserId)).limit(1))[0];

    res.json({
      ok: true,
      memberId: member.id,
      userId: assignUserId,
      userName: user?.fullName,
      userEmail: user?.email,
      companyCode,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;
