import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectDirectoryTable, usersTable, activityLogTable, projectInvitations,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { sendEmail } from "../lib/email";
import { singleFileUpload } from "../middlewares/multipart";
import { extractFileText } from "../lib/extract-file-text";
import { getAnthropicClientForUser, sendAiUsageError } from "../lib/ai-usage";

const router: Router = Router();

// ── GET /projects/:projectId/directory ────────────────────────────────────────
router.get("/projects/:projectId/directory", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  try {
    const entries = await db.select().from(projectDirectoryTable)
      .where(eq(projectDirectoryTable.projectId, projectId))
      .orderBy(projectDirectoryTable.fullName);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/directory ───────────────────────────────────────
router.post("/projects/:projectId/directory", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const { full_name, email, company_name, role, notes } = req.body as {
    full_name: string; email: string; company_name?: string; role: string; notes?: string;
  };
  if (!full_name || !email || !role) { res.status(400).json({ error: "full_name, email, role required" }); return; }
  try {
    // Auto-detect existing BIMLog user
    const existing = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    const linkedUserId = existing[0]?.id ?? null;
    const bimlogStatus = linkedUserId ? "active" : "none";

    const [entry] = await db.insert(projectDirectoryTable).values({
      projectId, fullName: full_name, email: email.toLowerCase(),
      companyName: company_name ?? null, role, notes: notes ?? null,
      addedById: req.user!.userId, linkedUserId, bimlogStatus,
    }).returning();

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "create", entityType: "directory_entry", entityId: entry.id,
      fileNameBefore: null, fileNameAfter: null,
      details: `Added to directory: ${full_name} (${role})`,
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── PATCH /projects/:projectId/directory/:entryId ─────────────────────────────
router.patch("/projects/:projectId/directory/:entryId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const entryId   = Number(req.params.entryId);
  const { full_name, email, company_name, role, notes } = req.body as Partial<{
    full_name: string; email: string; company_name: string; role: string; notes: string;
  }>;
  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (full_name)    updates.fullName    = full_name;
    if (email)        updates.email       = email.toLowerCase();
    if (company_name !== undefined) updates.companyName = company_name;
    if (role)         updates.role        = role;
    if (notes !== undefined) updates.notes = notes;

    const [updated] = await db.update(projectDirectoryTable)
      .set(updates as any)
      .where(and(eq(projectDirectoryTable.id, entryId), eq(projectDirectoryTable.projectId, projectId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Entry not found" }); return; }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── DELETE /projects/:projectId/directory/:entryId ────────────────────────────
router.delete("/projects/:projectId/directory/:entryId", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const entryId   = Number(req.params.entryId);
  try {
    await db.delete(projectDirectoryTable)
      .where(and(eq(projectDirectoryTable.id, entryId), eq(projectDirectoryTable.projectId, projectId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// ── POST /projects/:projectId/directory/:entryId/invite ───────────────────────
router.post("/projects/:projectId/directory/:entryId/invite", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const entryId   = Number(req.params.entryId);
  try {
    const entry = await db.select().from(projectDirectoryTable)
      .where(and(eq(projectDirectoryTable.id, entryId), eq(projectDirectoryTable.projectId, projectId)))
      .limit(1);
    if (!entry[0]) { res.status(404).json({ error: "Entry not found" }); return; }

    const { email, fullName, role } = entry[0];

    // Create invitation record
    await db.insert(projectInvitations).values({
      projectId, invitedByUserId: req.user!.userId,
      email, fullName, companyName: entry[0].companyName ?? null,
      role, status: "pending",
    });

    // Update bimlog_status to invited
    await db.update(projectDirectoryTable)
      .set({ bimlogStatus: "invited", updatedAt: new Date() })
      .where(eq(projectDirectoryTable.id, entryId));

    // Send invitation email
    const appUrl = process.env.APP_URL || process.env.BIMLOG_URL || "https://bimlog.app";
    await sendEmail({
      to: email,
      subject: `You've been invited to join BIMLog`,
      html: `<p>Hi ${fullName},</p>
<p>${req.user!.fullName} has invited you to join BIMLog as <strong>${role}</strong> on a project.</p>
<p><a href="${appUrl}/register">Click here to create your account and join.</a></p>
<p>— The BIMLog Team</p>`,
    });

    await db.insert(activityLogTable).values({
      projectId, userId: req.user!.userId,
      userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
      actionType: "invite", entityType: "directory_entry", entityId: entryId,
      fileNameBefore: null, fileNameAfter: null,
      details: `Invited ${fullName} (${email}) to join BIMLog`,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/directory/import",
  authMiddleware,
  requirePermission("admin", "write"),
  singleFileUpload({ fileSize: 50 * 1024 * 1024 }),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    try {
      if (!req.file) { res.status(400).json({ error: "no_file" }); return; }
      const anthropic = await getAnthropicClientForUser({
        userId: req.user!.userId,
        projectId,
        feature: "project_directory_import",
      });
      const { chunks, isPdf, pdfBase64 } = await extractFileText(req.file.buffer, req.file.originalname);
      let records: any[] = [];
      if (isPdf && pdfBase64) {
        try {
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
                { type: "text", text: `Extract all contact/directory records from this PDF document. Return ONLY a JSON array, no markdown. If none found return []:
[{"fullName":"person name","email":"email or null","companyName":"company or null","role":"role or null","notes":"notes or null"}]` }
              ] as any
            }]
          });
          const extractText = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "[]";
          records = JSON.parse(extractText.replace(/```json\n?|```/g, "").trim()) as any[];
          console.log("[directory-import] PDF direct extraction:", records.length, "records");
        } catch (e) {
          console.error("[directory-import] PDF direct extraction failed:", e);
        }
      } else {
      for (const chunk of chunks) {
        try {
          const extractMsg = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: `Extract all contact/directory records from this construction project document chunk.
Return ONLY a JSON array, no markdown. If none found return []:
[{"fullName":"person name","email":"email or null","companyName":"company or null","role":"role or null","notes":"notes or null"}]
Document chunk:
${chunk}`
            }]
          });
          const extractText = extractMsg.content[0]?.type === "text" ? extractMsg.content[0].text : "[]";
          const chunkRecords = JSON.parse(extractText.replace(/```json\n?|```/g, "").trim()) as any[];
          records = [...records, ...chunkRecords];
        } catch (e) {
          console.error("[directory-import] chunk extraction failed:", e);
        }
      }
      } // end else (non-PDF)

      let imported = 0;
      for (const r of records) {
        if (!r.fullName) continue;
        await db.insert(projectDirectoryTable).values({
          projectId,
          fullName: r.fullName,
          email: r.email || "imported@bimlog.io",
          companyName: r.companyName || null,
          role: r.role || "External Contact",
          notes: r.notes || null,
          addedById: req.user!.userId,
          bimlogStatus: "none",
        });
        imported++;
      }
      await db.insert(activityLogTable).values({
        projectId, userId: req.user!.userId,
        userFullName: req.user!.fullName ?? "", userCompanyName: req.user!.companyName ?? "",
        actionType: "import", entityType: "directory", entityId: projectId,
        details: `Imported ${imported} contacts from ${req.file.originalname}`,
      });
      res.json({ imported, message: `${imported} contacts imported successfully` });
    } catch (err) {
      if (sendAiUsageError(res, err)) return;
      console.error("[directory-import]", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

export default router;
