import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import {
  usersTable, companiesTable, projectsTable, projectMembersTable,
  filesTable, rfisTable, submittalsTable, activityLogTable,
  emailLogTable, featureFlagsTable, adminActionsLogTable,
  namingConventionsTable,
} from "@workspace/db/schema";
import { eq, desc, count, gte, and, or, ilike, sql, lt, ne } from "drizzle-orm";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";

const router = Router();

async function getProjectAdminProjectIds(userId: number): Promise<number[]> {
  return (await db.select({ pid: projectMembersTable.projectId }).from(projectMembersTable)
    .innerJoin(projectsTable, eq(projectsTable.id, projectMembersTable.projectId))
    .where(and(eq(projectMembersTable.userId, userId), eq(projectMembersTable.role, "project_admin"), ne(projectsTable.status, "archived")))).map(r => r.pid);
}

async function isUserInProjects(userId: number, projectIds: number[]): Promise<boolean> {
  if (projectIds.length === 0) return false;
  return (await db.select({ uid: projectMembersTable.userId }).from(projectMembersTable)
    .where(and(eq(projectMembersTable.userId, userId), sql`${projectMembersTable.projectId} = ANY(ARRAY[${sql.raw(projectIds.join(","))}]::int[])`))).length > 0;
}

router.use("/admin", authMiddleware, async (req, res, next) => {
  if (req.user?.isSuperAdmin) return next();
  if (req.method === "GET" && req.query.scope === "mine") return next();
  if (req.method === "GET" && req.path.includes("feature-flags")) return next();

  const myPids = await getProjectAdminProjectIds(req.user!.userId);
  if (myPids.length === 0) return res.status(403).json({ error: "Admin access required" });

  (req as any).isProjectAdminOnly = true;
  (req as any).projectAdminProjectIds = myPids;
  return next();
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

// ── Platform Stats (Super Admin only) ────────────────────────────────────────
router.get("/admin/platform-stats", authMiddleware, async (req, res) => {
  try {
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const [
      [{ c: totalUsers }],
      [{ c: totalProjects }],
      [{ c: totalFiles }],
      [{ c: totalRfis }],
      [{ c: totalSubmittals }],
      [{ c: totalCompanies }],
      [{ c: activeProjects }],
    ] = await Promise.all([
      db.select({ c: count() }).from(usersTable),
      db.select({ c: count() }).from(projectsTable).where(ne(projectsTable.status, "archived")),
      db.select({ c: count() }).from(filesTable),
      db.select({ c: count() }).from(rfisTable),
      db.select({ c: count() }).from(submittalsTable),
      db.select({ c: count() }).from(companiesTable),
      db.select({ c: count() }).from(projectsTable).where(eq(projectsTable.status, "active")),
    ]);
    return res.json({
      totalUsers: Number(totalUsers ?? 0),
      totalProjects: Number(totalProjects ?? 0),
      totalFiles: Number(totalFiles ?? 0),
      totalRfis: Number(totalRfis ?? 0),
      totalSubmittals: Number(totalSubmittals ?? 0),
      totalCompanies: Number(totalCompanies ?? 0),
      activeProjects: Number(activeProjects ?? 0),
      filesLast24h: 0,
      rfisLast7d: 0,
      systemStatus: "healthy",
    });
  } catch(e) {
    return res.status(500).json({ error: "Failed to load stats" });
  }
});

// ── Tab 1: Platform Overview ──────────────────────────────────────────────────
router.get("/admin/ai-usage", async (req, res) => {
  try {
    if (!req.user?.isSuperAdmin) {
      res.status(403).json({ error: "Super admin only" });
      return;
    }

    const monthParam = String(req.query.month || "").trim();
    const monthStart = /^\d{4}-\d{2}$/.test(monthParam)
      ? new Date(`${monthParam}-01T00:00:00.000Z`)
      : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));

    const [summaryResult, usersResult, featuresResult, projectsResult, recentResult] = await Promise.all([
      db.execute(sql`
        SELECT
          count(*)::int AS total_calls,
          coalesce(sum(estimated_units), 0)::int AS total_units,
          count(*) FILTER (WHERE billing_mode = 'included_platform')::int AS included_calls,
          count(*) FILTER (WHERE billing_mode = 'platform_internal')::int AS internal_calls,
          count(*) FILTER (WHERE billing_mode = 'user_key')::int AS user_key_calls,
          count(DISTINCT user_id)::int AS active_users,
          count(DISTINCT project_id) FILTER (WHERE project_id IS NOT NULL)::int AS active_projects
        FROM ai_usage_events
        WHERE created_at >= ${monthStart} AND created_at < ${monthEnd}
      `),
      db.execute(sql`
        SELECT
          u.id AS user_id,
          u.email,
          u.full_name,
          c.name AS company_name,
          count(e.id)::int AS total_calls,
          coalesce(sum(e.estimated_units), 0)::int AS total_units,
          count(e.id) FILTER (WHERE e.billing_mode = 'included_platform')::int AS included_calls,
          count(e.id) FILTER (WHERE e.billing_mode = 'platform_internal')::int AS internal_calls,
          count(e.id) FILTER (WHERE e.billing_mode = 'user_key')::int AS user_key_calls,
          max(e.created_at) AS last_used_at
        FROM ai_usage_events e
        JOIN users u ON u.id = e.user_id
        LEFT JOIN companies c ON c.id = u.company_id
        WHERE e.created_at >= ${monthStart} AND e.created_at < ${monthEnd}
        GROUP BY u.id, u.email, u.full_name, c.name
        ORDER BY total_units DESC, total_calls DESC, last_used_at DESC
        LIMIT 100
      `),
      db.execute(sql`
        SELECT
          feature,
          billing_mode,
          count(*)::int AS total_calls,
          coalesce(sum(estimated_units), 0)::int AS total_units
        FROM ai_usage_events
        WHERE created_at >= ${monthStart} AND created_at < ${monthEnd}
        GROUP BY feature, billing_mode
        ORDER BY total_units DESC, total_calls DESC
        LIMIT 100
      `),
      db.execute(sql`
        SELECT
          p.id AS project_id,
          p.name AS project_name,
          p.code AS project_code,
          count(e.id)::int AS total_calls,
          coalesce(sum(e.estimated_units), 0)::int AS total_units
        FROM ai_usage_events e
        LEFT JOIN projects p ON p.id = e.project_id
        WHERE e.created_at >= ${monthStart} AND e.created_at < ${monthEnd}
        GROUP BY p.id, p.name, p.code
        ORDER BY total_units DESC, total_calls DESC
        LIMIT 50
      `),
      db.execute(sql`
        SELECT
          e.id,
          e.created_at,
          e.feature,
          e.provider,
          e.billing_mode,
          e.estimated_units,
          u.email,
          u.full_name,
          p.name AS project_name,
          p.code AS project_code
        FROM ai_usage_events e
        JOIN users u ON u.id = e.user_id
        LEFT JOIN projects p ON p.id = e.project_id
        WHERE e.created_at >= ${monthStart} AND e.created_at < ${monthEnd}
        ORDER BY e.created_at DESC
        LIMIT 100
      `),
    ]);

    const rows = <T>(result: unknown) => ((result as { rows?: T[] }).rows ?? []);
    res.json({
      month: monthStart.toISOString().slice(0, 7),
      periodStart: monthStart.toISOString(),
      periodEnd: monthEnd.toISOString(),
      summary: rows<Record<string, unknown>>(summaryResult)[0] ?? {},
      users: rows(usersResult),
      features: rows(featuresResult),
      projects: rows(projectsResult),
      recent: rows(recentResult),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/admin/overview", async (req, res) => {
  try {
    const scope = String(req.query.scope || "");
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (scope === "mine") {
      const myProjectIds = (await db.select({ pid: projectMembersTable.projectId }).from(projectMembersTable)
        .innerJoin(projectsTable, eq(projectsTable.id, projectMembersTable.projectId))
        .where(and(eq(projectMembersTable.userId, req.user!.userId), eq(projectMembersTable.role, "project_admin"), ne(projectsTable.status, "archived")))).map(r => r.pid);
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
        db.select({ c: count() }).from(projectsTable).where(and(pFilter, ne(projectsTable.status, "archived"))),
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
      db.select({ c: count() }).from(projectsTable).where(ne(projectsTable.status, "archived")),
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
        .innerJoin(projectsTable, eq(projectsTable.id, projectMembersTable.projectId))
        .where(and(eq(projectMembersTable.userId, req.user!.userId), eq(projectMembersTable.role, "project_admin"), ne(projectsTable.status, "archived")))).map(r => r.pid);
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
        .innerJoin(projectsTable, eq(projectsTable.id, projectMembersTable.projectId))
        .where(and(eq(projectMembersTable.userId, req.user!.userId), eq(projectMembersTable.role, "project_admin"), ne(projectsTable.status, "archived")))).map(r => r.pid);
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
    const { fullName, email, password, companyName, role, projectId } = req.body as { fullName: string; email: string; password: string; companyName: string; role?: string; projectId?: number };
    if (!fullName || !email || !password || !companyName) { res.status(400).json({ error: "fullName, email, password, companyName are required" }); return; }

    if ((req as any).isProjectAdminOnly) {
      const myPids: number[] = (req as any).projectAdminProjectIds || [];
      if (!projectId) { res.status(400).json({ error: "Project selection is required for project-scoped admin" }); return; }
      if (!myPids.includes(projectId)) { res.status(403).json({ error: "You are not admin of the specified project" }); return; }
    }

    let company = (await db.select().from(companiesTable).where(ilike(companiesTable.name, companyName)).limit(1))[0];
    if (!company) {
      [company] = await db.insert(companiesTable).values({ name: companyName }).returning();
    }
    const hash = await bcrypt.hash(password, 10);
    const [user] = await db.insert(usersTable).values({ fullName, email: email.toLowerCase(), passwordHash: hash, companyId: company.id }).returning();

    if (projectId) {
      const existing = await db.select().from(projectMembersTable).where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, user.id))).limit(1);
      if (existing.length === 0) {
        await db.insert(projectMembersTable).values({ projectId, userId: user.id, role: role || "viewer", status: "active" });
      }
    }

    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "create_user", targetType: "user", targetId: String(user.id), details: { email, fullName, companyName, projectId: projectId || null } });
    res.status(201).json({ ...user, createdAt: user.createdAt.toISOString() });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create user" }); }
});

router.patch("/admin/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fullName, email, role, isSuperAdmin, deactivated } = req.body as { fullName?: string; email?: string; role?: string; isSuperAdmin?: boolean; deactivated?: boolean };

    if ((req as any).isProjectAdminOnly) {
      const myPids: number[] = (req as any).projectAdminProjectIds || [];
      if (!(await isUserInProjects(id, myPids))) { res.status(403).json({ error: "User is not in any of your projects" }); return; }
    }

    const updates: Record<string, unknown> = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (email !== undefined) updates.email = email.toLowerCase();
    if (isSuperAdmin !== undefined && req.user?.isSuperAdmin) updates.isSuperAdmin = isSuperAdmin;
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

    if ((req as any).isProjectAdminOnly) {
      const myPids: number[] = (req as any).projectAdminProjectIds || [];
      if (!(await isUserInProjects(id, myPids))) { res.status(403).json({ error: "User is not in any of your projects" }); return; }
    }

    await db.delete(projectMembersTable).where(eq(projectMembersTable.userId, id));
    await db.delete(usersTable).where(eq(usersTable.id, id));
    await logAdminAction({ adminUserId: req.user!.userId, adminEmail: req.user!.email, action: "delete_user", targetType: "user", targetId: String(id), details: { email: user.email, fullName: user.fullName } });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err instanceof Error ? err.message : "Failed to delete user" }); }
});

router.post("/admin/users/:id/reset-password", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if ((req as any).isProjectAdminOnly) {
      const myPids: number[] = (req as any).projectAdminProjectIds || [];
      if (!(await isUserInProjects(id, myPids))) { res.status(403).json({ error: "User is not in any of your projects" }); return; }
    }

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
    let scopedUserIds: number[] | null = null;
    let myProjectIds: number[] | null = null;
    if (scope === "mine") {
      myProjectIds = (await db.select({ pid: projectMembersTable.projectId }).from(projectMembersTable)
        .innerJoin(projectsTable, eq(projectsTable.id, projectMembersTable.projectId))
        .where(and(eq(projectMembersTable.userId, req.user!.userId), eq(projectMembersTable.role, "project_admin"), ne(projectsTable.status, "archived")))).map(r => r.pid);
      if (myProjectIds.length === 0) { res.json([]); return; }
      scopedUserIds = [...new Set((await db.select({ uid: projectMembersTable.userId }).from(projectMembersTable)
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
    const scopedUserIdSet = scopedUserIds ? new Set(scopedUserIds) : null;
    const result = await Promise.all(companies.map(async (c) => {
      let userCount: number;
      let projectCount: number;
      let fileCount: number;
      if (scopedUserIdSet && myProjectIds) {
        const companyUsers = (await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.companyId, c.id))).map(u => u.id);
        const scopedCompanyUsers = companyUsers.filter(uid => scopedUserIdSet.has(uid));
        userCount = scopedCompanyUsers.length;
        const companyProjectIds = scopedCompanyUsers.length > 0
          ? [...new Set((await db.select({ pid: projectMembersTable.projectId }).from(projectMembersTable)
              .where(sql`${projectMembersTable.userId} = ANY(ARRAY[${sql.raw(scopedCompanyUsers.join(","))}]::int[]) AND ${projectMembersTable.projectId} = ANY(ARRAY[${sql.raw(myProjectIds.join(","))}]::int[])`)).map(r => r.pid))]
          : [];
        projectCount = companyProjectIds.length;
        [{ fileCount }] = companyProjectIds.length > 0
          ? await db.select({ fileCount: count() }).from(filesTable).where(sql`${filesTable.projectId} = ANY(ARRAY[${sql.raw(companyProjectIds.join(","))}]::int[])`)
          : [{ fileCount: 0 }];
      } else {
        [{ userCount }] = await db.select({ userCount: count() }).from(usersTable).where(eq(usersTable.companyId, c.id));
        [{ projectCount }] = await db.select({ projectCount: count() }).from(projectsTable).where(
          and(
            ne(projectsTable.status, "archived"),
            sql`${projectsTable.id} IN (SELECT DISTINCT project_id FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE u.company_id = ${c.id})`
          )
        );
        [{ fileCount }] = await db.select({ fileCount: count() }).from(filesTable).where(
          sql`${filesTable.projectId} IN (SELECT DISTINCT project_id FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE u.company_id = ${c.id})`
        );
      }
      return { ...c, createdAt: c.createdAt.toISOString(), userCount: Number(userCount), projectCount: Number(projectCount), fileCount: Number(fileCount) };
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
});

router.patch("/admin/companies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if ((req as any).isProjectAdminOnly) {
      const myPids: number[] = (req as any).projectAdminProjectIds || [];
      const companyInScope = myPids.length > 0
        ? (await db.select({ uid: usersTable.id }).from(usersTable)
            .innerJoin(projectMembersTable, eq(projectMembersTable.userId, usersTable.id))
            .where(and(eq(usersTable.companyId, id), sql`${projectMembersTable.projectId} = ANY(ARRAY[${sql.raw(myPids.join(","))}]::int[])`))).length > 0
        : false;
      if (!companyInScope) { res.status(403).json({ error: "Company is not part of any of your projects" }); return; }
    }

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

    if ((req as any).isProjectAdminOnly) {
      const myPids = await getProjectAdminProjectIds(req.user!.userId);
      const companyInScope = myPids.length > 0
        ? (await db.select({ uid: usersTable.id }).from(usersTable)
            .innerJoin(projectMembersTable, eq(projectMembersTable.userId, usersTable.id))
            .where(and(eq(usersTable.companyId, id), sql`${projectMembersTable.projectId} = ANY(ARRAY[${sql.raw(myPids.join(","))}]::int[])`))).length > 0
        : false;
      if (!companyInScope) { res.status(403).json({ error: "Company is not part of any of your projects" }); return; }
    }

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
        .innerJoin(projectsTable, eq(projectsTable.id, projectMembersTable.projectId))
        .where(and(eq(projectMembersTable.userId, req.user!.userId), eq(projectMembersTable.role, "project_admin"), ne(projectsTable.status, "archived")))).map(r => r.pid);
      if (myIds.length === 0) { res.json([]); return; }
      projects = await db.select().from(projectsTable)
        .where(sql`${projectsTable.id} = ANY(ARRAY[${sql.raw(myIds.join(","))}]::int[])`)
        .orderBy(desc(projectsTable.createdAt));
    } else {
      projects = await db.select().from(projectsTable)
        .where(ne(projectsTable.status, "archived"))
        .orderBy(desc(projectsTable.createdAt));
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
      const convention = (await db.select({ companyCode: namingConventionsTable.companyCode }).from(namingConventionsTable).where(eq(namingConventionsTable.projectId, p.id)).limit(1))[0];
      const conventionCompanyCodes = convention?.companyCode ? convention.companyCode.split(",").map(c => c.trim()).filter(Boolean) : [];

      const memberCompanyIds = [...new Set((await db.select({ cid: usersTable.companyId }).from(usersTable)
        .innerJoin(projectMembersTable, eq(projectMembersTable.userId, usersTable.id))
        .where(eq(projectMembersTable.projectId, p.id))).map(r => r.cid))];
      const participatingCompanies = memberCompanyIds.length > 0
        ? (await db.select({ name: companiesTable.name }).from(companiesTable)
            .where(sql`${companiesTable.id} = ANY(ARRAY[${sql.raw(memberCompanyIds.join(","))}]::int[])`)).map(r => r.name)
        : [];

      return {
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        memberCount: Number(memberCount),
        fileCount: Number(fileCount),
        rfiCount: Number(rfiCount),
        submittalCount: Number(submittalCount),
        companyName,
        conventionCompanyCodes,
        participatingCompanies,
        unassignedConventionCompanies: conventionCompanyCodes.filter(
          code => !participatingCompanies.some(name => name.toUpperCase().includes(code.toUpperCase()) || code.toUpperCase().includes(name.toUpperCase()))
        ),
      };
    }));
    res.json(result);
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
});

router.patch("/admin/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if ((req as any).isProjectAdminOnly) {
      const myPids: number[] = (req as any).projectAdminProjectIds || [];
      if (!myPids.includes(id)) { res.status(403).json({ error: "You are not admin of this project" }); return; }
    }

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

    if ((req as any).isProjectAdminOnly) {
      const myPids: number[] = (req as any).projectAdminProjectIds || [];
      if (!myPids.includes(id)) { res.status(403).json({ error: "You are not admin of this project" }); return; }
    }

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

    if ((req as any).isProjectAdminOnly) {
      const myPids: number[] = (req as any).projectAdminProjectIds || [];
      if (!myPids.includes(id)) { res.status(403).json({ error: "You are not admin of this project" }); return; }
    }

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
    return res.json(existing.map(f => ({ ...f, updatedAt: f.updatedAt.toISOString() })));
  } catch (err) { return res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
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

router.post("/admin/fix-specific-link", async (req, res) => {
  try {
    if (!req.user?.isSuperAdmin) { res.status(403).json({ error: "Super admin only" }); return; }
    const { userId, projectId } = req.body as { userId: number; projectId: number };
    if (!userId || !projectId) { res.status(400).json({ error: "userId and projectId are required" }); return; }
    const user = (await db.select({ id: usersTable.id, fullName: usersTable.fullName, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0];
    if (!user) { res.status(404).json({ error: `User ${userId} not found` }); return; }
    const project = (await db.select({ id: projectsTable.id, code: projectsTable.code }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1))[0];
    if (!project) { res.status(404).json({ error: `Project ${projectId} not found` }); return; }
    const existing = (await db.select().from(projectMembersTable).where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, userId))).limit(1))[0];
    if (existing) { res.json({ ok: true, message: "Link already exists", memberId: existing.id }); return; }
    const [member] = await db.insert(projectMembersTable).values({ projectId, userId, role: "viewer", status: "active" }).returning();
    await logAdminAction({ adminUserId: req.user.userId, adminEmail: req.user.email, action: "fix_specific_link", details: { userId, projectId, memberId: member.id, userName: user.fullName, projectCode: project.code } });
    res.json({ ok: true, memberId: member.id, userId, projectId, userName: user.fullName, projectCode: project.code });
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Failed" }); }
});

router.get("/admin/projects-list", async (req, res) => {
  try {
    const scope = String(req.query.scope || "");
    let projects;
    if (scope === "mine") {
      const myIds = (await db.select({ pid: projectMembersTable.projectId }).from(projectMembersTable)
        .innerJoin(projectsTable, eq(projectsTable.id, projectMembersTable.projectId))
        .where(and(eq(projectMembersTable.userId, req.user!.userId), eq(projectMembersTable.role, "project_admin"), ne(projectsTable.status, "archived")))).map(r => r.pid);
      if (myIds.length === 0) { res.json([]); return; }
      projects = await db.select({ id: projectsTable.id, code: projectsTable.code, name: projectsTable.name }).from(projectsTable)
        .where(sql`${projectsTable.id} = ANY(ARRAY[${sql.raw(myIds.join(","))}]::int[])`)
        .orderBy(projectsTable.name);
    } else {
      projects = await db.select({ id: projectsTable.id, code: projectsTable.code, name: projectsTable.name }).from(projectsTable)
        .where(ne(projectsTable.status, "archived"))
        .orderBy(projectsTable.name);
    }
    res.json(projects);
  } catch (err) { res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" }); }
});

export default router;
