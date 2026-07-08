import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { companyProfilesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";
import multer from "multer";

const router: IRouter = Router();

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/svg+xml"]);

router.get("/users/me/company-profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await db.select().from(companyProfilesTable).where(eq(companyProfilesTable.userId, userId)).limit(1);
    if (rows.length === 0) {
      res.json({
        userId,
        companyName: null,
        companyRole: null,
        logoUrl: null,
        website: null,
        phone: null,
        city: null,
        country: null,
      });
      return;
    }
    const r = rows[0];
    res.json({ ...r, updatedAt: r.updatedAt.toISOString() });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Internal error" });
  }
});

router.post("/users/me/company-profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const body = req.body as Partial<{
      companyName: string | null;
      companyRole: string | null;
      website: string | null;
      phone: string | null;
      city: string | null;
      country: string | null;
    }>;

    const existing = await db.select().from(companyProfilesTable).where(eq(companyProfilesTable.userId, userId)).limit(1);
    const values = {
      companyName: body.companyName ?? null,
      companyRole: body.companyRole ?? null,
      website: body.website ?? null,
      phone: body.phone ?? null,
      city: body.city ?? null,
      country: body.country ?? null,
      updatedAt: new Date(),
    };
    if (existing.length === 0) {
      const [row] = await db.insert(companyProfilesTable).values({ userId, ...values }).returning();
      res.json({ ...row, updatedAt: row.updatedAt.toISOString() });
    } else {
      const [row] = await db.update(companyProfilesTable).set(values).where(eq(companyProfilesTable.userId, userId)).returning();
      res.json({ ...row, updatedAt: row.updatedAt.toISOString() });
    }
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Internal error" });
  }
});

router.post("/users/me/company-logo", authMiddleware, (req, res) => {
  uploadMiddleware.single("logo")(req, res, async (err: unknown) => {
    if (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Upload error" });
      return;
    }
    try {
      const userId = req.user!.userId;
      const file = (req as unknown as { file?: Express.Multer.File }).file;
      if (!file) { res.status(400).json({ error: "No file uploaded (field name: logo)" }); return; }
      if (!ALLOWED_MIME.has(file.mimetype)) {
        res.status(400).json({ error: `Unsupported type ${file.mimetype}. Allowed: jpg, png, svg.` });
        return;
      }
      const dataUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;

      const existing = await db.select().from(companyProfilesTable).where(eq(companyProfilesTable.userId, userId)).limit(1);
      if (existing.length === 0) {
        await db.insert(companyProfilesTable).values({ userId, logoUrl: dataUrl, updatedAt: new Date() });
      } else {
        await db.update(companyProfilesTable).set({ logoUrl: dataUrl, updatedAt: new Date() }).where(eq(companyProfilesTable.userId, userId));
      }
      res.json({ logoUrl: dataUrl });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Internal error" });
    }
  });
});

// ── GET another user's company profile (for project dashboard) ───────────────
router.get("/users/:userId/company-profile", authMiddleware, async (req, res) => {
  try {
    const userId = parseInt(String(req.params.userId), 10);
    if (!Number.isFinite(userId)) { res.status(400).json({ error: "Invalid user id" }); return; }
    const rows = await db.select().from(companyProfilesTable).where(eq(companyProfilesTable.userId, userId)).limit(1);
    if (rows.length === 0) {
      res.json({ userId, companyName: null, companyRole: null, logoUrl: null, website: null, phone: null, city: null, country: null });
      return;
    }
    const r = rows[0];
    res.json({ ...r, updatedAt: r.updatedAt.toISOString() });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Internal error" });
  }
});

export default router;
