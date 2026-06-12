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
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.method !== "POST" || !PLUGIN_SYNC_RE.test(req.path)) return next();
  const chunks: Buffer[] = [];
  req.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
  req.on("end", () => {
    const buf = Buffer.concat(chunks);
    if (buf.length) (req as unknown as { rawBody?: Buffer }).rawBody = buf;
    (req as unknown as { _body?: boolean })._body = true;
    next();
  });
  req.on("error", () => next());
});

app.use(express.json({ limit: "50mb", type: jsonTypeMatcher, verify: captureRawBody }));
app.use(express.urlencoded({ extended: true, limit: "50mb", verify: captureRawBody }));

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

export default app;
