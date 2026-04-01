import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable, companiesTable, projectsTable, projectMembersTable,
  filesTable, rfisTable, submittalsTable, activityLogTable,
  emailLogTable, featureFlagsTable, adminActionsLogTable,
} from "@workspace/db/schema";
import { eq, desc, count, gte, and, or, ilike, sql, lt } from "drizzle-orm";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";

const router = Router();

router.use("/admin", authMiddleware, (req, res, next) => {
  if (req.method === "GET" && req.query.scope === "mine") return next();
  if (req.method === "GET" && req.path.includes("feature-flags")) return next();
  if (!req.user?.isSuperAdmin) return res.status(403).json({ error: "Super admin access required" });
  next();
});

const DEFAULT_FLAGS = [
  { flagName: "ai_presubmission_check", enabled: true },
  { flagName: "ai_name_suggestion", enabled: true },
  { flagName: "audit_certificate", enabled: true },
  { flagName: "email_notifications", enabled: true },
  { flagName: "rapid_approval_detection", enabled: true },
  { flagName: "procurement_before_approval_warning", enabled: true },
];

async function logAdminAction(params: {
  adminUserId: number;
  adminEmail: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}) {
  await db.insert(adminActionsLogTable).values({
    adminUserId: params.adminUserId,
    adminEmail: params.adminEmail,
    action: params.action,
    targetType: params.targetType || null,
    targetId: params.targetId || null,
    details: params.details || null,
  });
}

// ── Tab 1: Platform Overview ──────────────────────────────────────────────────
router.get("/admin/overview", async (req, res) => {
  try {
    const scope = String(req.query.scope || "");
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (scope === "mine") {
      const myProjectIds = (await db.select({ pid: projectMembersTable.projectId }).from(projectMembersTable)
        .where(and(eq(projectMembersTable.userId, req.user!.userId), eq(projectMembersTable.role, "project_admin")))).map(r => r.pid);
      if (myProjectIds.length === 0) {
        res.json({ stats: { totalUsers: 0, totalCompanies: 0, totalProjects: 0, totalFiles: 0, totalRfis: 0, totalSubmittals: 0, activeProjects: 0, filesLast24h: 0, rfisLast7d: 0 }, activity: [] });
        return;
      }
      const pArr = sql.raw(myProjectIds.join(","));
      const pFilter = sql`${projectsTable.id} = ANY(ARRAY[${pArr}]::int[])`;
      const fFilter = sql`${filesTable.projectId} = ANY(ARRAY[${pArr}]::int[])`;
      const rFilter = sql`${rfisTable.projectId} = ANY(ARRAY[${pArr}]::int[])`;
      const sFilter = sql`${submittalsTable.projectId} = ANY(ARRAY[${pArr}]::int[])`;
      const scopedUserIds = [...new Set((await db.select({ uid: projectMembersTable.userId }).from(projectMembersTable)
        .where(sql`${projectMembersTable.projectId} = ANY(ARRAY[${pArr}]::int[])`)).map(r => r.uid))];
      const uArr = scopedUserIds.length > 0 ? sql.raw(scopedUserIds.join(",")) : sql.raw("0");
      const uFilter = sql`${usersTable.id} = ANY(ARRAY[${uArr}]::int[])`;
      const scopedCompanyIds = [...new Set((await db.select({ cid: usersTable.companyId }).from(usersTable).where(uFilter)).map(r => r.cid))];
      const cArr = scopedCompanyIds.length > 0 ? sql.raw(scopedCompanyIds.join(",")) : sql.raw("0");
      const cFilter = sql`${companiesTable.id} = ANY(ARRAY[${cArr}]::int[])`;
      const [
        [{ c: tU }], [{ c: tC }], [{ c: tP }], [{ c: tF }],
        [{ c: tR }], [{ c: tS }], [{ c: aP }], [{ c: f24 }], [{ c: r7 }],
      ] = await Promise.all([
        db.select({ c: count() }).from(usersTable).where(uFilter),
        db.select({ c: count() }).from(companiesTable).where(cFilter),
        db.select({ c: count() }).from(projectsTable).where(pFilter),
        db.select({ c: count() }).from(filesTable).where(fFilter),
        db.select({ c: count() }).from(rfisTable).where(rFilter),
        db.select({ c: count() }).from(submittalsTable).where(sFilter),
        db.select({ c: count() }).from(projectsTable).where(and(pFilter, eq(projectsTable.status, "active"))),
        db.select({ c: count() }).from(filesTable).where(and(fFilter, gte(filesTable.createdAt, last24h))),
        db.select({ c: count() }).from(rfisTable).where(and(rFilter, gte(rfisTable.createdAt, last7d))),
      ]);
      const activity = await db.select().from(activityLogTable)
        .where(sql`${activityLogTable.projectId} = ANY(ARRAY[${pArr}]::int[])`)
        .orderBy(desc(activityLogTable.createdAt)).limit(50);
      const actProjIds = [...new Set(activity.map(a => a.projectId))];
      const actProjects = actProjIds.length > 0 ? await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(sql`${projectsTable.id} = ANY(${sql.raw(`ARRAY[${actProjIds.join(",")}]`)})`) : [];
      const projectMap = Object.fromEntries(actProjects.map(p => [p.id, p.name]));
      res.json({
        stats: { totalUsers: Number(tU), totalCompanies: Number(tC), totalProjects: Number(tP), totalFiles: Number(tF), totalRfis: Number(tR), totalSubmittals: Number(tS), activeProjects: Number(aP), filesLast24h: Number(f24), rfisLast7d: Number(r7) },
        activity: activity.map(a => ({ ...a, projectName: projectMap[a.projectId] || `Project #${a.projectId}`, createdAt: a.createdAt.toISOString() })),
      });
      return;
    }

    const [
      [totalUsers], [totalCompanies], [totalProjects], [totalFiles],
      [totalRfis], [totalSubmittals], [activeProjects], [filesLast24h], [rfisLast7d],
    ] = await Promise.all([
      db.select({ c: count() }).from(usersTable),
      db.select({ c: count() }).from(companiesTable),
      db.select({ c: count() }).from(projectsTable),
      db.select({ c: count() }).from(filesTable),
      db.select({ c: count() }).from(rfisTable),
      db.select({ c: count() }).from(submittalsTable),
      db.select({ c: count() }).from(projectsTable).where(eq(projectsTable.status, "active")),
      db.select({ c: count() }).from(filesTable).where(gte(filesTable.createdAt, last24h)),
      db.select({ c: count() }).from(rfisTable).where(gte(rfisTable.createdAt, last7d)),
    ]);
    const activity = await db.select().from(activityLogTable).orderBy(desc(activityLogTable.createdAt)).limit(50);
    const projectIds = [...new Set(activity.map(a => a.projectId))];
    const projects = projectIds.length > 0
      ? await db.select({ id: projectsTable.id, name: projectsTable.name }).from(projectsTable).where(sql`${projectsTable.id} = ANY(${sql.raw(`ARRAY[${projectIds.join(",")}]`)})`)
      : [];
    const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
    res.json({
      stats: {
        totalUsers: Number(totalUsers?.c || 0), totalCompanies: Number(totalCompanies?.c || 0),
        totalProjects: Number(totalProjects?.c || 0), totalFiles: Number(totalFiles?.c || 0),
        totalRfis: Number(totalRfis?.c || 0), totalSubmittals: Number(totalSubmittals?.c || 0),
        activeProjects: Number(activeProjects?.c || 0), filesLast24h: Number(filesLast24h?.c || 0),
        rfisLast7d: Number(rfisLast7d?.c || 0),
      },
      activity: activity.map(a => ({ ...a, projectName: projectMap[a.projectId] || `Project #${a.projectId}`, createdAt: a.createdAt.toISOString() })),
    });
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
});

// ── Tab 6: Full Platform Activity Feed ────────────────────────────────────────
router.get("/admin/activity", async (req, res) => {
  try {
    const scope = String(req.query.scope || "");
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = 50;
    const offset = (page - 1) * limit;
    let activity, total;
    if (scope === "mine") {
      const myProjectIds = (await db.select({ pid: projectMembersTable.projectId }).from(projectMembersTable)
        .where(and(eq(projectMembersTable.userId, req.user!.userId), eq(projectMembersTable.role, "project_admin")))).map(r => r.pid);
      if (myProjectIds.length === 0) { res.json({ data: [], total: 0, page, pages: 0 }); return; }
      const where = sql`${activityLogTable.projectId} = ANY(ARRAY[${sql.raw(myProjectIds.join(","))}]::int[])`;
      activity = await db.select().from(activityLogTable).where(where).orderBy(desc(activityLogTable.createdAt)).limit(limit).offset(offset);
      [{ total }] = await db.select({ total: count() }).from(activityLogTable).where(where);
    } else {
      activity = await db.select().from(activityLogTable).orderBy(desc(activityLogTable.createdAt)).limit(limit).offset(offset);
      [{ total }] = await db.select({ total: count() }).from(activityLogTable);
    }
    const projectIds = [...new Set(activity.map(a => a.projectId))];
    let projectMap: Record<number, { name: string; companyId: number }> = {};
    if (projectIds.length > 0) {
      const ps = await db.select({ id: projectsTable.id, name: projectsTable.name, createdById: projectsTable.createdById }).from(projectsTable).where(sql`${projectsTable.id} = ANY(${sql.raw(`ARRAY[${projectIds.join(",")}]`)})`);
      ps.forEach(p => { projectMap[p.id] = { name: p.name, companyId: 0 }; });
    }
    res.json({ data: activity.map(a => ({ ...a, projectName: projectMap[a.projectId]?.name || `Project #${a.projectId}`, createdAt: a.createdAt.toISOString() })), total: Number(total), page, pages: Math.ceil(Number(total) / limit) });
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
});

// ── Tab 2: Users ──────────────────────────────────────────────────────────────
router.get("/admin/users", async (req, res) => {
  try {
    const scope = String(req.query.scope || "");
    const search = String(req.query.search || "").trim();
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = 50;
    const offset = (page - 1) * limit;

    let scopedUserIds: number[] | null = null;
    if (scope === "mine") {
      const myProjectIds = (await db.select({ pid: projectMembersTable.projectId }).from(projectMembersTable)
        .where(and(eq(projectMembersTable.userId, req.user!.userId), eq(projectMembersTable.role, "project_admin")))).map(r => r.pid);
      if (myProjectIds.length === 0) { res.json({ data: [], total: 0, page: 1, pages: 0 }); return; }
      scopedUserIds = (await db.select({ uid: projectMembersTable.userId }).from(projectMembersTable)
        .where(sql`${projectMembersTable.projectId} = ANY(ARRAY[${sql.raw(myProjectIds.join(","))}]::int[])`)
      ).map(r => r.uid);
      if (scopedUserIds.length === 0) { res.json({ data: [], total: 0, page: 1, pages: 0 }); return; }
    }

    const scopeFilter = scopedUserIds ? sql`${usersTable.id} = ANY(ARRAY[${sql.raw([...new Set(scopedUserIds)].join(","))}]::int[])` : undefined;
    const searchFilter = search ? or(ilike(usersTable.fullName, `%${search}%`), ilike(usersTable.email, `%${search}%`)) : undefined;
    const where = scopeFilter && searchFilter ? and(scopeFilter, searchFilter) : scopeFilter || searchFilter;

    const users = await db.select({
      id: usersTable.id, fullName: usersTable.fullName, email: usersTable.email,
      companyId: usersTable.companyId, createdAt: usersTable.createdAt,
      isSuperAdmin: usersTable.isSuperAdmin, jobTitle: usersTable.jobTitle,
    }).from(usersTable).where(where).orderBy(desc(usersTable.createdAt)).limit(limit).offset(offset);
    const companyIds = [...new Set(users.map(u => u.companyId))];
    const companies = companyIds.length > 0
      ? await db.select().from(companiesTable).where(sql`${companiesTable.id} = ANY(${sql.raw(`ARRAY[${companyIds.join(",")}]`)})`)
      : [];
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));
    const projectCounts: Record<number, number> = {};
    for (const u of users) {
      const [{ c }] = await db.select({ c: count() }).from(projectMembersTable).where(eq(projectMembersTable.userId, u.id));
      projectCounts[u.id] = Number(c);
    }
    const [{ total }] = where
      ? await db.select({ total: count() }).from(usersTable).where(where)
      : await db.select({ total: count() }).from(usersTable);
    res.json({
      data: users.map(u => ({ ...u, companyName: companyMap[u.companyId] || "", projectCount: projectCounts[u.id] || 0, createdAt: u.createdAt.toISOString() })),
      total: Number(total), page, pages: Math.ceil(Number(total) / limit),
    });
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
});

router.post("/admin/users", async (req, res) => {
  try {
    const { fullName, email, password, companyName, role } = req.body as { fullName: string; email: string; password: string; companyName: string; role?: string };
    if (!fullName || !email || !password || !companyName) { res.status(400).json({ error: "fullName, email, password, companyName are required" }); return; }
    let company = (await db.select().from(companiesTable).where(ilike(companiesTable.name, companyName)).limit(1))[0];
    if (!company) {
      [company] = await db.insert(companiesTable).values({ name: companyName }).returning();
    }
    const hash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ fullName, email: email.toLowerCase(), passwordHash: hash, companyId: company.id }).returning();
    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "create_user", targetType: "user", targetId: String(user.id), details: { email, fullName, companyName } });
    res.status(201).json({ ...user, createdAt: user.createdAt.toISOString() });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create user" }); }
});

router.patch("/admin/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fullName, email, role, isSuperAdmin, deactivated } = req.body as { fullName?: string; email?: string; role?: string; isSuperAdmin?: boolean; deactivated?: boolean };
    const updates: Record<string, unknown> = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (email !== undefined) updates.email = email.toLowerCase();
    if (isSuperAdmin !== undefined) updates.isSuperAdmin = isSuperAdmin;
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "update_user", targetType: "user", targetId: String(id), details: req.body });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update user" }); }
});

router.delete("/admin/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user!.userId) { res.status(400).json({ error: "Cannot delete your own account" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    await db.delete(projectMembersTable).where(eq(projectMembersTable.userId, id));
    await db.delete(usersTable).where(eq(usersTable.id, id));
    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "delete_user", targetType: "user", targetId: String(id), details: { email: user.email, fullName: user.fullName } });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete user" }); }
});

router.post("/admin/users/:id/reset-password", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { password } = req.body as { password?: string };
    if (!password || password.length < 8) { res.status(400).json({ error: "Password must be at least 8 characters" }); return; }
    const hash = await bcrypt.hash(password, 10);
    await db.update(usersTable).set({ passwordHash: hash }).where(eq(usersTable.id, id));
    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "reset_user_password", targetType: "user", targetId: String(id) });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to reset password" }); }
});

// ── Tab 3: Companies ──────────────────────────────────────────────────────────
router.get("/admin/companies", async (req, res) => {
  try {
    const scope = String(req.query.scope || "");
    let companies;
    if (scope === "mine") {
      const myProjectIds = (await db.select({ pid: projectMembersTable.projectId }).from(projectMembersTable)
        .where(and(eq(projectMembersTable.userId, req.user!.userId), eq(projectMembersTable.role, "project_admin")))).map(r => r.pid);
      if (myProjectIds.length === 0) { res.json([]); return; }
      const scopedUserIds = [...new Set((await db.select({ uid: projectMembersTable.userId }).from(projectMembersTable)
        .where(sql`${projectMembersTable.projectId} = ANY(ARRAY[${sql.raw(myProjectIds.join(","))}]::int[])`)).map(r => r.uid))];
      if (scopedUserIds.length === 0) { res.json([]); return; }
      const scopedCompanyIds = [...new Set((await db.select({ cid: usersTable.companyId }).from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.raw(scopedUserIds.join(","))}]::int[])`)).map(r => r.cid))];
      if (scopedCompanyIds.length === 0) { res.json([]); return; }
      companies = await db.select().from(companiesTable)
        .where(sql`${companiesTable.id} = ANY(ARRAY[${sql.raw(scopedCompanyIds.join(","))}]::int[])`)
        .orderBy(desc(companiesTable.createdAt));
    } else {
      companies = await db.select().from(companiesTable).orderBy(desc(companiesTable.createdAt));
    }
    const result = await Promise.all(companies.map(async (c) => {
      const [{ userCount }] = await db.select({ userCount: count() }).from(usersTable).where(eq(usersTable.companyId, c.id));
      const [{ projectCount }] = await db.select({ projectCount: count() }).from(projectsTable).where(
        sql`${projectsTable.id} IN (SELECT DISTINCT project_id FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE u.company_id = ${c.id})`
      );
      return { ...c, createdAt: c.createdAt.toISOString(), userCount: Number(userCount), projectCount: Number(projectCount) };
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
});

router.patch("/admin/companies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, website, address, phone } = req.body as { name?: string; website?: string; address?: string; phone?: string };
    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (website !== undefined) updates.website = website;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    const [updated] = await db.update(companiesTable).set(updates).where(eq(companiesTable.id, id)).returning();
    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "update_company", targetType: "company", targetId: String(id), details: req.body });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update company" }); }
});

router.delete("/admin/companies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, id)).limit(1);
    if (!company) { res.status(404).json({ error: "Company not found" }); return; }
    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "delete_company", targetType: "company", targetId: String(id), details: { name: company.name } });
    await db.delete(companiesTable).where(eq(companiesTable.id, id));
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete company" }); }
});

// ── Tab 4: Projects ───────────────────────────────────────────────────────────
router.get("/admin/projects", async (req, res) => {
  try {
    const scope = String(req.query.scope || "");
    let projects;
    if (scope === "mine") {
      const myIds = (await db.select({ pid: projectMembersTable.projectId }).from(projectMembersTable)
        .where(and(eq(projectMembersTable.userId, req.user!.userId), eq(projectMembersTable.role, "project_admin")))).map(r => r.pid);
      if (myIds.length === 0) { res.json([]); return; }
      projects = await db.select().from(projectsTable)
        .where(sql`${projectsTable.id} = ANY(ARRAY[${sql.raw(myIds.join(","))}]::int[])`)
        .orderBy(desc(projectsTable.createdAt));
    } else {
      projects = await db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt));
    }
    const result = await Promise.all(projects.map(async (p) => {
      const [[{ memberCount }], [{ fileCount }], [{ rfiCount }], [{ submittalCount }]] = await Promise.all([
        db.select({ memberCount: count() }).from(projectMembersTable).where(eq(projectMembersTable.projectId, p.id)),
        db.select({ fileCount: count() }).from(filesTable).where(eq(filesTable.projectId, p.id)),
        db.select({ rfiCount: count() }).from(rfisTable).where(eq(rfisTable.projectId, p.id)),
        db.select({ submittalCount: count() }).from(submittalsTable).where(eq(submittalsTable.projectId, p.id)),
      ]);
      const adminMember = (await db.select({ userId: projectMembersTable.userId }).from(projectMembersTable)
        .where(and(eq(projectMembersTable.projectId, p.id), eq(projectMembersTable.role, "project_admin"))).limit(1))[0];
      let companyName = "";
      if (adminMember) {
        const adminUser = (await db.select({ companyId: usersTable.companyId }).from(usersTable).where(eq(usersTable.id, adminMember.userId)).limit(1))[0];
        if (adminUser) {
          const adminCo = (await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, adminUser.companyId)).limit(1))[0];
          if (adminCo) companyName = adminCo.name;
        }
      }
      if (!companyName) {
        const creator = (await db.select({ companyId: usersTable.companyId }).from(usersTable).where(eq(usersTable.id, p.createdById)).limit(1))[0];
        if (creator) {
          const co = (await db.select({ name: companiesTable.name }).from(companiesTable).where(eq(companiesTable.id, creator.companyId)).limit(1))[0];
          if (co) companyName = co.name;
        }
      }
      return { ...p, createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(), memberCount: Number(memberCount), fileCount: Number(fileCount), rfiCount: Number(rfiCount), submittalCount: Number(submittalCount), companyName };
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
});

router.patch("/admin/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, name } = req.body as { status?: string; name?: string };
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (name) updates.name = name;
    const [updated] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, id)).returning();
    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "update_project", targetType: "project", targetId: String(id), details: req.body });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update project" }); }
});

router.delete("/admin/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "delete_project", targetType: "project", targetId: String(id), details: { name: project.name, code: project.code } });
    await db.delete(projectMembersTable).where(eq(projectMembersTable.projectId, id));
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete project" }); }
});

router.post("/admin/projects/:id/transfer", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { newOwnerId } = req.body as { newOwnerId: number };
    const [newOwner] = await db.select().from(usersTable).where(eq(usersTable.id, newOwnerId)).limit(1);
    if (!newOwner) { res.status(404).json({ error: "New owner not found" }); return; }
    const [updated] = await db.update(projectsTable).set({ createdById: newOwnerId, updatedAt: new Date() }).where(eq(projectsTable.id, id)).returning();
    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "transfer_project_ownership", targetType: "project", targetId: String(id), details: { newOwnerId, newOwnerEmail: newOwner.email } });
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to transfer project" }); }
});

// ── Tab 5: Email Log ──────────────────────────────────────────────────────────
router.get("/admin/email-log", async (req, res) => {
  try {
    const scope = String(req.query.scope || "");
    if (scope === "mine" && !req.user?.isSuperAdmin) {
      res.json({ data: [], total: 0, page: 1, pages: 0 });
      return;
    }
    const { status, triggerType, from, to } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = 50;
    const offset = (page - 1) * limit;
    const conditions = [];
    if (status) conditions.push(eq(emailLogTable.status, status));
    if (triggerType) conditions.push(eq(emailLogTable.triggerType, triggerType));
    if (from) conditions.push(gte(emailLogTable.sentAt, new Date(from)));
    if (to) conditions.push(lt(emailLogTable.sentAt, new Date(to)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const logs = await db.select().from(emailLogTable).where(where).orderBy(desc(emailLogTable.sentAt)).limit(limit).offset(offset);
    const [{ total }] = where
      ? await db.select({ total: count() }).from(emailLogTable).where(where)
      : await db.select({ total: count() }).from(emailLogTable);
    res.json({ data: logs.map(l => ({ ...l, sentAt: l.sentAt.toISOString() })), total: Number(total), page, pages: Math.ceil(Number(total) / limit) });
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
});

// ── Tab 7: Feature Flags ──────────────────────────────────────────────────────
router.get("/admin/feature-flags", async (req, res) => {
  try {
    const existing = await db.select().from(featureFlagsTable);
    if (existing.length === 0) {
      for (const flag of DEFAULT_FLAGS) {
        await db.insert(featureFlagsTable).values({ ...flag, appliesTo: "global" }).onConflictDoNothing();
      }
      const seeded = await db.select().from(featureFlagsTable);
      return res.json(seeded.map(f => ({ ...f, updatedAt: f.updatedAt.toISOString() })));
    }
    res.json(existing.map(f => ({ ...f, updatedAt: f.updatedAt.toISOString() })));
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
});

router.patch("/admin/feature-flags/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { enabled } = req.body as { enabled: boolean };
    const [flag] = await db.select().from(featureFlagsTable).where(eq(featureFlagsTable.id, id)).limit(1);
    if (!flag) { res.status(404).json({ error: "Flag not found" }); return; }
    const [updated] = await db.update(featureFlagsTable).set({ enabled, updatedAt: new Date(), updatedBy: req.user!.userId }).where(eq(featureFlagsTable.id, id)).returning();
    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "toggle_feature_flag", targetType: "feature_flag", targetId: String(id), details: { flagName: flag.flagName, enabled } });
    res.json({ ...updated, updatedAt: updated.updatedAt.toISOString() });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to update flag" }); }
});

// ── Tab 8: Admin Actions Log ──────────────────────────────────────────────────
router.get("/admin/actions-log", async (req, res) => {
  try {
    const scope = String(req.query.scope || "");
    const page = Math.max(1, parseInt(String(req.query.page || "1")));
    const limit = 50;
    const offset = (page - 1) * limit;
    const where = scope === "mine" ? eq(adminActionsLogTable.adminUserId, req.user!.userId) : undefined;
    const logs = await db.select().from(adminActionsLogTable).where(where).orderBy(desc(adminActionsLogTable.createdAt)).limit(limit).offset(offset);
    const [{ total }] = where
      ? await db.select({ total: count() }).from(adminActionsLogTable).where(where)
      : await db.select({ total: count() }).from(adminActionsLogTable);
    res.json({ data: logs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })), total: Number(total), page, pages: Math.ceil(Number(total) / limit) });
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
});

export default router;
