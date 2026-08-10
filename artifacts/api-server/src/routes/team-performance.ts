import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { FinancialControlError } from "../lib/financial-control-contract";
import { getTeamPerformance } from "../lib/team-performance-service";

const router = Router();
router.use("/projects/:projectId/commercial/team-performance", authMiddleware);

router.get("/projects/:projectId/commercial/team-performance", async (req: any, res) => {
  try {
    res.json(await getTeamPerformance({ actorUserId: req.user.userId, projectId: req.params.projectId, from: req.query.from, to: req.query.to }));
  } catch (error) {
    if (error instanceof FinancialControlError) {
      res.status(error.status).json({ code: error.code, error: error.message });
      return;
    }
    console.error("[team-performance] request failed", error);
    res.status(500).json({ code: "TEAM_PERFORMANCE_INTERNAL_ERROR", error: "Team Performance & Skills is temporarily unavailable." });
  }
});

export default router;
