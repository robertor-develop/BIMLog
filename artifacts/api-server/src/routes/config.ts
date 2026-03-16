import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { configOptionsTable } from "@workspace/db/schema";
import { asc } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router = Router();

router.get("/config", authMiddleware, async (_req: Request, res: Response) => {
  const options = await db
    .select()
    .from(configOptionsTable)
    .orderBy(asc(configOptionsTable.category), asc(configOptionsTable.sortOrder));

  const grouped: Record<string, Array<{ value: string; label: string; labelEs: string; meta?: Record<string, string> | null }>> = {};
  for (const opt of options) {
    if (!grouped[opt.category]) {
      grouped[opt.category] = [];
    }
    grouped[opt.category].push({
      value: opt.value,
      label: opt.label,
      labelEs: opt.labelEs,
      ...(opt.meta ? { meta: opt.meta } : {}),
    });
  }

  res.json(grouped);
});

export default router;
