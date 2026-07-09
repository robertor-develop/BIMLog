import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { usersTable, platformSettingsTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  authMiddleware,
  isSuperAdminMiddleware,
  signBriefAccessToken,
  verifyBriefAccessToken,
} from "../middlewares/auth";

const router = Router();

const PASSWORD_KEY = "living_brief_password_hash";
// Editable docs (CLAUDE.md, VISION.md, PLUGIN.md, QUALITY.md, OPEN_LOOP.md) are stored in platform_settings
// under this key prefix so edits survive every deploy; the on-disk git file is only
// the initial seed/fallback used until the first save.
const DOC_KEY_PREFIX = "living_brief_doc:";
const EDITABLE_DOCS = new Set(["CLAUDE.md", "VISION.md", "PLUGIN.md", "QUALITY.md", "OPEN_LOOP.md"]);

const DOCS = [
  { name: "CLAUDE.md", file: "CLAUDE.md" },
  { name: "PLATFORM.md", file: "PLATFORM.md" },
  { name: "STATUS.md", file: "STATUS.md" },
  { name: "VISION.md", file: "VISION.md" },
  { name: "PLUGIN.md", file: "PLUGIN.md" },
  { name: "QUALITY.md", file: "QUALITY.md" },
  { name: "OPEN_LOOP.md", file: "OPEN_LOOP.md" },
  { name: "AUDIT.md", file: "AUDIT.md" },
];

// Resolve this module's directory in a way that works in BOTH module formats:
//  - tsx/ESM dev runtime: __dirname is undefined, import.meta.url is defined.
//  - esbuild CJS prod bundle: __dirname is defined, import.meta.url is undefined
//    (esbuild leaves it undefined, so fileURLToPath(import.meta.url) would throw).
// `typeof` guards are safe in both formats (no ReferenceError), and each branch is
// wrapped so a missing/empty value never reaches fileURLToPath.
function resolveModuleDir(): string | null {
  try {
    // @ts-ignore __dirname only exists in the CJS output
    if (typeof __dirname !== "undefined") return __dirname as string;
  } catch { /* not running as CJS */ }
  try {
    const url = import.meta?.url;
    if (url) return path.dirname(fileURLToPath(url));
  } catch { /* not running as ESM */ }
  return null;
}

// Resolve the repo-root living-brief folder by walking up from both the current
// working directory and this module's directory until a "living-brief" folder is
// found. Works in dev (tsx, cwd = package dir) and in the bundled prod build.
function findLivingBriefDir(): string {
  const moduleDir = resolveModuleDir();
  const starts: string[] = moduleDir ? [process.cwd(), moduleDir] : [process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 8; i++) {
      const candidate = path.join(dir, "living-brief");
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error("living-brief directory not found on disk");
}

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

// Return the documents (requires unlock). Editable docs (CLAUDE.md, VISION.md,
// PLUGIN.md, QUALITY.md, OPEN_LOOP.md) are served from platform_settings when
// a saved version exists, otherwise from the on-disk seed file. PLATFORM.md,
// STATUS.md and AUDIT.md always read disk.
router.get("/living-brief/docs", authMiddleware, briefAccessMiddleware, async (_req: Request, res: Response) => {
  const dir = findLivingBriefDir();
  const overrides = await db
    .select({ key: platformSettingsTable.key, value: platformSettingsTable.value, updatedAt: platformSettingsTable.updatedAt })
    .from(platformSettingsTable)
    .where(inArray(platformSettingsTable.key, [...EDITABLE_DOCS].map((n) => DOC_KEY_PREFIX + n)));
  const overrideMap = new Map(overrides.map((o) => [o.key, o]));
  const docs = DOCS.map(({ name, file }) => {
    const ov = EDITABLE_DOCS.has(name) ? overrideMap.get(DOC_KEY_PREFIX + name) : undefined;
    if (ov) return { name, content: ov.value, updatedAt: ov.updatedAt.toISOString() };
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    return { name, content: fs.readFileSync(full, "utf-8"), updatedAt: stat.mtime.toISOString() };
  });
  res.json({ docs });
});

// Save an editable document to the platform_settings DB (super admin only).
// CLAUDE.md, VISION.md, PLUGIN.md, QUALITY.md, and OPEN_LOOP.md are editable.
// PLATFORM.md auto-regenerates from the build; STATUS.md and AUDIT.md are maintained in the repo.
// Writing to the DB (not disk) makes edits permanent across every future deploy on every instance.
router.post("/living-brief/docs/:name", authMiddleware, isSuperAdminMiddleware, async (req: Request, res: Response) => {
  const name = String(req.params.name);
  if (!EDITABLE_DOCS.has(name)) {
    res.status(400).json({ error: "This document is not editable" });
    return;
  }
  const content = typeof req.body?.content === "string" ? req.body.content : null;
  if (content === null || content.trim().length === 0) {
    res.status(400).json({ error: "Content required" });
    return;
  }
  const now = new Date();
  await db
    .insert(platformSettingsTable)
    .values({ key: DOC_KEY_PREFIX + name, value: content })
    .onConflictDoUpdate({ target: platformSettingsTable.key, set: { value: content, updatedAt: now } });
  res.json({ ok: true, updatedAt: now.toISOString() });
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
