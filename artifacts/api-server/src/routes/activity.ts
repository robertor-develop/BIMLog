import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { activityLogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/projects/:projectId/activity", authMiddleware, async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);

    const entries = await db.query.activityLogTable.findMany({
      where: eq(activityLogTable.projectId, projectId),
      orderBy: (a, { desc }) => [desc(a.createdAt)],
    });

    res.json(
      entries.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      }))
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
