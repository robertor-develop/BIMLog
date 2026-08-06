import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { FinancialControlError } from "../lib/financial-control-contract";
import { CostValuePlanError, getCostValuePlan, saveCostValuePlan } from "../lib/cost-value-plan-service";
import { exportCostValuePerformanceCsv, getCostValuePerformance, saveCostValuePerformance } from "../lib/cost-value-performance-service";
import { exportCostValueForecastCsv, getCostValueForecast, saveCostValueForecast } from "../lib/cost-value-forecast-service";

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
