import { Router } from "express";
import { db } from "@workspace/db";
import { linkedItemsTable, activityLogTable } from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";

const router: Router = Router();

// GET all links for a specific entity
router.get("/projects/:projectId/links/:entityType/:entityId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const entityType = String(req.params.entityType);
  const entityId = Number(req.params.entityId);
  try {
    const links = await db.select().from(linkedItemsTable)
      .where(and(
        eq(linkedItemsTable.projectId, projectId),
        or(
          and(eq(linkedItemsTable.fromType, entityType), eq(linkedItemsTable.fromId, entityId)),
          and(eq(linkedItemsTable.toType, entityType), eq(linkedItemsTable.toId, entityId))
        )
      ));
    res.json(links);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// POST create a link
router.post("/projects/:projectId/links", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const { fromType, fromId, toType, toId, linkType, notes } = req.body ?? {};
  try {
    // Check if link already exists
    const existing = await db.select().from(linkedItemsTable)
      .where(and(
        eq(linkedItemsTable.projectId, projectId),
        eq(linkedItemsTable.fromType, fromType),
        eq(linkedItemsTable.fromId, fromId),
        eq(linkedItemsTable.toType, toType),
        eq(linkedItemsTable.toId, toId)
      ));
    if (existing.length > 0) {
      res.json({ existing: true, link: existing[0] });
      return;
    }
    const [link] = await db.insert(linkedItemsTable).values({
      projectId,
      fromType,
      fromId,
      toType,
      toId,
      linkType: linkType || "related",
      notes: notes || null,
      createdById: req.user!.userId,
    }).returning();
    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName ?? "",
      userCompanyName: req.user!.companyName ?? "",
      actionType: "link",
      entityType: fromType,
      entityId: fromId,
      details: `Linked ${fromType} #${fromId} to ${toType} #${toId} (${linkType || "related"})`,
    });
    res.status(201).json(link);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// DELETE a link
router.delete("/projects/:projectId/links/:linkId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const linkId = Number(req.params.linkId);
  try {
    const [existing] = await db.select().from(linkedItemsTable)
      .where(and(eq(linkedItemsTable.id, linkId), eq(linkedItemsTable.projectId, projectId)));
    await db.delete(linkedItemsTable)
      .where(and(eq(linkedItemsTable.id, linkId), eq(linkedItemsTable.projectId, projectId)));
    if (existing) {
      await db.insert(activityLogTable).values({
        projectId,
        userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "",
        userCompanyName: req.user!.companyName ?? "",
        actionType: "unlink",
        entityType: existing.fromType,
        entityId: existing.fromId,
        details: `Unlinked ${existing.fromType} #${existing.fromId} from ${existing.toType} #${existing.toId} (${existing.linkType})`,
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
