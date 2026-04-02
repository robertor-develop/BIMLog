import { Router } from "express";
import { db } from "@workspace/db";
import {
  meetingMinutesTable, meetingAttendeesTable, actionItemsTable,
  activityLogTable, usersTable,
} from "@workspace/db/schema";
import { eq, and, desc, ne } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { createNotification } from "./notifications";
import { sendEmail } from "../lib/email";
import Anthropic from "@anthropic-ai/sdk";

const router: Router = Router();
const anthropic = new Anthropic();

// ── GET /projects/:projectId/meetings ─────────────────────────────────────────
router.get("/projects/:projectId/meetings", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const meetings = await db.select().from(meetingMinutesTable)
      .where(eq(meetingMinutesTable.projectId, projectId))
      .orderBy(desc(meetingMinutesTable.meetingDate));
    const result = await Promise.all(meetings.map(async m => {
      const attendees = await db.select({ id: meetingAttendeesTable.id }).from(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, m.id));
      const actionItems = await db.select({ id: actionItemsTable.id, status: actionItemsTable.status }).from(actionItemsTable).where(eq(actionItemsTable.meetingId, m.id));
      return { ...m, attendeeCount: attendees.length, actionItemCount: actionItems.length, openActionItems: actionItems.filter(a => a.status !== "completed" && a.status !== "cancelled").length };
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/meetings ────────────────────────────────────────
router.post("/projects/:projectId/meetings", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = req.body as {
    title: string; meeting_date: string; location?: string; notes?: string;
    attendees?: { user_id?: number; external_email?: string; full_name: string; company?: string; role?: string }[];
  };
  if (!body.title || !body.meeting_date) { res.status(400).json({ error: "title and meeting_date required" }); return; }
  try {
    const [meeting] = await db.insert(meetingMinutesTable).values({
      projectId, title: body.title,
      meetingDate: new Date(body.meeting_date),
      location: body.location ?? null, notes: body.notes ?? null,
      createdById: req.user!.userId,
    }).returning();

    if (body.attendees?.length) {
      await db.insert(meetingAttendeesTable).values(
        body.attendees.map(a => ({
          meetingId: meeting.id, userId: a.user_id ?? null,
          externalEmail: a.external_email ?? null, fullName: a.full_name,
          company: a.company ?? null, role: a.role ?? null,
        }))
      );
    }

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "create", entityType: "meeting", entityId: meeting.id,
      fileNameBefore: null, fileNameAfter: null,
      details: `Created meeting: ${body.title} on ${new Date(body.meeting_date).toLocaleDateString()}`,
    });
    res.status(201).json(meeting);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/meetings/:meetingId ──────────────────────────────
router.get("/projects/:projectId/meetings/:meetingId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  try {
    const [meeting] = await db.select().from(meetingMinutesTable)
      .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId)));
    if (!meeting) { res.status(404).json({ error: "Not found" }); return; }
    const attendees = await db.select().from(meetingAttendeesTable).where(eq(meetingAttendeesTable.meetingId, meetingId));
    const actionItems = await db.select().from(actionItemsTable).where(eq(actionItemsTable.meetingId, meetingId));
    res.json({ ...meeting, attendees, actionItems });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /projects/:projectId/meetings/:meetingId ────────────────────────────
router.patch("/projects/:projectId/meetings/:meetingId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  const body = req.body as Partial<{ title: string; notes: string; location: string; ai_summary: string }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined)      updates.title      = body.title;
    if (body.notes !== undefined)      updates.notes      = body.notes;
    if (body.location !== undefined)   updates.location   = body.location;
    if (body.ai_summary !== undefined) updates.aiSummary  = body.ai_summary;
    const [updated] = await db.update(meetingMinutesTable).set(updates as any)
      .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/meetings/:meetingId/ai-summary ──────────────────
router.post("/projects/:projectId/meetings/:meetingId/ai-summary", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  try {
    const [meeting] = await db.select().from(meetingMinutesTable)
      .where(and(eq(meetingMinutesTable.id, meetingId), eq(meetingMinutesTable.projectId, projectId)));
    if (!meeting) { res.status(404).json({ error: "Not found" }); return; }

    const prompt = `You are a construction project manager. Summarize these meeting notes and extract action items.
Meeting: ${meeting.title} on ${new Date(meeting.meetingDate).toLocaleDateString()}
Notes: ${meeting.notes ?? "(no notes)"}
Return JSON only: { "summary": "...", "action_items": [{ "description": "...", "assigned_to_name": "...", "assigned_to_email": "...", "due_date": "YYYY-MM-DD or null" }] }`;

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-5", max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
    const parsed = JSON.parse(text.replace(/```json\n?|```/g, "").trim());

    await db.update(meetingMinutesTable).set({ aiSummary: parsed.summary, updatedAt: new Date() })
      .where(eq(meetingMinutesTable.id, meetingId));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/meetings/:meetingId/action-items ────────────────
router.post("/projects/:projectId/meetings/:meetingId/action-items", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const meetingId = Number(req.params.meetingId);
  const body = req.body as { items: { description: string; assigned_to_id?: number; assigned_to_name?: string; assigned_to_email?: string; due_date?: string }[] };
  if (!body.items?.length) { res.status(400).json({ error: "items required" }); return; }
  try {
    const created = await db.insert(actionItemsTable).values(
      body.items.map(i => ({
        meetingId, projectId, description: i.description,
        assignedToId: i.assigned_to_id ?? null,
        assignedToName: i.assigned_to_name ?? null,
        assignedToExternalEmail: i.assigned_to_email ?? null,
        dueDate: i.due_date ? new Date(i.due_date) : null,
        status: "open" as const,
      }))
    ).returning();

    // Notify assigned BIMLog users
    for (const item of created) {
      if (item.assignedToId) {
        await createNotification(item.assignedToId, projectId, "action_item_due",
          "New Action Item", item.description,
          `/projects/${projectId}/meetings`);
      }
    }

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "create", entityType: "action_items", entityId: meetingId,
      fileNameBefore: null, fileNameAfter: null,
      details: `Created ${created.length} action item(s) for meeting`,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/action-items ─────────────────────────────────────
router.get("/projects/:projectId/action-items", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const items = await db.select().from(actionItemsTable)
      .where(and(eq(actionItemsTable.projectId, projectId), ne(actionItemsTable.status, "cancelled")))
      .orderBy(desc(actionItemsTable.createdAt));
    const now = Date.now();
    const withOverdue = items.map(i => ({
      ...i,
      isOverdue: i.status !== "completed" && i.dueDate && new Date(i.dueDate).getTime() < now,
    }));
    res.json(withOverdue);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /projects/:projectId/action-items/:itemId ───────────────────────────
router.patch("/projects/:projectId/action-items/:itemId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const itemId = Number(req.params.itemId);
  const body = req.body as Partial<{ status: string; description: string; due_date: string }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.status !== undefined) {
      updates.status = body.status;
      if (body.status === "completed") updates.completedAt = new Date();
    }
    if (body.description !== undefined) updates.description = body.description;
    if (body.due_date !== undefined)    updates.dueDate = body.due_date ? new Date(body.due_date) : null;
    const [updated] = await db.update(actionItemsTable).set(updates as any)
      .where(and(eq(actionItemsTable.id, itemId), eq(actionItemsTable.projectId, projectId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
