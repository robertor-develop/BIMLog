import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, projectMembersTable, filesTable } from "@workspace/db/schema";
import { eq, sql, count } from "drizzle-orm";
import { CreateProjectBody, GetProjectParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/projects", authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const memberProjects = await db
      .select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable)
      .where(eq(projectMembersTable.userId, userId));

    const projectIds = memberProjects.map((m) => m.projectId);
    if (projectIds.length === 0) {
      res.json([]);
      return;
    }

    const projects = await db
      .select()
      .from(projectsTable)
      .where(sql`${projectsTable.id} IN ${projectIds}`);

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

    const [project] = await db
      .insert(projectsTable)
      .values({
        name: body.name,
        description: body.description || null,
        code: body.code,
        createdById: userId,
      })
      .returning();

    await db.insert(projectMembersTable).values({
      projectId: project.id,
      userId,
      role: "project_admin",
    });

    res.status(201).json({
      ...project,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      memberCount: 1,
      fileCount: 0,
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

export default router;
