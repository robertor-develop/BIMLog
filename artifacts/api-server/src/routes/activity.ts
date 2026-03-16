import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { activityLogTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { ListActivityParams } from "@workspace/api-zod";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/projects/:projectId/activity", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const { projectId } = ListActivityParams.parse({ projectId: req.params.projectId });

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
});

export default router;
