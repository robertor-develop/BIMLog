import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, platformSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  authMiddleware,
  isSuperAdminMiddleware,
  signBriefAccessToken,
  verifyBriefAccessToken,
} from "../middlewares/auth";
import { loadLivingBriefSource, resolveDeployedSourceCommit, sha256 } from "../lib/living-brief-source";
import {
  mirrorStatus,
  readLivingBriefMirrorRows,
  reconcileLivingBriefMirror,
  synchronizeLivingBriefMirror,
} from "../lib/living-brief-mirror";

const router = Router();

const PASSWORD_KEY = "living_brief_password_hash";

async function getPasswordHash(): Promise<string | null> {
  const [row] = await db
    .select({ value: platformSettingsTable.value })
    .from(platformSettingsTable)
    .where(eq(platformSettingsTable.key, PASSWORD_KEY))
    .limit(1);
  return row?.value ?? null;
}

async function isEligible(userId: number): Promise<boolean> {
  const [u] = await db
    .select({ isSuperAdmin: usersTable.isSuperAdmin, canAccess: usersTable.canAccessLivingBrief })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return !!(u?.isSuperAdmin || u?.canAccess);
}

// Require a valid, in-scope brief-access token (issued by /unlock) AND eligibility.
async function briefAccessMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers["x-brief-token"];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token) {
    res.status(401).json({ error: "Brief access token required" });
    return;
  }
  try {
    const payload = verifyBriefAccessToken(token);
    if (payload.scope !== "living_brief" || payload.userId !== req.user!.userId) {
      res.status(401).json({ error: "Invalid brief access token" });
      return;
    }
  } catch {
    res.status(401).json({ error: "Invalid or expired brief access token" });
    return;
  }
  if (!(await isEligible(req.user!.userId))) {
    res.status(403).json({ error: "Living Brief access not granted" });
    return;
  }
  next();
}

// Eligibility check for the F5 intercept and page bootstrap.
router.get("/living-brief/eligibility", authMiddleware, async (req: Request, res: Response) => {
  const eligible = await isEligible(req.user!.userId);
  const [u] = await db
    .select({ isSuperAdmin: usersTable.isSuperAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);
  res.json({ eligible, isSuperAdmin: !!u?.isSuperAdmin });
});

// Verify the gate password and issue a short-lived brief-access token.
router.post("/living-brief/unlock", authMiddleware, async (req: Request, res: Response) => {
  if (!(await isEligible(req.user!.userId))) {
    res.status(403).json({ error: "Living Brief access not granted" });
    return;
  }
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password) {
    res.status(400).json({ error: "Password required" });
    return;
  }
  const hash = await getPasswordHash();
  if (!hash) {
    res.status(500).json({ error: "Living Brief password is not configured" });
    return;
  }
  const ok = await bcrypt.compare(password, hash);
  if (!ok) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  res.json({ briefToken: signBriefAccessToken(req.user!.userId) });
});

// Return the verified deployed source bundle. Database rows are status-bearing mirrors only;
// they never override Git-controlled doctrine.
router.get("/living-brief/docs", authMiddleware, briefAccessMiddleware, async (_req: Request, res: Response) => {
  await synchronizeLivingBriefMirror();
  const source = loadLivingBriefSource();
  const deployedSourceCommit = resolveDeployedSourceCommit(source.manifest);
  const mirrorRows = await readLivingBriefMirrorRows();
  const docs = source.documents.map((document) => {
    const mirror = mirrorRows.get(document.key);
    return {
      key: document.key,
      name: document.file,
      label: document.label,
      scope: document.scope,
      content: document.content,
      sourceCommit: deployedSourceCommit,
      contentSha256: document.sha256,
      reconciledThroughCommit: document.reconciledThroughCommit,
      sourceChangedAt: document.sourceChangedAt,
      mirrorSyncedAt: mirror?.mirror_synced_at?.toISOString() ?? null,
      mirrorContentSha256: mirror ? sha256(mirror.content) : null,
      status: mirrorStatus(mirror, {
        sha256: document.sha256,
        reconciledThroughCommit: document.reconciledThroughCommit,
        deployedSourceCommit,
      }),
    };
  });
  res.json({ catalog: source.catalog, manifest: source.manifest, docs });
});

// Controlled admin reconciliation copies only the exact deployed source bundle. It requires the
// caller's observed mirror hashes so a concurrent or unexpected mirror change aborts atomically.
router.post("/living-brief/reconcile", authMiddleware, isSuperAdminMiddleware, async (req: Request, res: Response) => {
  const expected = req.body?.expectedMirrorHashes;
  if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
    res.status(400).json({ error: "Expected mirror hashes are required" });
    return;
  }
  await reconcileLivingBriefMirror(expected as Record<string, string>);
  res.json({ ok: true });
});

// Change the gate password (super admin only).
router.post("/living-brief/password", authMiddleware, isSuperAdminMiddleware, async (req: Request, res: Response) => {
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (newPassword.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  await db
    .insert(platformSettingsTable)
    .values({ key: PASSWORD_KEY, value: hash })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: hash, updatedAt: new Date() } });
  res.json({ ok: true });
});

// List users and their Living Brief access (super admin only).
router.get("/living-brief/access", authMiddleware, isSuperAdminMiddleware, async (_req: Request, res: Response) => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      isSuperAdmin: usersTable.isSuperAdmin,
      canAccessLivingBrief: usersTable.canAccessLivingBrief,
    })
    .from(usersTable)
    .orderBy(usersTable.email);
  res.json({ users });
});

// Grant or revoke a user's Living Brief access (super admin only).
router.post("/living-brief/access", authMiddleware, isSuperAdminMiddleware, async (req: Request, res: Response) => {
  const userId = Number(req.body?.userId);
  const grant = req.body?.grant === true;
  if (!Number.isInteger(userId)) {
    res.status(400).json({ error: "Valid userId required" });
    return;
  }
  await db.update(usersTable).set({ canAccessLivingBrief: grant }).where(eq(usersTable.id, userId));
  res.json({ ok: true });
});

export default router;
