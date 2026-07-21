import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  authMiddleware,
  isSuperAdminMiddleware,
  signBriefAccessToken,
  verifyBriefAccessToken,
} from "../middlewares/auth";
import {
  getLivingBriefGateCredential,
  LivingBriefGateError,
  resetLivingBriefGateCredential,
  verifyLivingBriefGatePassword,
} from "../lib/living-brief-gate";
import { loadLivingBriefSource, resolveDeployedSourceCommit, sha256 } from "../lib/living-brief-source";
import {
  mirrorStatus,
  readLivingBriefMirrorRows,
  reconcileLivingBriefMirror,
  synchronizeLivingBriefMirror,
} from "../lib/living-brief-mirror";

const router = Router();

const resetAttempts = new Map<number, number[]>();

function tooManyResetAttempts(userId: number): boolean {
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000;
  const attempts = (resetAttempts.get(userId) ?? []).filter((value) => value > windowStart);
  attempts.push(now);
  resetAttempts.set(userId, attempts);
  return attempts.length > 20;
}

function resetError(res: Response, error: unknown): void {
  if (error instanceof LivingBriefGateError) {
    res.status(error.status).json({ error: error.code });
    return;
  }
  res.status(500).json({ error: "Living Brief gate update failed" });
}

async function observedCredentialVersion(req: Request): Promise<number | null> {
  const existingCredential = await getLivingBriefGateCredential();
  if (!existingCredential) return null;
  const header = req.headers["x-brief-token"];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token) throw new LivingBriefGateError(401, "BRIEF_TOKEN_REQUIRED");
  try {
    const payload = verifyBriefAccessToken(token);
    if (payload.scope !== "living_brief" || payload.userId !== req.user!.userId) throw new Error("invalid");
    return payload.credentialVersion ?? null;
  } catch {
    throw new LivingBriefGateError(401, "BRIEF_TOKEN_REQUIRED");
  }
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
    const credential = await getLivingBriefGateCredential();
    if (!credential) {
      res.status(503).json({ error: "Living Brief gate is not configured" });
      return;
    }
    if (payload.credentialVersion !== credential.version) {
      res.status(401).json({ error: "Invalid or expired brief access token" });
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
  res.json({ eligible, isSuperAdmin: !!u?.isSuperAdmin, credentialConfigured: !!(await getLivingBriefGateCredential()) });
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
  const credential = await verifyLivingBriefGatePassword(password);
  if (!credential) {
    if (!(await getLivingBriefGateCredential())) {
      res.status(503).json({ error: "Living Brief gate is not configured" });
      return;
    }
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  res.json({ briefToken: signBriefAccessToken(req.user!.userId, credential.version) });
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
      semanticReviewedThroughCommit: document.semanticReviewedThroughCommit,
      semanticReviewTask: document.semanticReviewTask,
      semanticReviewResult: document.semanticReviewResult,
      semanticReviewedAt: document.semanticReviewedAt,
      deployedSourceCommit,
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

// Change the gate password (super admin only). This is the only reset path; it requires
// account revalidation, explicit confirmation, a reason, rate limiting, and a durable audit row.
router.post("/living-brief/password", authMiddleware, isSuperAdminMiddleware, async (req: Request, res: Response) => {
  if (tooManyResetAttempts(req.user!.userId)) {
    res.status(429).json({ error: "Too many reset attempts" });
    return;
  }
  try {
    const result = await resetLivingBriefGateCredential({
      actorUserId: req.user!.userId,
      actorEmail: req.user!.email,
      currentAccountPassword: typeof req.body?.currentAccountPassword === "string" ? req.body.currentAccountPassword : "",
      newPassword: typeof req.body?.newPassword === "string" ? req.body.newPassword : "",
      reason: typeof req.body?.reason === "string" ? req.body.reason : "",
      confirmation: typeof req.body?.confirmation === "string" ? req.body.confirmation : "",
      expectedCredentialVersion: await observedCredentialVersion(req),
    });
    res.json({ ok: true });
  } catch (error) {
    resetError(res, error);
  }
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
