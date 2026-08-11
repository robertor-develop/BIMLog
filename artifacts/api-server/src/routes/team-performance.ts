import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { FinancialControlError } from "../lib/financial-control-contract";
import { getTeamPerformance } from "../lib/team-performance-service";
import { applyScenario, evaluateScenario, getResourcePlanning, saveCapacityProfile, saveScenario } from "../lib/team-resource-planning-service";

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

const handle = (operation: (req:any)=>Promise<unknown>) => async (req:any,res:any) => { try { res.json(await operation(req)); } catch(error) { if(error instanceof FinancialControlError){res.status(error.status).json({code:error.code,error:error.message});return;} console.error("[team-resource-planning] request failed",error);res.status(500).json({code:"TEAM_RESOURCE_INTERNAL_ERROR",error:"Resource planning is temporarily unavailable."}); } };
router.get("/projects/:projectId/commercial/team-performance/resource-planning", handle(req=>getResourcePlanning({actorUserId:req.user.userId,projectId:req.params.projectId})));
router.put("/projects/:projectId/commercial/team-performance/resource-planning/profiles/:userId", handle(req=>saveCapacityProfile({actorUserId:req.user.userId,projectId:req.params.projectId,userId:req.params.userId,profile:req.body?.profile,expectedVersion:req.body?.expectedVersion})));
router.post("/projects/:projectId/commercial/team-performance/resource-planning/evaluate", handle(req=>evaluateScenario({actorUserId:req.user.userId,projectId:req.params.projectId,content:req.body})));
router.post("/projects/:projectId/commercial/team-performance/resource-planning/scenarios", handle(req=>saveScenario({actorUserId:req.user.userId,projectId:req.params.projectId,scenarioKey:req.body?.scenarioKey,expectedVersion:req.body?.expectedVersion,content:req.body})));
router.post("/projects/:projectId/commercial/team-performance/resource-planning/scenarios/:scenarioVersionId/apply", handle(req=>applyScenario({actorUserId:req.user.userId,projectId:req.params.projectId,scenarioVersionId:req.params.scenarioVersionId,eventKey:req.body?.eventKey,reason:req.body?.reason})));

export default router;
