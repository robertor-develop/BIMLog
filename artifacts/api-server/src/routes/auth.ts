import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, companiesTable, projectInvitations, projectMembersTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
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

  res.json({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    companyName: companies[0]?.name || "",
    companyId: u.companyId,
    createdAt: u.createdAt.toISOString(),
  });
});

export default router;
