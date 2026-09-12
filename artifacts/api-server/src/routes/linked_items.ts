import { Router } from "express";
import { db } from "@workspace/db";
import {
  linkedItemsTable,
  activityLogTable,
  rfisTable,
  submittalsTable,
  transmittalsTable,
  changeOrdersTable,
  meetingMinutesTable,
  filesTable,
  clashesTable,
  lensViewpointsTable,
} from "@workspace/db/schema";
import { eq, and, or } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";

const router: Router = Router();

const linkEntityTypes = ["rfi", "submittal", "transmittal", "change_order", "meeting", "file", "clash", "lens_viewpoint"] as const;
type LinkEntityType = typeof linkEntityTypes[number];

function isLinkEntityType(value: unknown): value is LinkEntityType {
  return typeof value === "string" && linkEntityTypes.includes(value as LinkEntityType);
}

async function entityBelongsToProject(entityType: LinkEntityType, entityId: number, projectId: number): Promise<boolean> {
  let rows: { id: number }[];
  switch (entityType) {
    case "rfi": rows = await db.select({ id: rfisTable.id }).from(rfisTable).where(and(eq(rfisTable.id, entityId), eq(rfisTable.projectId, projectId))).limit(1); break;
    case "submittal": rows = await db.select({ id: submittalsTable.id }).from(submittalsTable).where(and(eq(submittalsTable.id, entityId), eq(submittalsTable.projectId, projectId))).limit(1); break;
    case "transmittal": rows = await db.select({ id: transmittalsTable.id }).from(transmittalsTable).where(and(eq(transmittalsTable.id, entityId), eq(transmittalsTable.projectId, projectId))).limit(1); break;
    case "change_order": rows = await db.select({ id: changeOrdersTable.id }).from(changeOrdersTable).where(and(eq(changeOrdersTable.id, entityId), eq(changeOrdersTable.projectId, projectId))).limit(1); break;
    case "meeting": rows = await db.select({ id: meetingMinutesTable.id }).from(meetingMinutesTable).where(and(eq(meetingMinutesTable.id, entityId), eq(meetingMinutesTable.projectId, projectId))).limit(1); break;
    case "file": rows = await db.select({ id: filesTable.id }).from(filesTable).where(and(eq(filesTable.id, entityId), eq(filesTable.projectId, projectId))).limit(1); break;
    case "clash": rows = await db.select({ id: clashesTable.id }).from(clashesTable).where(and(eq(clashesTable.id, entityId), eq(clashesTable.projectId, projectId))).limit(1); break;
    case "lens_viewpoint": rows = await db.select({ id: lensViewpointsTable.id }).from(lensViewpointsTable).where(and(eq(lensViewpointsTable.id, entityId), eq(lensViewpointsTable.projectId, projectId))).limit(1); break;
  }
  return rows.length === 1;
}

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
    if (!Number.isInteger(projectId) || projectId <= 0 || !isLinkEntityType(fromType) || !isLinkEntityType(toType)
      || !Number.isInteger(fromId) || fromId <= 0 || !Number.isInteger(toId) || toId <= 0) {
      res.status(400).json({ error: "A supported source and target with authoritative numeric IDs are required" });
      return;
    }
    const [sourceInProject, targetInProject] = await Promise.all([
      entityBelongsToProject(fromType, fromId, projectId),
      entityBelongsToProject(toType, toId, projectId),
    ]);
    if (!sourceInProject || !targetInProject) {
      res.status(404).json({ error: "Both linked items must exist in the requested project" });
      return;
    }
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
