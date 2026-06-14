import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import router from "./routes";
import { startOverdueNotifier } from "./lib/overdue-notifier";
import { pool } from "@workspace/db";

const ENV_MODE = process.env.REPLIT_DEPLOYMENT === "1" ? "PRODUCTION" : "DEVELOPMENT";
const DB_HOST = process.env.PGHOST || "unknown";
const DB_NAME = process.env.PGDATABASE || "unknown";

console.log("========================================");
console.log(`[ENV] MODE: ${ENV_MODE}`);
console.log(`[ENV] DB_HOST: ${DB_HOST}`);
console.log(`[ENV] DB_NAME: ${DB_NAME}`);
console.log(`[ENV] NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
console.log("========================================");

const app: Express = express();

app.disable("etag");
app.set("trust proxy", 1);
app.use(cors());
const captureRawBody = (req: Request, _res: Response, buf: Buffer) => {
  if (buf && buf.length) (req as unknown as { rawBody?: Buffer }).rawBody = buf;
};

const jsonTypeMatcher = (req: Request): boolean => {
  const ct = (req.headers["content-type"] || "").toLowerCase();
  if (!ct) return false;
  if (ct.includes("multipart/form-data")) return false;
  if (ct.includes("application/x-www-form-urlencoded")) return false;
  return ct.includes("json") || ct.includes("text/plain");
};

// The Navisworks plugin posts to plugin-sync with occasionally malformed JSON
// (trailing/double commas from its serializer). express.json would throw a 400
// before the route runs, so for this path we buffer the raw bytes ourselves and
// mark _body=true so express.json/urlencoded skip it. The route then parses the
// raw bytes with a string-aware repair.
const PLUGIN_SYNC_RE = /\/clash-reports\/plugin-sync$/;
const PLUGIN_SYNC_MAX_BYTES = 500 * 1024 * 1024; // mirror express.json's 500mb cap
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "POST" || !PLUGIN_SYNC_RE.test(req.path)) return next();
  const chunks: Buffer[] = [];
  let total = 0;
  let done = false;
  const finish = (fn: () => void) => { if (done) return; done = true; fn(); };
  req.on("data", (c: Buffer) => {
    if (done) return;
    total += c.length;
    if (total > PLUGIN_SYNC_MAX_BYTES) {
      finish(() => {
        chunks.length = 0; // free what we buffered; further chunks are ignored via the done guard
        res.status(413).json({ error: "payload_too_large", message: "Request body exceeds 500mb limit" });
      });
      return;
    }
    chunks.push(Buffer.from(c));
  });
  req.on("end", () => finish(() => {
    const buf = Buffer.concat(chunks);
    if (buf.length) (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    (req as unknown as { _body?: boolean })._body = true;
    next();
  }));
  req.on("aborted", () => finish(() => next()));
  req.on("error", () => finish(() => next()));
});

app.use(express.json({ limit: "500mb", type: jsonTypeMatcher, verify: captureRawBody }));
app.use(express.urlencoded({ extended: true, limit: "500mb", verify: captureRawBody }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "bimlog-aps-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: ENV_MODE === "PRODUCTION",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use("/api/v1", (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.get("/api/v1/env-check", (_req: Request, res: Response) => {
  res.json({
    mode: ENV_MODE,
    dbHost: DB_HOST,
    dbName: DB_NAME,
    nodeEnv: process.env.NODE_ENV || "not set",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/v1", router);

startOverdueNotifier();

(async () => {
  try {
    await pool.query(`ALTER TABLE naming_conventions ADD COLUMN IF NOT EXISTS setup_status text NOT NULL DEFAULT 'not_started'`);
    await pool.query(`UPDATE naming_conventions SET setup_status = 'completed' WHERE setup_status = 'not_started' AND id IN (SELECT DISTINCT convention_id FROM naming_fields)`);
    console.log("[migration] setup_status column ensured");
  } catch (e) {
    console.error("[migration] setup_status migration failed:", e);
  }
})();

(async () => {
  try {
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS name text`);
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS test_name text`);
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS fingerprint text`);
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS element_1_layer text`);
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS element_2_layer text`);
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS element_1_id text`);
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS element_2_id text`);
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS distance double precision`);
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS position_x double precision`);
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS position_y double precision`);
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS position_z double precision`);
    await pool.query(`ALTER TABLE clashes ADD COLUMN IF NOT EXISTS last_plugin_sync_at timestamp`);
    await pool.query(`CREATE INDEX IF NOT EXISTS clashes_project_fingerprint_idx ON clashes (project_id, fingerprint)`);
    console.log("[migration] clashes plugin-sync columns ensured");
  } catch (e) {
    console.error("[migration] clashes plugin-sync migration failed:", e);
  }
})();

(async () => {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS lens_viewpoints (
      id SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL,
      viewpoint_id TEXT NOT NULL,
      note TEXT,
      trade TEXT,
      report_type TEXT,
      priority INTEGER DEFAULT 3,
      floor TEXT,
      open_items TEXT,
      captured_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'open',
      synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(project_id, viewpoint_id)
    )`);
    await pool.query(`ALTER TABLE lens_viewpoints ADD COLUMN IF NOT EXISTS display_id TEXT`);
    await pool.query(`ALTER TABLE lens_viewpoints ADD COLUMN IF NOT EXISTS navisworks_guid TEXT`);
    await pool.query(`ALTER TABLE lens_viewpoints ADD COLUMN IF NOT EXISTS screenshot_url TEXT`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS lens_viewpoints_project_guid_unique ON lens_viewpoints (project_id, navisworks_guid)`);
    console.log("[migration] lens_viewpoints table ensured");
  } catch (e) {
    console.error("[migration] lens_viewpoints migration failed:", e);
  }

  try {
    const bcrypt = (await import("bcryptjs")).default;
    await pool.query(`CREATE TABLE IF NOT EXISTS platform_settings (
      id serial PRIMARY KEY,
      key text NOT NULL UNIQUE,
      value text NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now()
    )`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS can_access_living_brief boolean NOT NULL DEFAULT false`);
    const defaultHash = bcrypt.hashSync("BIMAI360", 10);
    await pool.query(
      `INSERT INTO platform_settings (key, value) VALUES ('living_brief_password_hash', $1) ON CONFLICT (key) DO NOTHING`,
      [defaultHash],
    );
    // One-time bootstrap only: if the platform has NO super admin yet, elevate the
    // owner account so the Living Brief can be managed. Guarded so it never
    // re-asserts privilege on subsequent boots (no identity-by-email escalation).
    const { rows: saRows } = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM users WHERE is_super_admin = true`,
    );
    if (saRows[0]?.n === 0) {
      const r = await pool.query(`UPDATE users SET is_super_admin = true WHERE email = 'robertor@rryasociados.com'`);
      if (r.rowCount) console.log("[migration] bootstrapped initial super admin");
    }
    console.log("[migration] living_brief settings ensured");
  } catch (e) {
    console.error("[migration] living_brief migration failed:", e);
  }
})();

export default app;
