import { Router } from "express";
import { db } from "@workspace/db";
import {
  companiesTable, projectDirectoryTable, usersTable, activityLogTable, projectInvitations,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { sendEmail } from "../lib/email";
import { singleFileUpload } from "../middlewares/multipart";
import { extractFileText } from "../lib/extract-file-text";
import { getAnthropicClientForUser, sendAiUsageError } from "../lib/ai-usage";

const router: Router = Router();

const normalizeCompanyName = (value: string) =>
  value.trim().replace(/\s+/g, " ");

const companyDirectoryEmail = (projectId: number, companyId: number, companyName: string) => {
  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "company";
  return `project-${projectId}-company-${companyId}-${slug}@project-directory.local`;
};

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

// Register a reusable company name in the project directory without creating a
// meeting-only company list. Existing contacts for the same project/company are
// reused so repeated clicks and concurrent requests converge on one company.
router.post("/projects/:projectId/directory/companies", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const companyName = normalizeCompanyName(String(req.body?.company_name ?? ""));
  const website = normalizeCompanyName(String(req.body?.website ?? ""));
  const address = normalizeCompanyName(String(req.body?.address ?? ""));
  const phone = normalizeCompanyName(String(req.body?.phone ?? ""));
  const industry = normalizeCompanyName(String(req.body?.industry ?? ""));
  const companyType = normalizeCompanyName(String(req.body?.company_type ?? ""));
  const profileDescription = normalizeCompanyName(String(req.body?.profile_description ?? ""));
  const contactName = normalizeCompanyName(String(req.body?.primary_contact_name ?? ""));
  const contactEmail = String(req.body?.primary_contact_email ?? "").trim().toLowerCase();
  const contactPhone = normalizeCompanyName(String(req.body?.primary_contact_phone ?? ""));
  const notes = normalizeCompanyName(String(req.body?.notes ?? ""));
  if (!companyName) {
    res.status(400).json({ error: "company_name_required" });
    return;
  }
  if (companyName.length > 160) {
    res.status(400).json({ error: "company_name_too_long" });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`canonical-company:${companyName.toLowerCase()}`}, 0))`);
      let [company] = await tx
        .select()
        .from(companiesTable)
        .where(sql`lower(regexp_replace(trim(${companiesTable.name}), '\\s+', ' ', 'g')) = ${companyName.toLowerCase()}`)
        .orderBy(companiesTable.id)
        .limit(1);
      let reused = true;
      if (!company) {
        reused = false;
        [company] = await tx.insert(companiesTable).values({
          name: companyName,
          website: website || null,
          address: address || null,
          phone: phone || null,
          industry: industry || null,
          companyType: companyType || null,
          profileDescription: profileDescription || null,
        }).returning();
      } else if (website || address || phone || industry || companyType || profileDescription) {
        const updates: Record<string, unknown> = {};
        if (website && !company.website) updates.website = website;
        if (address && !company.address) updates.address = address;
        if (phone && !company.phone) updates.phone = phone;
        if (industry && !company.industry) updates.industry = industry;
        if (companyType && !company.companyType) updates.companyType = companyType;
        if (profileDescription && !company.profileDescription) updates.profileDescription = profileDescription;
        if (Object.keys(updates).length) {
          [company] = await tx.update(companiesTable).set(updates).where(eq(companiesTable.id, company.id)).returning();
        }
      }

      const [existingEntry] = await tx
        .select()
        .from(projectDirectoryTable)
        .where(and(
          eq(projectDirectoryTable.projectId, projectId),
          eq(projectDirectoryTable.companyId, company.id),
        ))
        .orderBy(projectDirectoryTable.id)
        .limit(1);
      if (existingEntry) return { company, directoryEntry: existingEntry, reused };

      const [createdEntry] = await tx.insert(projectDirectoryTable).values({
        projectId,
        fullName: contactName || companyName,
        email: contactEmail || companyDirectoryEmail(projectId, company.id, companyName),
        companyName,
        companyId: company.id,
        role: "External Company",
        notes: notes || [contactPhone ? `Phone: ${contactPhone}` : "", "Registered from Meeting attendee workflow."].filter(Boolean).join(" "),
        addedById: req.user!.userId,
        bimlogStatus: "none",
      }).returning();

      await tx.insert(activityLogTable).values({
        projectId,
        userId: req.user!.userId,
        userFullName: req.user!.fullName,
        userCompanyName: req.user!.companyName,
        actionType: "create",
        entityType: "directory_company",
        entityId: createdEntry.id,
        fileNameBefore: null,
        fileNameAfter: null,
        details: `Registered project directory company: ${companyName}`,
      });
      return { company, directoryEntry: createdEntry, reused };
    });
    res.status(result.reused ? 200 : 201).json({
      id: result.company.id,
      name: result.company.name,
      website: result.company.website,
      address: result.company.address,
      phone: result.company.phone,
      industry: result.company.industry,
      companyType: result.company.companyType,
      profileDescription: result.company.profileDescription,
      directoryEntry: result.directoryEntry,
      reused: result.reused,
    });
  } catch (err) {
    res.status(500).json({ error: "directory_company_create_failed" });
  }
});

router.post("/projects/:projectId/directory/contacts", authMiddleware, requirePermission("admin", "write"), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const fullName = normalizeCompanyName(String(req.body?.full_name ?? ""));
  const companyId = Number(req.body?.company_id);
  const companyName = normalizeCompanyName(String(req.body?.company_name ?? ""));
  const role = normalizeCompanyName(String(req.body?.role ?? "Attendee"));
  const trade = normalizeCompanyName(String(req.body?.trade ?? ""));
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const phone = normalizeCompanyName(String(req.body?.phone ?? ""));
  const notes = normalizeCompanyName(String(req.body?.notes ?? ""));
  if (!fullName) { res.status(400).json({ error: "full_name_required" }); return; }
  if (!Number.isInteger(companyId) || companyId <= 0) { res.status(400).json({ error: "company_id_required" }); return; }
  try {
    const entry = await db.transaction(async (tx) => {
      const [company] = await tx.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
      if (!company) return null;
      const normalizedCompanyName = companyName || company.name;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`project-directory-contact:${projectId}:${companyId}:${email || fullName.toLowerCase()}`}, 0))`);
      const [existing] = await tx.select().from(projectDirectoryTable).where(and(
        eq(projectDirectoryTable.projectId, projectId),
        eq(projectDirectoryTable.companyId, companyId),
        email
          ? sql`lower(${projectDirectoryTable.email}) = ${email}`
          : sql`lower(regexp_replace(trim(${projectDirectoryTable.fullName}), '\\s+', ' ', 'g')) = ${fullName.toLowerCase()}`,
      )).limit(1);
      if (existing) return existing;
      const [created] = await tx.insert(projectDirectoryTable).values({
        projectId,
        fullName,
        email: email || companyDirectoryEmail(projectId, companyId, `${fullName}-${company.name}`),
        companyName: normalizedCompanyName,
        companyId,
        role: role || "Attendee",
        notes: [trade ? `Trade: ${trade}` : "", phone ? `Phone: ${phone}` : "", notes].filter(Boolean).join(" | ") || null,
        addedById: req.user!.userId,
        bimlogStatus: "none",
      }).returning();
      await tx.insert(activityLogTable).values({
        projectId, userId: req.user!.userId, userFullName: req.user!.fullName, userCompanyName: req.user!.companyName,
        actionType: "create", entityType: "directory_entry", entityId: created.id,
        fileNameBefore: null, fileNameAfter: null, details: `Added meeting attendee contact: ${fullName}`,
      });
      return created;
    });
    if (!entry) { res.status(404).json({ error: "company_not_found" }); return; }
    res.status(201).json(entry);
  } catch {
    res.status(500).json({ error: "directory_contact_create_failed" });
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
