import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectMembersTable, usersTable, companiesTable, activityLogTable, projectInvitations, projectsTable } from "@workspace/db/schema";
import { sendEmail, makeInvitationEmail, makeTeamMemberAddedEmail, getUserLang, notifEnabled } from "../lib/email";
import { eq, and } from "drizzle-orm";
import { AddMemberBody, UpdateMemberBody, ListMembersParams, AddMemberParams, UpdateMemberParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { validateConfigValue } from "../middlewares/config-validator";
import { addPageNumbers, computeContentHash, createPdfDocument, drawBrandedHeader, drawTable, REPORT_THEMES, reportFileName, sectionBar } from "../lib/pdf-kit";

const router: IRouter = Router();

const boolQuery = (value: unknown, fallback = true): boolean | "invalid" => {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return "invalid";
};

const safeText = (value: unknown, fallback = "-") => {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text || fallback;
};

const roleLabel = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

router.get("/projects/:projectId/members", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListMembersParams.parse({ projectId: req.params.projectId });

    const members = await db
      .select()
      .from(projectMembersTable)
      .where(eq(projectMembersTable.projectId, projectId));

    const results = await Promise.all(
      members.map(async (m) => {
        const user = await db.select().from(usersTable).where(eq(usersTable.id, m.userId)).limit(1);
        let companyName = "";
        if (user[0]) {
          const company = await db.select().from(companiesTable).where(eq(companiesTable.id, user[0].companyId)).limit(1);
          companyName = company[0]?.name || "";
        }
        return {
          id: m.id,
          projectId: m.projectId,
          userId: m.userId,
          userFullName: user[0]?.fullName || "",
          userEmail: user[0]?.email || "",
          userCompanyId: user[0]?.companyId || null,
          userCompanyName: companyName,
          role: m.role,
          joinedAt: m.joinedAt.toISOString(),
        };
      })
    );

    res.json(results);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

router.get("/projects/:projectId/members/current-view/pdf", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const lang = req.query.lang === "es" ? "es" : "en";
  const label = (en: string, es: string) => lang === "es" ? es : en;
  const status = typeof req.query.status === "string" ? req.query.status : "active";
  const role = typeof req.query.role === "string" ? req.query.role : "all";
  const company = typeof req.query.company === "string" ? req.query.company.trim() : "all";
  const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";
  const sort = typeof req.query.sort === "string" ? req.query.sort : "company_asc";
  const groupBy = typeof req.query.group_by === "string" ? req.query.group_by : "company";
    const includeEmail = boolQuery(req.query.include_email, true);
    const includeCompany = boolQuery(req.query.include_company, true);
    const includeJoined = boolQuery(req.query.include_joined, true);

  const allowedStatuses = new Set(["active", "all"]);
  const allowedSorts = new Set(["company_asc", "name_asc", "name_desc", "role_asc", "joined_desc", "joined_asc"]);
  const allowedGroups = new Set(["company", "none"]);
  if (!Number.isInteger(projectId) || projectId <= 0) { res.status(400).json({ error: "invalid_project_id" }); return; }
  if (!allowedStatuses.has(status)) { res.status(400).json({ error: "invalid_status" }); return; }
  if (!allowedSorts.has(sort)) { res.status(400).json({ error: "invalid_sort" }); return; }
    if (!allowedGroups.has(groupBy)) { res.status(400).json({ error: "invalid_grouping" }); return; }
    if (search.length > 200) { res.status(400).json({ error: "invalid_search" }); return; }
    if (company.length > 120) { res.status(400).json({ error: "invalid_company" }); return; }
    if ([includeEmail, includeCompany, includeJoined].includes("invalid")) { res.status(400).json({ error: "invalid_include_option" }); return; }
    const showCompanyColumn = includeCompany === true && groupBy !== "company";
  if (role !== "all" && !(await validateConfigValue("member_role", role))) { res.status(400).json({ error: "invalid_role" }); return; }

  try {
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) { res.status(404).json({ error: "project_not_found" }); return; }

    const members = await db.select().from(projectMembersTable).where(eq(projectMembersTable.projectId, projectId));
    const rows = await Promise.all(members.map(async (m) => {
      const user = await db.select().from(usersTable).where(eq(usersTable.id, m.userId)).limit(1);
      let companyName = "";
      if (user[0]) {
        const companyRow = await db.select().from(companiesTable).where(eq(companiesTable.id, user[0].companyId)).limit(1);
        companyName = companyRow[0]?.name || "";
      }
      return {
        id: m.id,
        name: safeText(user[0]?.fullName, label("Unknown member", "Miembro desconocido")),
        email: safeText(user[0]?.email),
        company: safeText(companyName, label("Unknown company", "Empresa desconocida")),
        role: m.role,
        roleLabel: roleLabel(m.role),
        joinedAt: m.joinedAt,
        joined: m.joinedAt.toISOString().slice(0, 10),
        status: "active",
      };
    }));

    const filtered = rows
      .filter(row => status === "all" || row.status === status)
      .filter(row => role === "all" || row.role === role)
      .filter(row => company === "all" || row.company === company)
      .filter(row => {
        if (!search) return true;
        return [row.name, row.email, row.company, row.roleLabel].join(" ").toLowerCase().includes(search);
      })
      .sort((a, b) => {
        if (sort === "name_asc") return a.name.localeCompare(b.name);
        if (sort === "name_desc") return b.name.localeCompare(a.name);
        if (sort === "role_asc") return a.roleLabel.localeCompare(b.roleLabel) || a.name.localeCompare(b.name);
        if (sort === "joined_asc") return a.joinedAt.getTime() - b.joinedAt.getTime();
        if (sort === "joined_desc") return b.joinedAt.getTime() - a.joinedAt.getTime();
        return a.company.localeCompare(b.company) || a.name.localeCompare(b.name);
      });

    const companyCount = new Set(rows.map(row => row.company)).size;
    const filteredCompanyCount = new Set(filtered.map(row => row.company)).size;
    const adminCount = rows.filter(row => row.role === "project_admin").length;
    const filteredAdminCount = filtered.filter(row => row.role === "project_admin").length;
    const title = label("Project Team — Current View", "Equipo del Proyecto — Vista actual");
    const generatedAt = new Date();
    const sortLabel = sort === "name_asc" ? label("Name A-Z", "Nombre A-Z")
      : sort === "name_desc" ? label("Name Z-A", "Nombre Z-A")
      : sort === "role_asc" ? label("Role", "Rol")
      : sort === "joined_asc" ? label("Joined oldest first", "Ingreso mas antiguo")
      : sort === "joined_desc" ? label("Joined newest first", "Ingreso mas reciente")
      : label("Company, then name", "Empresa, luego nombre");
    const columnsLabel = [
      includeEmail ? label("Email", "Correo") : "",
      showCompanyColumn ? label("Company", "Empresa") : "",
      includeJoined ? label("Joined", "Ingreso") : "",
    ].filter(Boolean).join(", ") || label("Name and role only", "Solo nombre y rol");
    const filterSummary = [
      `${label("Status", "Estado")}: ${label("Active project members", "Miembros activos del proyecto")}`,
      `${label("Role", "Rol")}: ${role === "all" ? label("All", "Todos") : roleLabel(role)}`,
      `${label("Company", "Empresa")}: ${company === "all" ? label("All", "Todas") : company}`,
      `${label("Search", "Busqueda")}: ${search || label("None", "Ninguna")}`,
      `${label("Sort", "Orden")}: ${sortLabel}`,
      `${label("Grouping", "Agrupacion")}: ${groupBy === "company" ? label("Company", "Empresa") : label("None", "Ninguna")}`,
      `${label("Rows", "Filas")}: ${filtered.length}/${rows.length}`,
      `${label("Columns", "Columnas")}: ${columnsLabel}`,
    ];
    const contentHash = computeContentHash({
      report: "project_team_current_view",
      projectId,
      filters: { status, role, company, search, sort, groupBy, includeEmail, includeCompany: showCompanyColumn, includeJoined },
      rows: filtered.map(row => ({ id: row.id, name: row.name, email: includeEmail ? row.email : undefined, company: showCompanyColumn ? row.company : undefined, role: row.role, joined: includeJoined ? row.joined : undefined })),
    });

    const doc = createPdfDocument({ size: "LETTER", layout: "landscape", margin: 40, bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${reportFileName(title)}"`);
    doc.pipe(res);

    const reportNumber = `TEAM-${projectId}-${generatedAt.toISOString().slice(0, 10).replace(/-/g, "")}`;
    const header = () => drawBrandedHeader(doc, {
      margin: 40,
      companyName: req.user!.companyName || "BIMLog",
      title,
      subtitle: label("Export Current View", "Exportar vista actual"),
      projectName: project.name,
      projectCode: project.code,
      reportNumber,
      reportDate: generatedAt,
      theme: REPORT_THEMES.platform.standard,
    }) + 10;
    let y = header();
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#1E3A5F").text(label("Current view summary", "Resumen de vista actual"), 40, y);
    y += 14;
    doc.fontSize(8).font("Helvetica").fillColor("#374151").text(filterSummary.join(" | "), 40, y, { width: doc.page.width - 80 });
    y += 24;
    const cardW = 128;
    [
      [label("Matching members", "Miembros coincidentes"), String(filtered.length)],
      [label("Total members", "Miembros totales"), String(rows.length)],
      [label("Companies", "Empresas"), `${filteredCompanyCount}/${companyCount}`],
      [label("Project admins", "Admins proyecto"), `${filteredAdminCount}/${adminCount}`],
    ].forEach(([name, value], index) => {
      const x = 40 + index * (cardW + 8);
      doc.rect(x, y, cardW, 42).fill("#F4F6F8");
      doc.fontSize(7).font("Helvetica-Bold").fillColor("#6B7280").text(name, x + 8, y + 8, { width: cardW - 16, lineBreak: false });
      doc.fontSize(15).font("Helvetica-Bold").fillColor("#1E3A5F").text(value, x + 8, y + 22, { width: cardW - 16, lineBreak: false });
    });
    y += 56;

    const tableColumns = [
      { label: label("Name", "Nombre"), width: 150, wrap: true, bold: true, format: (row: typeof filtered[number]) => row.name },
      ...(includeEmail ? [{ label: label("Email", "Correo"), width: 160, wrap: true, format: (row: typeof filtered[number]) => row.email }] : []),
      ...(showCompanyColumn ? [{ label: label("Company", "Empresa"), width: 135, wrap: true, format: (row: typeof filtered[number]) => row.company }] : []),
      { label: label("Role", "Rol"), width: 115, format: (row: typeof filtered[number]) => row.roleLabel },
      { label: label("Status", "Estado"), width: 62, format: () => label("Active", "Activo") },
      ...(includeJoined ? [{ label: label("Joined", "Ingreso"), width: 78, format: (row: typeof filtered[number]) => row.joined }] : []),
    ];
    const renderTable = (tableRows: typeof filtered, startY: number) => drawTable(doc, {
      x: 40,
      startY,
      columns: tableColumns,
      rows: tableRows,
      fontSize: 7,
      headerFontSize: 7,
      rowMinHeight: 24,
      pageBottom: 520,
      headerFill: REPORT_THEMES.platform.standard.dark,
      onPageBreak: header,
    });

    if (filtered.length === 0) {
      doc.rect(40, y, doc.page.width - 80, 58).fill("#F8FAFC");
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1E3A5F").text(rows.length === 0 ? label("No project members yet", "Aun no hay miembros del proyecto") : label("No members match the current filters", "Ningun miembro coincide con los filtros actuales"), 54, y + 14);
      doc.fontSize(8).font("Helvetica").fillColor("#6B7280").text(rows.length === 0 ? label("Add project members before exporting a team register.", "Agrega miembros del proyecto antes de exportar el registro del equipo.") : label("Adjust search, company, role, or grouping options and export again.", "Ajusta busqueda, empresa, rol o agrupacion y exporta nuevamente."), 54, y + 34);
    } else if (groupBy === "company") {
      const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, row) => {
        if (!acc[row.company]) acc[row.company] = [];
        acc[row.company].push(row);
        return acc;
      }, {});
      for (const [companyName, companyRows] of Object.entries(grouped)) {
        if (y > 470) { doc.addPage(); y = header(); }
        y = sectionBar(doc, `${companyName} (${companyRows.length})`, y, { margin: 40, theme: REPORT_THEMES.platform.standard });
        y = renderTable(companyRows, y) + 10;
      }
    } else {
      y = renderTable(filtered, y);
    }

    addPageNumbers(doc, {
      margin: 40,
      footerY: 560,
      fingerprintY: 548,
      contentHash,
      companyName: req.user!.companyName || "BIMLog",
      projectName: project.name,
      reportNumber,
      timestamp: generatedAt.toISOString(),
    });
    doc.end();
  } catch (error) {
    console.error("[members.current_view_pdf_failed]", { name: error instanceof Error ? error.name : "UnknownError" });
    if (!res.headersSent) res.status(500).json({ error: "Project Team current-view PDF export failed." });
  }
});

router.post("/projects/:projectId/members", authMiddleware, requirePermission("admin"), async (req, res) => {
  try {
    const { projectId } = AddMemberParams.parse({ projectId: req.params.projectId });
    const body = AddMemberBody.parse(req.body);

    if (body.role && !(await validateConfigValue("member_role", body.role))) {
      res.status(422).json({ error: `Invalid role: ${body.role}` });
      return;
    }

    const users = await db.select().from(usersTable).where(eq(usersTable.email, body.email)).limit(1);
    if (users.length === 0) {
      res.status(404).json({ error: "User not found with that email" });
      return;
    }

    const user = users[0];

    const existing = await db
      .select()
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.id)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "User is already a member of this project" });
      return;
    }

    const [member] = await db.insert(projectMembersTable).values({
      projectId,
      userId: user.id,
      role: body.role,
    }).returning();

    const company = await db.select().from(companiesTable).where(eq(companiesTable.id, user.companyId)).limit(1);

    await db.insert(activityLogTable).values({
      projectId,
      userId: req.user!.userId,
      userFullName: req.user!.fullName,
      userCompanyName: req.user!.companyName,
      actionType: "add_member",
      entityType: "member",
      entityId: member.id,
      details: `Added ${user.fullName} as ${body.role}`,
    });

    res.status(201).json({
      id: member.id,
      projectId: member.projectId,
      userId: member.userId,
      userFullName: user.fullName,
      userEmail: user.email,
      userCompanyName: company[0]?.name || "",
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
    });

    // ── T9: Team Member Added email ──────────────────────────────────────────
    setImmediate(async () => {
      try {
        const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
        const prefs = user.notificationPreferences;
        if (!notifEnabled(prefs, "team_member_added")) return;
        const lang = getUserLang(prefs);
        await sendEmail({
          to: user.email,
          subject: lang === "es"
            ? `Has sido añadido al proyecto: ${project[0]?.name || "Unknown Project"}`
            : `You've been added to project: ${project[0]?.name || "Unknown Project"}`,
          html: makeTeamMemberAddedEmail({
            lang,
            memberName: user.fullName,
            projectName: project[0]?.name || "Unknown Project",
            role: member.role,
            addedByName: req.user!.fullName,
            projectId,
          }),
        });
      } catch (emailError) {
        console.error("[members] Failed to send team member added email:", emailError instanceof Error ? emailError.message : emailError);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

router.patch("/projects/:projectId/members/:memberId", authMiddleware, requirePermission("admin"), async (req, res) => {
  try {
    const { projectId, memberId } = UpdateMemberParams.parse({ projectId: req.params.projectId, memberId: req.params.memberId });
    const body = UpdateMemberBody.parse(req.body);

    const existing = await db
      .select()
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.id, memberId), eq(projectMembersTable.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (body.role && !(await validateConfigValue("member_role", body.role))) {
      res.status(422).json({ error: `Invalid role: ${body.role}` });
      return;
    }

    const [updated] = await db
      .update(projectMembersTable)
      .set({ role: body.role })
      .where(eq(projectMembersTable.id, memberId))
      .returning();

    const user = await db.select().from(usersTable).where(eq(usersTable.id, updated.userId)).limit(1);
    const company = await db.select().from(companiesTable).where(eq(companiesTable.id, user[0]?.companyId || 0)).limit(1);

    res.json({
      id: updated.id,
      projectId: updated.projectId,
      userId: updated.userId,
      userFullName: user[0]?.fullName || "",
      userEmail: user[0]?.email || "",
      userCompanyName: company[0]?.name || "",
      role: updated.role,
      joinedAt: updated.joinedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bad request";
    res.status(400).json({ error: message });
  }
});

router.delete("/projects/:projectId/members/:memberId", authMiddleware, requirePermission("admin"), async (req, res) => {
  try {
    const { projectId, memberId } = UpdateMemberParams.parse({ projectId: req.params.projectId, memberId: req.params.memberId });

    const existing = await db
      .select()
      .from(projectMembersTable)
      .where(and(eq(projectMembersTable.id, memberId), eq(projectMembersTable.projectId, projectId)))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    await db.delete(projectMembersTable).where(eq(projectMembersTable.id, memberId));

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

// ─── Invitations ──────────────────────────────────────────────────────────────

router.get("/projects/:projectId/invitations", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = parseInt(req.params["projectId"] as string, 10);
    const rows = await db.select().from(projectInvitations).where(eq(projectInvitations.projectId, projectId));
    res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString(), acceptedAt: r.acceptedAt?.toISOString() ?? null })));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.post("/projects/:projectId/invitations", authMiddleware, requirePermission("admin"), async (req, res) => {
  try {
    const projectId = parseInt(req.params["projectId"] as string, 10);
    const { email, fullName, companyName, role } = req.body as { email: string; fullName?: string; companyName?: string; role?: string };
    if (!email) { res.status(400).json({ error: "email is required" }); return; }
    const roleValue = role || "member";
    const [row] = await db.insert(projectInvitations).values({
      projectId,
      invitedByUserId: req.user!.userId,
      email,
      fullName: fullName ?? null,
      companyName: companyName ?? null,
      role: roleValue,
      status: "pending",
    }).returning();
    res.status(201).json({ ...row, createdAt: row.createdAt.toISOString(), acceptedAt: null });

    // ── T1: Invitation email ──────────────────────────────────────────────────
    setImmediate(async () => {
      try {
        const project = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
        const projectName = project[0]?.name || "Unknown Project";
        const inviterUser = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId)).limit(1);
        const inviterName = inviterUser[0]?.fullName || req.user!.fullName;
        const inviteLink = `${process.env.BIMLOG_URL || "https://bimlog.app"}/register`;
        await sendEmail({
          to: email,
          subject: `You've been invited to join ${projectName} on BIMLog`,
          html: makeInvitationEmail({
            lang: "en",
            invitedByName: inviterName,
            invitedEmail: email,
            projectName,
            role: roleValue,
            projectId,
          }),
        });
      } catch (emailError) {
        console.error("[members] Failed to send invitation email:", emailError instanceof Error ? emailError.message : emailError);
      }
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

router.delete("/projects/:projectId/invitations/:invId", authMiddleware, requirePermission("admin"), async (req, res) => {
  try {
    const projectId = parseInt(req.params["projectId"] as string, 10);
    const invId = parseInt(req.params["invId"] as string, 10);
    const existing = await db.select().from(projectInvitations).where(and(eq(projectInvitations.id, invId), eq(projectInvitations.projectId, projectId))).limit(1);
    if (existing.length === 0) { res.status(404).json({ error: "Invitation not found" }); return; }
    await db.delete(projectInvitations).where(eq(projectInvitations.id, invId));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

export default router;
