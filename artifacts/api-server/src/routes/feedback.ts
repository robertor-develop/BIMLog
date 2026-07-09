import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  feedbackItemsTable,
  projectMembersTable,
  projectsTable,
  usersTable,
} from "@workspace/db/schema";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";

const router = Router();

const FEEDBACK_TYPES = new Set(["bug", "workflow", "idea", "question", "other"]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const STATUSES = new Set(["open", "in_review", "planned", "done", "rejected"]);

function asPositiveInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

router.post("/feedback", authMiddleware, async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const feedbackType = String(req.body.feedbackType || "").trim();
    const priority = String(req.body.priority || "normal").trim();
    const message = String(req.body.message || "").trim();
    const moduleName = String(req.body.module || "").trim();
    const pageUrl = String(req.body.pageUrl || "").trim();
    const projectId = asPositiveInt(req.body.projectId);

    if (!FEEDBACK_TYPES.has(feedbackType)) {
      return res.status(400).json({ error: "Invalid feedback type" });
    }
    if (!PRIORITIES.has(priority)) {
      return res.status(400).json({ error: "Invalid priority" });
    }
    if (!message) {
      return res.status(400).json({ error: "Feedback message is required" });
    }
    if (!pageUrl) {
      return res.status(400).json({ error: "Page URL is required" });
    }

    if (projectId && !user.isSuperAdmin) {
      const membership = await db
        .select({ id: projectMembersTable.id })
        .from(projectMembersTable)
        .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.userId)))
        .limit(1);
      if (!membership.length) {
        return res.status(403).json({ error: "You do not have access to this project" });
      }
    }

    const rawMetadata = req.body.metadata && typeof req.body.metadata === "object" && !Array.isArray(req.body.metadata)
      ? req.body.metadata
      : {};

    const [created] = await db
      .insert(feedbackItemsTable)
      .values({
        userId: user.userId,
        projectId,
        feedbackType,
        priority,
        module: moduleName || null,
        pageUrl,
        message,
        metadata: {
          ...rawMetadata,
          userAgent: req.get("user-agent") || null,
        },
      })
      .returning();

    return res.status(201).json({ success: true, feedback: created });
  } catch (error) {
    console.error("[feedback] create failed", error);
    return res.status(500).json({ error: "Failed to submit feedback" });
  }
});

router.get("/feedback/admin", authMiddleware, isSuperAdminMiddleware, async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: feedbackItemsTable.id,
        userId: feedbackItemsTable.userId,
        userEmail: usersTable.email,
        userFullName: usersTable.fullName,
        projectId: feedbackItemsTable.projectId,
        projectName: projectsTable.name,
        projectCode: projectsTable.code,
        feedbackType: feedbackItemsTable.feedbackType,
        priority: feedbackItemsTable.priority,
        module: feedbackItemsTable.module,
        pageUrl: feedbackItemsTable.pageUrl,
        message: feedbackItemsTable.message,
        status: feedbackItemsTable.status,
        metadata: feedbackItemsTable.metadata,
        createdAt: feedbackItemsTable.createdAt,
        updatedAt: feedbackItemsTable.updatedAt,
        resolvedAt: feedbackItemsTable.resolvedAt,
      })
      .from(feedbackItemsTable)
      .leftJoin(usersTable, eq(feedbackItemsTable.userId, usersTable.id))
      .leftJoin(projectsTable, eq(feedbackItemsTable.projectId, projectsTable.id))
      .orderBy(desc(feedbackItemsTable.createdAt))
      .limit(200);

    return res.json({ feedback: rows });
  } catch (error) {
    console.error("[feedback] admin list failed", error);
    return res.status(500).json({ error: "Failed to load feedback" });
  }
});

router.patch("/feedback/admin/:id", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  try {
    const id = asPositiveInt(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid feedback id" });

    const status = String(req.body.status || "").trim();
    if (!STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid feedback status" });
    }

    const [updated] = await db
      .update(feedbackItemsTable)
      .set({
        status,
        updatedAt: new Date(),
        resolvedAt: status === "done" || status === "rejected" ? new Date() : null,
      })
      .where(eq(feedbackItemsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Feedback not found" });
    return res.json({ success: true, feedback: updated });
  } catch (error) {
    console.error("[feedback] status update failed", error);
    return res.status(500).json({ error: "Failed to update feedback" });
  }
});

export default router;
