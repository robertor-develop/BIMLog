import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

const WIPE_KEY = process.env.WIPE_SECRET_KEY || "bimlog-wipe-2026-ignitesmart";

router.post("/wipe-all-data", async (req, res) => {
  const key = req.headers["x-wipe-key"];
  if (key !== WIPE_KEY) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    await db.execute(sql`DELETE FROM submittal_view_events`);
    await db.execute(sql`DELETE FROM submittal_register`);
    await db.execute(sql`DELETE FROM rfi_view_events`);
    await db.execute(sql`DELETE FROM rfi_ball_in_court_history`);
    await db.execute(sql`DELETE FROM rfi_responses`);
    await db.execute(sql`DELETE FROM transmittal_items`);
    await db.execute(sql`DELETE FROM transmittals`);
    await db.execute(sql`DELETE FROM change_order_documents`);
    await db.execute(sql`DELETE FROM change_orders`);
    await db.execute(sql`DELETE FROM meeting_attendees`);
    await db.execute(sql`DELETE FROM action_items`);
    await db.execute(sql`DELETE FROM meeting_minutes`);
    await db.execute(sql`DELETE FROM project_milestones`);
    await db.execute(sql`DELETE FROM project_directory`);
    await db.execute(sql`DELETE FROM notifications`);
    await db.execute(sql`DELETE FROM submittals`);
    await db.execute(sql`DELETE FROM rfis`);
    await db.execute(sql`DELETE FROM files`);
    await db.execute(sql`DELETE FROM naming_fields`);
    await db.execute(sql`DELETE FROM naming_conventions`);
    await db.execute(sql`DELETE FROM activity_log`);
    await db.execute(sql`DELETE FROM email_log`);
    await db.execute(sql`DELETE FROM admin_actions_log`);
    await db.execute(sql`DELETE FROM project_invitations`);
    await db.execute(sql`DELETE FROM project_members`);
    await db.execute(sql`DELETE FROM projects`);
    await db.execute(sql`DELETE FROM users WHERE email != 'robertor@rryasociados.com'`);
    await db.execute(sql`
      DELETE FROM companies
      WHERE id != (
        SELECT company_id FROM users
        WHERE email = 'robertor@rryasociados.com'
        LIMIT 1
      )
    `);

    return res.json({ ok: true, message: "All data wiped. Only robertor@rryasociados.com remains." });
  } catch (err) {
    console.error("[wipe] error:", err);
    return res.status(500).json({ error: String(err) });
  }
});

export default router;
