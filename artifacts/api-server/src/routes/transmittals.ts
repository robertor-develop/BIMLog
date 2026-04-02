import { Router } from "express";
import { db } from "@workspace/db";
import {
  transmittalsTable, transmittalItemsTable, activityLogTable,
  projectsTable, usersTable, filesTable, projectMembersTable,
} from "@workspace/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { sendEmail } from "../lib/email";
import { createNotification } from "./notifications";
import Anthropic from "@anthropic-ai/sdk";
import PDFDocument from "pdfkit";

const router: Router = Router();
const anthropic = new Anthropic();

async function nextTransmittalNumber(projectId: number, projectCode: string): Promise<string> {
  const existing = await db.select({ id: transmittalsTable.id })
    .from(transmittalsTable).where(eq(transmittalsTable.projectId, projectId));
  const seq = String(existing.length + 1).padStart(4, "0");
  return `T-${projectCode}-${seq}`;
}

// ── GET /projects/:projectId/transmittals ─────────────────────────────────────
router.get("/projects/:projectId/transmittals", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const rows = await db.select().from(transmittalsTable)
      .where(eq(transmittalsTable.projectId, projectId))
      .orderBy(desc(transmittalsTable.createdAt));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/transmittals ────────────────────────────────────
router.post("/projects/:projectId/transmittals", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const body = req.body as { title: string; purpose?: string; sent_to?: unknown[]; items?: { file_id?: number; description?: string; revision?: string }[] };
  if (!body.title) { res.status(400).json({ error: "title required" }); return; }
  try {
    const project = await db.select({ code: projectsTable.code }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    const number = await nextTransmittalNumber(projectId, project[0]?.code ?? "PRJ");

    const [tx] = await db.insert(transmittalsTable).values({
      projectId, number, title: body.title,
      purpose: body.purpose ?? null,
      sentById: req.user!.userId,
      sentTo: body.sent_to ?? null,
      status: "draft",
    }).returning();

    if (body.items?.length) {
      await db.insert(transmittalItemsTable).values(
        body.items.map(i => ({ transmittalId: tx.id, fileId: i.file_id ?? null, description: i.description ?? null, revision: i.revision ?? null }))
      );
    }

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "create", entityType: "transmittal", entityId: tx.id,
      fileNameBefore: null, fileNameAfter: null,
      details: `Created transmittal ${number}: ${body.title}`,
    });
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/transmittals/:transmittalId ──────────────────────
router.get("/projects/:projectId/transmittals/:transmittalId", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  try {
    const [tx] = await db.select().from(transmittalsTable)
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId)));
    if (!tx) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(transmittalItemsTable).where(eq(transmittalItemsTable.transmittalId, txId));
    res.json({ ...tx, items });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /projects/:projectId/transmittals/:transmittalId ────────────────────
router.patch("/projects/:projectId/transmittals/:transmittalId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  const body = req.body as Partial<{ title: string; purpose: string; sent_to: unknown[] }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title)    updates.title    = body.title;
    if (body.purpose !== undefined) updates.purpose = body.purpose;
    if (body.sent_to)  updates.sentTo   = body.sent_to;
    const [updated] = await db.update(transmittalsTable).set(updates as any)
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId))).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/transmittals/:transmittalId/send ────────────────
router.post("/projects/:projectId/transmittals/:transmittalId/send", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  try {
    const [tx] = await db.select().from(transmittalsTable)
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId)));
    if (!tx) { res.status(404).json({ error: "Not found" }); return; }

    const sentAt = new Date();
    await db.update(transmittalsTable).set({ status: "sent", sentAt, updatedAt: new Date() })
      .where(eq(transmittalsTable.id, txId));

    const recipients = (tx.sentTo as { email?: string; userId?: number; name?: string }[]) ?? [];
    const appUrl = process.env.APP_URL || "https://bim-log-ignite.replit.app";

    for (const r of recipients) {
      if (r.email) {
        setImmediate(async () => {
          try {
            await sendEmail({
              to: r.email!,
              subject: `Transmittal ${tx.number}: ${tx.title}`,
              html: `<p>Hi ${r.name ?? ""},</p>
<p>A transmittal has been sent to you from BIMLog.</p>
<p><strong>${tx.number}</strong> — ${tx.title}</p>
${tx.purpose ? `<p>${tx.purpose}</p>` : ""}
<p><a href="${appUrl}/projects/${projectId}/transmittals/${txId}">View Transmittal</a></p>`,
            });
          } catch { /* non-fatal */ }
        });
      }
      if (r.userId) {
        await createNotification(r.userId, projectId, "transmittal_received",
          `Transmittal: ${tx.number}`, `${tx.title} — sent by ${req.user!.fullName}`,
          `/projects/${projectId}/transmittals`);
      }
    }

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "send", entityType: "transmittal", entityId: txId,
      fileNameBefore: null, fileNameAfter: null,
      details: `Sent transmittal ${tx.number} to ${recipients.length} recipient(s)`,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/transmittals/:transmittalId/acknowledge ─────────
router.post("/projects/:projectId/transmittals/:transmittalId/acknowledge", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  try {
    await db.update(transmittalsTable).set({ status: "acknowledged", acknowledgedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/transmittals/:transmittalId/ai-draft ────────────
router.post("/projects/:projectId/transmittals/:transmittalId/ai-draft", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  try {
    const [tx] = await db.select().from(transmittalsTable)
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId)));
    if (!tx) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(transmittalItemsTable).where(eq(transmittalItemsTable.transmittalId, txId));
    const project = await db.select({ name: projectsTable.name, code: projectsTable.code })
      .from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    const prompt = `You are a construction document control expert. Draft a concise purpose statement for a transmittal.
Project: ${project[0]?.name} (${project[0]?.code})
Transmittal Title: ${tx.title}
Items: ${items.map(i => i.description ?? `File ${i.fileId}`).join(", ")}
Return JSON only: { "purpose": "...", "description": "..." }`;

    const msg = await anthropic.messages.create({
      model: "claude-opus-4-5", max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
    const parsed = JSON.parse(text.replace(/```json\n?|```/g, "").trim());

    await db.update(transmittalsTable).set({ aiDraftUsed: true, updatedAt: new Date() })
      .where(eq(transmittalsTable.id, txId));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── GET /projects/:projectId/transmittals/:transmittalId/export ───────────────
router.get("/projects/:projectId/transmittals/:transmittalId/export", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const txId = Number(req.params.transmittalId);
  try {
    const [tx] = await db.select().from(transmittalsTable)
      .where(and(eq(transmittalsTable.id, txId), eq(transmittalsTable.projectId, projectId)));
    if (!tx) { res.status(404).json({ error: "Not found" }); return; }
    const items = await db.select().from(transmittalItemsTable).where(eq(transmittalItemsTable.transmittalId, txId));
    const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="transmittal-${tx.number}.pdf"`);
    doc.pipe(res);

    // Header
    doc.fontSize(18).font("Helvetica-Bold").text("TRANSMITTAL", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").text(`Project: ${project[0]?.name ?? ""} (${project[0]?.code ?? ""})`, { align: "center" });
    doc.moveDown();

    // Fields
    const field = (label: string, value: string) => {
      doc.fontSize(9).font("Helvetica-Bold").text(label + ": ", { continued: true });
      doc.font("Helvetica").text(value);
    };
    field("Number", tx.number);
    field("Title", tx.title);
    field("Status", tx.status.toUpperCase());
    field("Date", tx.sentAt ? new Date(tx.sentAt).toLocaleDateString() : new Date(tx.createdAt).toLocaleDateString());
    if (tx.purpose) field("Purpose", tx.purpose);
    doc.moveDown();

    // Items table
    if (items.length > 0) {
      doc.fontSize(10).font("Helvetica-Bold").text("Items:");
      doc.moveDown(0.3);
      items.forEach((item, i) => {
        doc.fontSize(9).font("Helvetica").text(`${i + 1}. ${item.description ?? "—"}${item.revision ? ` (Rev: ${item.revision})` : ""}`);
      });
    }

    doc.moveDown(2);
    doc.fontSize(8).font("Helvetica").fillColor("#666").text("Generated by BIMLog by IgniteSmart", { align: "center" });
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
