import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { FinancialControlError } from "../lib/financial-control-contract";
import { CostValuePlanError, getCostValuePlan, saveCostValuePlan } from "../lib/cost-value-plan-service";
import { exportCostValuePerformanceCsv, getCostValuePerformance, saveCostValuePerformance } from "../lib/cost-value-performance-service";
import { exportCostValueForecastCsv, getCostValueForecast, saveCostValueForecast } from "../lib/cost-value-forecast-service";
import { getManualBonuses, proposeManualBonus, decideManualBonus } from "../lib/cost-value-bonus-service";

const router = Router();
router.use("/projects/:projectId/financial/apu", authMiddleware);
const projectId = (value: unknown) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new CostValuePlanError(400, "PROJECT_INVALID", "A valid project is required.");
  return id;
};
const run = (handler: (req: any, res: any) => Promise<void>) => async (req: any, res: any) => {
  try { await handler(req, res); }
  catch (error) {
    if (error instanceof CostValuePlanError || error instanceof FinancialControlError) {
      res.status(error.status).json({ code: error.code, error: { en: error.message, es: error.message } }); return;
    }
    console.error("[cost-value-plan] request failed");
    res.status(500).json({ code: "COST_VALUE_INTERNAL_ERROR", error: { en: "Cost & Value Planner is temporarily unavailable.", es: "El Planificador de Costos y Valor no está disponible temporalmente." } });
  }
};

const bonusBody = (body: unknown, keys: string[]) => {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key)))
    throw new CostValuePlanError(400, "BONUS_INPUT_INVALID", "Unsupported bonus request fields.");
};
router.get("/projects/:projectId/financial/apu/bonus-proposals", run(async (req, res) => {
  res.json(await getManualBonuses(req.user.userId, projectId(req.params.projectId), req.query.before));
}));
router.post("/projects/:projectId/financial/apu/bonus-proposals", run(async (req, res) => {
  bonusBody(req.body, ["fundingId", "idempotencyKey", "reason", "entries"]);
  res.json(await proposeManualBonus(req.user.userId, projectId(req.params.projectId), req.body));
}));
router.post("/projects/:projectId/financial/apu/bonus-proposals/:proposalId/decision", run(async (req, res) => {
  bonusBody(req.body, ["outcome", "expectedFingerprint", "reason"]);
  res.json(await decideManualBonus(req.user.userId, projectId(req.params.projectId), req.params.proposalId, req.body));
}));

router.get("/projects/:projectId/financial/apu", run(async (req, res) => {
  res.json(await getCostValuePlan(req.user.userId, projectId(req.params.projectId)));
}));
router.put("/projects/:projectId/financial/apu", run(async (req, res) => {
  res.json(await saveCostValuePlan(req.user.userId, projectId(req.params.projectId), req.body));
}));
router.get("/projects/:projectId/financial/apu/performance", run(async (req, res) => {
  res.json(await getCostValuePerformance(req.user.userId, projectId(req.params.projectId)));
}));
router.put("/projects/:projectId/financial/apu/performance", run(async (req, res) => {
  res.json(await saveCostValuePerformance(req.user.userId, projectId(req.params.projectId), req.body));
}));
router.get("/projects/:projectId/financial/apu/performance.csv", run(async (req, res) => {
  const csv = await exportCostValuePerformanceCsv(req.user.userId, projectId(req.params.projectId));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="cost-value-performance-project-${projectId(req.params.projectId)}.csv"`);
  res.send(csv);
}));
router.get("/projects/:projectId/financial/apu/forecast", run(async (req, res) => {
  res.json(await getCostValueForecast(req.user.userId, projectId(req.params.projectId)));
}));
router.put("/projects/:projectId/financial/apu/forecast", run(async (req, res) => {
  res.json(await saveCostValueForecast(req.user.userId, projectId(req.params.projectId), req.body));
}));
router.get("/projects/:projectId/financial/apu/forecast.csv", run(async (req, res) => {
  const csv = await exportCostValueForecastCsv(req.user.userId, projectId(req.params.projectId));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="cost-value-forecast-project-${projectId(req.params.projectId)}.csv"`);
  res.send(csv);
}));

export default router;
