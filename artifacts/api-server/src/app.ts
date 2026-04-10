import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "./routes";
import { startOverdueNotifier } from "./lib/overdue-notifier";
import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";

async function prodCleanAndSeed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM admin_actions_log");
    await client.query("DELETE FROM action_items");
    await client.query("DELETE FROM meeting_attendees");
    await client.query("DELETE FROM meeting_minutes");
    await client.query("DELETE FROM notifications");
    await client.query("DELETE FROM email_log");
    await client.query("DELETE FROM contact_submissions");
    await client.query("DELETE FROM rfi_ball_in_court_history");
    await client.query("DELETE FROM rfi_view_events");
    await client.query("DELETE FROM rfi_responses");
    await client.query("DELETE FROM submittal_view_events");
    await client.query("DELETE FROM submittal_register");
    await client.query("DELETE FROM transmittal_items");
    await client.query("DELETE FROM transmittals");
    await client.query("DELETE FROM change_order_documents");
    await client.query("DELETE FROM change_orders");
    await client.query("DELETE FROM project_directory");
    await client.query("DELETE FROM project_invitations");
    await client.query("DELETE FROM project_milestones");
    await client.query("DELETE FROM activity_log");
    await client.query("DELETE FROM naming_fields");
    await client.query("DELETE FROM naming_convention_versions");
    await client.query("DELETE FROM naming_conventions");
    await client.query("DELETE FROM submittals");
    await client.query("DELETE FROM rfis");
    await client.query("DELETE FROM files");
    await client.query("DELETE FROM project_members");
    await client.query("DELETE FROM projects");
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM companies");
    const hash = await bcrypt.hash("Newstart123$45", 10);
    await client.query(
      `INSERT INTO companies (name) VALUES ('RRY Asociados') ON CONFLICT DO NOTHING`
    );
    const companyRes = await client.query(`SELECT id FROM companies WHERE name = 'RRY Asociados' LIMIT 1`);
    const companyId = companyRes.rows[0].id;
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, company_id, is_super_admin) VALUES ($1, $2, $3, $4, true)`,
      ["robertor@rryasociados.com", hash, "Roberto Rodriguez", companyId]
    );
    await client.query("COMMIT");
    console.log("[PROD-CLEAN] Database cleaned and super admin created successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[PROD-CLEAN] Failed:", err);
  } finally {
    client.release();
  }
}

prodCleanAndSeed();

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

app.use("/api/v1", router);

startOverdueNotifier();

export default app;
