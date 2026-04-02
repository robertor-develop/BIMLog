import { Router } from "express";
import { db } from "@workspace/db";
import {
  filesTable, rfisTable, submittalsTable, transmittalsTable,
  changeOrdersTable, meetingMinutesTable, actionItemsTable,
  usersTable, companiesTable, projectMembersTable,
} from "@workspace/db/schema";
import { eq, and, or, ilike, inArray } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router: Router = Router();

// ── GET /search?q=term&projectId=optional ─────────────────────────────────────
router.get("/search", authMiddleware, async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const projectIdParam = req.query.projectId ? Number(req.query.projectId) : null;
  if (!q || q.length < 2) { res.json({ files: [], rfis: [], submittals: [], transmittals: [], change_orders: [], meetings: [], action_items: [], people: [] }); return; }

  try {
    // Get user's project memberships
    const memberships = await db.select({ projectId: projectMembersTable.projectId })
      .from(projectMembersTable).where(eq(projectMembersTable.userId, req.user!.userId));
    let projectIds = memberships.map(m => m.projectId);
    if (projectIdParam) projectIds = projectIds.filter(id => id === projectIdParam);
    if (!projectIds.length) { res.json({ files: [], rfis: [], submittals: [], transmittals: [], change_orders: [], meetings: [], action_items: [], people: [] }); return; }

    const term = `%${q}%`;
    const pid  = inArray(filesTable.projectId, projectIds);

    const [files, rfis, submittals, txs, cos, meetings, actionItems] = await Promise.all([
      db.select({ id: filesTable.id, projectId: filesTable.projectId, name: filesTable.fileName, status: filesTable.status })
        .from(filesTable).where(and(inArray(filesTable.projectId, projectIds), ilike(filesTable.fileName, term))).limit(5),
      db.select({ id: rfisTable.id, projectId: rfisTable.projectId, name: rfisTable.number, status: rfisTable.status, sub: rfisTable.subject })
        .from(rfisTable).where(and(inArray(rfisTable.projectId, projectIds), or(ilike(rfisTable.number, term), ilike(rfisTable.subject, term)))).limit(5),
      db.select({ id: submittalsTable.id, projectId: submittalsTable.projectId, name: submittalsTable.number, status: submittalsTable.status, sub: submittalsTable.title })
        .from(submittalsTable).where(and(inArray(submittalsTable.projectId, projectIds), or(ilike(submittalsTable.number, term), ilike(submittalsTable.title, term)))).limit(5),
      db.select({ id: transmittalsTable.id, projectId: transmittalsTable.projectId, name: transmittalsTable.number, status: transmittalsTable.status, sub: transmittalsTable.title })
        .from(transmittalsTable).where(and(inArray(transmittalsTable.projectId, projectIds), or(ilike(transmittalsTable.number, term), ilike(transmittalsTable.title, term)))).limit(5),
      db.select({ id: changeOrdersTable.id, projectId: changeOrdersTable.projectId, name: changeOrdersTable.number, status: changeOrdersTable.status, sub: changeOrdersTable.title })
        .from(changeOrdersTable).where(and(inArray(changeOrdersTable.projectId, projectIds), or(ilike(changeOrdersTable.number, term), ilike(changeOrdersTable.title, term)))).limit(5),
      db.select({ id: meetingMinutesTable.id, projectId: meetingMinutesTable.projectId, name: meetingMinutesTable.title })
        .from(meetingMinutesTable).where(and(inArray(meetingMinutesTable.projectId, projectIds), ilike(meetingMinutesTable.title, term))).limit(5),
      db.select({ id: actionItemsTable.id, projectId: actionItemsTable.projectId, name: actionItemsTable.description, status: actionItemsTable.status })
        .from(actionItemsTable).where(and(inArray(actionItemsTable.projectId, projectIds), ilike(actionItemsTable.description, term))).limit(5),
    ]);

    // People search (users in same projects)
    const memberUserIds = await db.select({ userId: projectMembersTable.userId })
      .from(projectMembersTable).where(inArray(projectMembersTable.projectId, projectIds));
    const userIds = [...new Set(memberUserIds.map(m => m.userId))];
    const people = userIds.length ? await db.select({ id: usersTable.id, name: usersTable.fullName, email: usersTable.email })
      .from(usersTable).where(and(inArray(usersTable.id, userIds), or(ilike(usersTable.fullName, term), ilike(usersTable.email, term)))).limit(5) : [];

    res.json({
      files: files.map(f => ({ ...f, type: "file" })),
      rfis: rfis.map(r => ({ ...r, label: `${r.name} — ${r.sub}`, type: "rfi" })),
      submittals: submittals.map(s => ({ ...s, label: `${s.name} — ${s.sub}`, type: "submittal" })),
      transmittals: txs.map(t => ({ ...t, label: `${t.name} — ${t.sub}`, type: "transmittal" })),
      change_orders: cos.map(c => ({ ...c, label: `${c.name} — ${c.sub}`, type: "change_order" })),
      meetings: meetings.map(m => ({ ...m, type: "meeting" })),
      action_items: actionItems.map(a => ({ ...a, type: "action_item" })),
      people: people.map(p => ({ ...p, type: "person" })),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
