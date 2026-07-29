import { Router } from "express";
import { db } from "@workspace/db";
import {
  companiesTable, projectDirectoryTable, usersTable, activityLogTable, projectInvitations,
  projectsTable, projectMembersTable,
} from "@workspace/db/schema";
import { eq, and, sql, asc } from "drizzle-orm";
import { authMiddleware, requireProjectMember, requirePermission } from "../middlewares/auth";
import { sendEmail } from "../lib/email";
import { singleFileUpload } from "../middlewares/multipart";
import { extractFileText } from "../lib/extract-file-text";
import { getAnthropicClientForUser, sendAiUsageError } from "../lib/ai-usage";
import {
  addPageNumbers,
  computeContentHash,
  createPdfDocument,
  drawBrandedHeader,
  drawTable,
  PALETTE,
  REPORT_THEMES,
  reportFileName,
  sectionBar,
  type TableColumn,
} from "../lib/pdf-kit";

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

type DirectoryScope = "all" | "members" | "contacts";
type DirectoryRoleFilter = "all" | "admin" | "member" | "external";
type DirectoryStatusFilter = "all" | "active" | "invited" | "external";
type DirectorySort = "name" | "company" | "role" | "status";
type DirectoryLang = "en" | "es";

type DirectoryExportRow = {
  source: "member" | "contact";
  fullName: string;
  email: string;
  companyName: string | null;
  role: string;
  status: "active" | "invited" | "external";
};

const DIRECTORY_SCOPES = new Set<DirectoryScope>(["all", "members", "contacts"]);
const DIRECTORY_ROLES = new Set<DirectoryRoleFilter>(["all", "admin", "member", "external"]);
const DIRECTORY_STATUSES = new Set<DirectoryStatusFilter>(["all", "active", "invited", "external"]);
const DIRECTORY_SORTS = new Set<DirectorySort>(["name", "company", "role", "status"]);

function readEnum<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T | null {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase() as T;
  return allowed.has(normalized) ? normalized : null;
}

function boolQuery(value: unknown, fallback: boolean): boolean | null {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function readLang(value: unknown): DirectoryLang {
  return String(value ?? "").trim().toLowerCase() === "es" ? "es" : "en";
}

function normalizeSearch(value: unknown) {
  return String(value ?? "").trim().slice(0, 120).toLowerCase();
}

function cleanPdfText(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || "-";
}

function directoryLabels(lang: DirectoryLang) {
  const es = lang === "es";
  return {
    reportTitle: es ? "Directorio del Proyecto — Vista actual" : "Project Directory — Current View",
    reportSubtitle: es ? "Directorio autorizado del proyecto" : "Authorized project directory",
    preparedBy: es ? "Preparado por" : "Prepared by",
    generated: es ? "Generado" : "Generated",
    matching: es ? "Coincidencias" : "Matching",
    of: es ? "de" : "of",
    currentViewFilters: es ? "Filtros de vista actual" : "Current view filters",
    visibleColumns: es ? "Columnas visibles" : "Visible columns",
    selectedSections: es ? "Secciones seleccionadas" : "Selected sections",
    sourceView: es ? "Vista origen" : "Source view",
    projectDirectory: es ? "Directorio del Proyecto" : "Project Directory",
    search: es ? "Búsqueda" : "Search",
    scope: es ? "Alcance" : "Scope",
    role: es ? "Rol" : "Role",
    status: es ? "Estado" : "Status",
    sort: es ? "Orden" : "Sort",
    all: es ? "Todos" : "All",
    none: es ? "Ninguna" : "None",
    name: es ? "Nombre" : "Name",
    email: es ? "Correo" : "Email",
    company: es ? "Empresa" : "Company",
    projectMembers: es ? "Miembros del Proyecto" : "Project Members",
    additionalContacts: es ? "Contactos Adicionales" : "Additional Contacts",
    allDirectoryRecords: es ? "Todos los registros" : "All Directory Records",
    allRoles: es ? "Todos los roles" : "All Roles",
    administrators: es ? "Administradores" : "Administrators",
    externalContacts: es ? "Contactos Externos" : "External Contacts",
    allStatuses: es ? "Todos los estados" : "All Statuses",
    bimlogActive: es ? "BIMLog Activo" : "BIMLog Active",
    invited: es ? "Invitado" : "Invited",
    external: es ? "Externo" : "External",
    directoryEmpty: es ? "Directorio vacío" : "Directory Empty",
    filteredViewEmpty: es ? "Vista filtrada vacía" : "Filtered View Empty",
    emptyProject: es ? "No se han agregado registros al directorio de este proyecto." : "No directory records have been added to this project.",
    emptyFiltered: es ? "Ningún registro del directorio coincide con los filtros actuales." : "No directory records match the current filters.",
    noMemberMatches: es ? "Ningún miembro del proyecto coincide con esta vista." : "No project members match this view.",
    noContactMatches: es ? "Ningún contacto adicional coincide con esta vista." : "No additional contacts match this view.",
    duplicateConsolidation: es ? "Correos duplicados consolidados bajo Miembros del Proyecto" : "Duplicate contact emails consolidated under Project Members",
  };
}

function scopeLabel(scope: DirectoryScope, labels: ReturnType<typeof directoryLabels>) {
  if (scope === "members") return labels.projectMembers;
  if (scope === "contacts") return labels.additionalContacts;
  return labels.allDirectoryRecords;
}

function roleLabel(role: DirectoryRoleFilter, labels: ReturnType<typeof directoryLabels>) {
  if (role === "admin") return labels.administrators;
  if (role === "member") return labels.projectMembers;
  if (role === "external") return labels.externalContacts;
  return labels.allRoles;
}

function statusLabel(status: DirectoryStatusFilter, labels: ReturnType<typeof directoryLabels>) {
  if (status === "active") return labels.bimlogActive;
  if (status === "invited") return labels.invited;
  if (status === "external") return labels.external;
  return labels.allStatuses;
}

function sortLabel(sort: DirectorySort, labels: ReturnType<typeof directoryLabels>) {
  if (sort === "company") return labels.company;
  if (sort === "role") return labels.role;
  if (sort === "status") return labels.status;
  return labels.name;
}

function directoryStatusLabel(status: DirectoryExportRow["status"], labels: ReturnType<typeof directoryLabels>) {
  if (status === "active") return labels.bimlogActive;
  if (status === "invited") return labels.invited;
  return labels.external;
}

async function buildDirectoryRows(projectId: number): Promise<DirectoryExportRow[]> {
  const [members, directoryRows] = await Promise.all([
    db.select({
      memberId: projectMembersTable.id,
      fullName: usersTable.fullName,
      email: usersTable.email,
      companyName: companiesTable.name,
      role: projectMembersTable.role,
    })
      .from(projectMembersTable)
      .innerJoin(usersTable, eq(usersTable.id, projectMembersTable.userId))
      .leftJoin(companiesTable, eq(companiesTable.id, usersTable.companyId))
      .where(eq(projectMembersTable.projectId, projectId))
      .orderBy(asc(usersTable.fullName)),
    db.select().from(projectDirectoryTable)
      .where(eq(projectDirectoryTable.projectId, projectId))
      .orderBy(asc(projectDirectoryTable.fullName)),
  ]);

  const memberEmails = new Set(members.map(m => (m.email || "").trim().toLowerCase()));
  const memberRows: DirectoryExportRow[] = members.map(m => ({
    source: "member",
    fullName: m.fullName,
    email: m.email,
    companyName: m.companyName || null,
    role: m.role,
    status: "active",
  }));
  const contactRows: DirectoryExportRow[] = directoryRows
    .filter(row => !memberEmails.has((row.email || "").trim().toLowerCase()))
    .map(row => ({
      source: "contact",
      fullName: row.fullName,
      email: row.email,
      companyName: row.companyName || null,
      role: row.role,
      status: row.bimlogStatus === "invited" ? "invited" : "external",
    }));
  return [...memberRows, ...contactRows];
}

function filterDirectoryRows(rows: DirectoryExportRow[], options: {
  search: string;
  scope: DirectoryScope;
  role: DirectoryRoleFilter;
  status: DirectoryStatusFilter;
  sort: DirectorySort;
  includeMembers: boolean;
  includeContacts: boolean;
}) {
  const filtered = rows.filter(row => {
    if (!options.includeMembers && row.source === "member") return false;
    if (!options.includeContacts && row.source === "contact") return false;
    if (options.scope === "members" && row.source !== "member") return false;
    if (options.scope === "contacts" && row.source !== "contact") return false;
    if (options.role === "admin" && !["admin", "project_admin"].includes(row.role)) return false;
    if (options.role === "member" && (row.source !== "member" || ["admin", "project_admin"].includes(row.role))) return false;
    if (options.role === "external" && row.source !== "contact") return false;
    if (options.status !== "all" && row.status !== options.status) return false;
    if (!options.search) return true;
    return [row.fullName, row.email, row.companyName, row.role, row.status]
      .some(value => String(value || "").toLowerCase().includes(options.search));
  });
  const read = (row: DirectoryExportRow) => {
    if (options.sort === "company") return row.companyName || "";
    if (options.sort === "role") return row.role || "";
    if (options.sort === "status") return row.status || "";
    return row.fullName || "";
  };
  return filtered.sort((a, b) => read(a).localeCompare(read(b)) || a.fullName.localeCompare(b.fullName));
}

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
router.get("/projects/:projectId/directory/export-pdf", authMiddleware, requireProjectMember(), async (req, res) => {
  const projectId = Number(req.params.projectId);
  const reportDate = new Date();
  try {
    const lang = readLang(req.query.lang);
    const labels = directoryLabels(lang);
    const scope = readEnum(req.query.scope, DIRECTORY_SCOPES, "all");
    const role = readEnum(req.query.role, DIRECTORY_ROLES, "all");
    const status = readEnum(req.query.status, DIRECTORY_STATUSES, "all");
    const sort = readEnum(req.query.sort, DIRECTORY_SORTS, "name");
    if (!scope || !role || !status || !sort) {
      res.status(400).json({ error: "Invalid directory export filter" });
      return;
    }

    const includeMembers = boolQuery(req.query.include_members, true);
    const includeContacts = boolQuery(req.query.include_contacts, true);
    const includeEmail = boolQuery(req.query.include_email, true);
    const includeCompany = boolQuery(req.query.include_company, true);
    const includeRole = boolQuery(req.query.include_role, true);
    const includeStatus = boolQuery(req.query.include_status, true);
    if (includeMembers === null || includeContacts === null || includeEmail === null || includeCompany === null || includeRole === null || includeStatus === null) {
      res.status(400).json({ error: "Invalid directory export boolean option" });
      return;
    }

    const options = {
      search: normalizeSearch(req.query.search),
      scope,
      role,
      status,
      sort,
      includeMembers,
      includeContacts,
      includeEmail,
      includeCompany,
      includeRole,
      includeStatus,
    };
    if (!options.includeMembers && !options.includeContacts) {
      res.status(400).json({ error: "Select at least one directory section" });
      return;
    }

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const allRows = await buildDirectoryRows(projectId);
    const filteredRows = filterDirectoryRows(allRows, options);
    const memberRows = filteredRows.filter(row => row.source === "member");
    const contactRows = filteredRows.filter(row => row.source === "contact");
    const duplicateContactCount = Math.max(0, (await db.select().from(projectDirectoryTable).where(eq(projectDirectoryTable.projectId, projectId))).length - allRows.filter(row => row.source === "contact").length);
    const reportNumber = `DIR-${project.code}-${reportDate.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`;
    const reportTitle = labels.reportTitle;
    const fileName = reportFileName(reportTitle);
    const filterSummary = [
      `${labels.search}: ${options.search || labels.all}`,
      `${labels.scope}: ${scopeLabel(scope, labels)}`,
      `${labels.role}: ${roleLabel(role, labels)}`,
      `${labels.status}: ${statusLabel(status, labels)}`,
      `${labels.sort}: ${sortLabel(sort, labels)}`,
    ];
    const selectedSections = [
      options.includeMembers ? labels.projectMembers : "",
      options.includeContacts ? labels.additionalContacts : "",
    ].filter(Boolean);
    const visibleColumns = [
      labels.name,
      options.includeEmail ? labels.email : "",
      options.includeCompany ? labels.company : "",
      options.includeRole ? labels.role : "",
      options.includeStatus ? labels.status : "",
    ].filter(Boolean);
    const snapshot = {
      projectId,
      reportNumber,
      generatedAt: reportDate.toISOString(),
      filters: { ...options, labels: { scope: scopeLabel(scope, labels), role: roleLabel(role, labels), status: statusLabel(status, labels), sort: sortLabel(sort, labels) } },
      selectedSections,
      visibleColumns,
      matchingCount: filteredRows.length,
      totalCount: allRows.length,
      duplicateContactCount,
      rows: filteredRows,
    };
    const contentHash = computeContentHash(snapshot);

    const doc = createPdfDocument({ size: "LETTER", margin: 40, bufferPages: true, autoFirstPage: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader("X-Report-Filename", fileName);
    doc.pipe(res);

    const theme = REPORT_THEMES.platform.standard;
    doc.y = drawBrandedHeader(doc, {
      margin: 40,
      companyName: req.user!.companyName || "Company",
      title: reportTitle,
      subtitle: labels.reportSubtitle,
      projectName: project.name,
      projectCode: project.code,
      reportNumber,
      reportDate,
      theme,
    }) + 12;

    doc.fontSize(8).font(PALETTE.FONT).fillColor(PALETTE.TEXT)
      .text(`${labels.preparedBy}: ${req.user!.fullName} | ${labels.generated}: ${reportDate.toISOString()} | ${labels.matching}: ${filteredRows.length} ${labels.of} ${allRows.length}`, 40, doc.y, { width: 532 });
    doc.moveDown(0.6);
    doc.fontSize(8).font(PALETTE.FONT).fillColor(PALETTE.MUTED)
      .text(`${labels.currentViewFilters}: ${filterSummary.join(" | ")}`, 40, doc.y, { width: 532 });
    doc.moveDown(0.5);
    doc.fontSize(8).font(PALETTE.FONT).fillColor(PALETTE.MUTED)
      .text(`${labels.selectedSections}: ${selectedSections.join(", ") || labels.none} | ${labels.visibleColumns}: ${visibleColumns.join(", ")} | ${labels.sourceView}: ${labels.projectDirectory}`, 40, doc.y, { width: 532 });
    if (duplicateContactCount > 0) {
      doc.moveDown(0.5);
      doc.fontSize(8).font(PALETTE.FONT).fillColor(PALETTE.MUTED)
        .text(`${labels.duplicateConsolidation}: ${duplicateContactCount}`, 40, doc.y, { width: 532 });
    }
    doc.moveDown(1);

    const makeColumns = (): TableColumn[] => {
      const columns: TableColumn[] = [
        { label: labels.name, width: 125, wrap: true, bold: true, format: row => cleanPdfText(row.fullName) },
      ];
      if (options.includeEmail) columns.push({ label: labels.email, width: 135, wrap: true, format: row => cleanPdfText(row.email) });
      if (options.includeCompany) columns.push({ label: labels.company, width: 115, wrap: true, format: row => cleanPdfText(row.companyName) });
      if (options.includeRole) columns.push({ label: labels.role, width: 80, wrap: true, format: row => cleanPdfText(row.role) });
      if (options.includeStatus) columns.push({ label: labels.status, width: 75, format: row => directoryStatusLabel(row.status, labels) });
      return columns;
    };
    const columns = makeColumns();
    const pageHeader = () => {
      doc.addPage();
      return drawBrandedHeader(doc, {
        margin: 40,
        companyName: req.user!.companyName || "Company",
        title: reportTitle,
        projectName: project.name,
        projectCode: project.code,
        reportNumber,
        reportDate,
        theme,
      }) + 12;
    };
    let y = doc.y;
    if (filteredRows.length === 0) {
      const message = allRows.length === 0
        ? labels.emptyProject
        : labels.emptyFiltered;
      y = sectionBar(doc, allRows.length === 0 ? labels.directoryEmpty : labels.filteredViewEmpty, y, { theme });
      doc.fontSize(10).font(PALETTE.FONT).fillColor(PALETTE.TEXT).text(message, 40, y, { width: 532 });
    } else {
      if (options.includeMembers) {
        y = sectionBar(doc, `${labels.projectMembers} (${memberRows.length})`, y, { theme });
        if (memberRows.length) y = drawTable(doc, { x: 40, startY: y, columns, rows: memberRows, fontSize: 7, headerFontSize: 7, rowMinHeight: 26, pageBottom: 710, onPageBreak: pageHeader });
        else doc.fontSize(9).font(PALETTE.FONT).fillColor(PALETTE.MUTED).text(labels.noMemberMatches, 40, y, { width: 532 });
        y = doc.y + 12;
      }
      if (options.includeContacts) {
        if (y > 650) y = pageHeader();
        y = sectionBar(doc, `${labels.additionalContacts} (${contactRows.length})`, y, { theme });
        if (contactRows.length) drawTable(doc, { x: 40, startY: y, columns, rows: contactRows, fontSize: 7, headerFontSize: 7, rowMinHeight: 26, pageBottom: 710, onPageBreak: pageHeader });
        else doc.fontSize(9).font(PALETTE.FONT).fillColor(PALETTE.MUTED).text(labels.noContactMatches, 40, y, { width: 532 });
      }
    }

    addPageNumbers(doc, {
      margin: 40,
      footerY: 756,
      fingerprintY: 742,
      companyName: req.user!.companyName || "Company",
      projectName: project.name,
      timestamp: reportDate.toLocaleDateString("en-US"),
      reportNumber,
      contentHash,
    });
    doc.end();
  } catch (err) {
    res.status(500).json({ error: "directory_export_failed" });
  }
});

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
