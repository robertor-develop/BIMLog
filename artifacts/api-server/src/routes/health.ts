import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/debug-db", async (_req, res) => {
  const { db } = await import("@workspace/db");
  const { sql } = await import("drizzle-orm");
  const result = await db.execute(sql`SELECT current_database(), inet_server_addr(), COUNT(*) as project_count FROM projects`);
  res.json(result.rows);
});

export default router;
