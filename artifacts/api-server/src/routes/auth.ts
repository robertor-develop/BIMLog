import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable, companiesTable, projectInvitations, projectMembersTable, filesTable, rfisTable, submittalsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { signToken, authMiddleware, type AuthPayload } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res) => {
  try {
    const body = RegisterBody.parse(req.body);

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, body.email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Email already exists" });
      return;
    }

    let company = await db.select().from(companiesTable).where(eq(companiesTable.name, body.companyName)).limit(1);
    let companyId: number;
    if (company.length > 0) {
      companyId = company[0].id;
    } else {
      const [newCompany] = await db.insert(companiesTable).values({ name: body.companyName }).returning();
      companyId = newCompany.id;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const [user] = await db.insert(usersTable).values({
      email: body.email,
      passwordHash,
      fullName: body.fullName,
      companyId,
    }).returning();

    // Auto-accept any pending invitations for this email
    try {
      const pending = await db.select().from(projectInvitations)
        .where(and(eq(projectInvitations.email, body.email), eq(projectInvitations.status, "pending")));
      for (const inv of pending) {
        const alreadyMember = await db.select().from(projectMembersTable)
          .where(and(eq(projectMembersTable.projectId, inv.projectId), eq(projectMembersTable.userId, user.id))).limit(1);
        if (alreadyMember.length === 0) {
          await db.insert(projectMembersTable).values({ projectId: inv.projectId, userId: user.id, role: inv.role });
        }
        await db.update(projectInvitations).set({ status: "accepted", acceptedAt: new Date() }).where(eq(projectInvitations.id, inv.id));
      }
    } catch (_) {}

    const companyName = company.length > 0 ? company[0].name : body.companyName;
    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      companyId: user.companyId,
      fullName: user.fullName,
      companyName,
    };

    const token = signToken(payload);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        companyName,
        companyId: user.companyId,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed";
    res.status(400).json({ error: message });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const body = LoginBody.parse(req.body);

    const users = await db.select().from(usersTable).where(eq(usersTable.email, body.email)).limit(1);
    if (users.length === 0) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const user = users[0];
    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, user.companyId)).limit(1);
    const companyName = companies[0]?.name || "";

    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      companyId: user.companyId,
      fullName: user.fullName,
      companyName,
    };

    const token = signToken(payload);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        companyName,
        companyId: user.companyId,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    res.status(400).json({ error: message });
  }
});

router.get("/auth/me", authMiddleware, async (req, res) => {
  const user = req.user!;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, user.userId)).limit(1);
  if (users.length === 0) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const u = users[0];
  const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, u.companyId)).limit(1);
  const c = companies[0];

  res.json({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    companyName: c?.name || "",
    companyId: u.companyId,
    createdAt: u.createdAt.toISOString(),
    jobTitle: u.jobTitle || null,
    phone: u.phone || null,
    avatarUrl: u.avatarUrl || null,
    signatureUrl: u.signatureUrl || null,
    apiToken: u.apiToken || null,
    notificationPreferences: u.notificationPreferences || null,
    company: c ? {
      id: c.id,
      name: c.name,
      website: c.website || null,
      address: c.address || null,
      phone: c.phone || null,
      companyLogoUrl: c.companyLogoUrl || null,
    } : null,
  });
});

router.patch("/users/me", authMiddleware, async (req, res) => {
  try {
    const { fullName, jobTitle, phone, avatarUrl, signatureUrl, notificationPreferences } = req.body;
    const userId = req.user!.userId;

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (jobTitle !== undefined) updates.jobTitle = jobTitle;
    if (phone !== undefined) updates.phone = phone;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (signatureUrl !== undefined) updates.signatureUrl = signatureUrl;
    if (notificationPreferences !== undefined) updates.notificationPreferences = notificationPreferences;

    await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));

    const updated = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const u = updated[0];
    const companies = await db.select().from(companiesTable).where(eq(companiesTable.id, u.companyId)).limit(1);
    const c = companies[0];

    res.json({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      companyName: c?.name || "",
      companyId: u.companyId,
      createdAt: u.createdAt.toISOString(),
      jobTitle: u.jobTitle || null,
      phone: u.phone || null,
      avatarUrl: u.avatarUrl || null,
      signatureUrl: u.signatureUrl || null,
      apiToken: u.apiToken || null,
      notificationPreferences: u.notificationPreferences || null,
      company: c ? {
        id: c.id,
        name: c.name,
        website: c.website || null,
        address: c.address || null,
        phone: c.phone || null,
        companyLogoUrl: c.companyLogoUrl || null,
      } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    res.status(400).json({ error: message });
  }
});

router.patch("/users/me/company", authMiddleware, async (req, res) => {
  try {
    const { name, website, address, phone, companyLogoUrl } = req.body;
    const userId = req.user!.userId;

    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }

    const companyId = users[0].companyId;
    const updates: Partial<typeof companiesTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name;
    if (website !== undefined) updates.website = website;
    if (address !== undefined) updates.address = address;
    if (phone !== undefined) updates.phone = phone;
    if (companyLogoUrl !== undefined) updates.companyLogoUrl = companyLogoUrl;

    await db.update(companiesTable).set(updates).where(eq(companiesTable.id, companyId));

    const updated = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    res.json(updated[0]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    res.status(400).json({ error: message });
  }
});

router.patch("/users/me/password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "currentPassword and newPassword are required" });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: "New password must be at least 8 characters" });
      return;
    }

    const userId = req.user!.userId;
    const users = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!users.length) { res.status(404).json({ error: "User not found" }); return; }

    const ok = await bcrypt.compare(currentPassword, users[0].passwordHash);
    if (!ok) { res.status(400).json({ error: "Current password is incorrect" }); return; }

    const newHash = await bcrypt.hash(newPassword, 10);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, userId));

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Password update failed";
    res.status(400).json({ error: message });
  }
});

router.post("/users/me/api-token", authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const token = randomBytes(32).toString("hex");
    await db.update(usersTable).set({ apiToken: token }).where(eq(usersTable.id, userId));
    res.json({ apiToken: token });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate token" });
  }
});

router.get("/users/me/performance-score", authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const namingComplianceResult = await db
      .select({
        total: sql<number>`count(*)`,
        passed: sql<number>`sum(case when "content_verification_result" = 'pass' then 1 else 0 end)`,
      })
      .from(filesTable)
      .where(eq(filesTable.uploadedById, userId));

    const totalFiles = Number(namingComplianceResult[0]?.total ?? 0);
    const passedFiles = Number(namingComplianceResult[0]?.passed ?? 0);
    const namingCompliance = totalFiles > 0 ? Math.round((passedFiles / totalFiles) * 100) : null;

    const rfiResult = await db
      .select({
        total: sql<number>`count(*)`,
        closed: sql<number>`sum(case when status = 'closed' then 1 else 0 end)`,
      })
      .from(rfisTable)
      .where(eq(rfisTable.assignedToId, userId));

    const totalRfis = Number(rfiResult[0]?.total ?? 0);
    const closedRfis = Number(rfiResult[0]?.closed ?? 0);
    const rfiCloseRate = totalRfis > 0 ? Math.round((closedRfis / totalRfis) * 100) : null;

    const submittalsResult = await db
      .select({
        total: sql<number>`count(*)`,
        approved: sql<number>`sum(case when status = 'approved' then 1 else 0 end)`,
      })
      .from(submittalsTable)
      .where(eq(submittalsTable.submittedById, userId));

    const totalSubmittals = Number(submittalsResult[0]?.total ?? 0);
    const approvedSubmittals = Number(submittalsResult[0]?.approved ?? 0);
    const submittalsApprovalRate = totalSubmittals > 0 ? Math.round((approvedSubmittals / totalSubmittals) * 100) : null;

    const scores = [namingCompliance, rfiCloseRate, submittalsApprovalRate].filter(s => s !== null) as number[];
    const overallScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    res.json({
      overallScore,
      namingCompliance: { rate: namingCompliance, passed: passedFiles, total: totalFiles },
      rfiCloseRate: { rate: rfiCloseRate, closed: closedRfis, total: totalRfis },
      submittalsApprovalRate: { rate: submittalsApprovalRate, approved: approvedSubmittals, total: totalSubmittals },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to compute performance score" });
  }
});

export default router;
