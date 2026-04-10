import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

export default app;
