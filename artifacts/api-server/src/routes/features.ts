import { Router } from "express";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";
import { createPlatformCapabilityVersion, FeatureCatalogError, getEffectiveFeature, listCatalogVersions, listEffectiveCatalog, resolveEffectiveEntitlement } from "../lib/feature-catalog-service";
import type { CapabilityStatus } from "../lib/entitlement-contract";

const router = Router();
const statuses = new Set<CapabilityStatus>(["available", "preview", "coming_later", "suspended", "deprecated"]);
const inputFailure = (res: Parameters<Parameters<typeof router.get>[1]>[1], status: number, code: string, en: string, es: string) => res.status(status).json({ code, error: { en, es } });
const safeFailure = (res: Parameters<Parameters<typeof router.get>[1]>[1], error: unknown) => {
  if (error instanceof FeatureCatalogError) return inputFailure(res,error.status,error.code,error.message,"La solicitud de controles de funciones no es válida.");
  return inputFailure(res,500,"ENT_UNAVAILABLE","Feature controls are temporarily unavailable.","Los controles de funciones no están disponibles temporalmente.");
};

router.get("/features/catalog", authMiddleware, async (_req, res) => {
  try { res.json({ features: await listEffectiveCatalog(), readOnly: true }); } catch (error) { safeFailure(res, error); }
});

router.get("/features/catalog/:featureKey", authMiddleware, async (req, res) => {
  try {
    const feature = await getEffectiveFeature(String(req.params.featureKey));
    if (!feature) return inputFailure(res,404,"ENT_UNAVAILABLE","Feature not found.","No se encontró la función.");
    return res.json({ feature, readOnly: true });
  } catch (error) { return safeFailure(res, error); }
});

router.get("/features/:featureKey/entitlement", authMiddleware, async (req, res) => {
  try {
    const rawProjectId = req.query.projectId;
    const projectId = rawProjectId === undefined ? undefined : Number(rawProjectId);
    if (projectId !== undefined && (!Number.isSafeInteger(projectId) || projectId <= 0)) return inputFailure(res,400,"PROJECT_CONTEXT_INVALID","projectId must be a positive integer.","projectId debe ser un número entero positivo.");
    return res.json(await resolveEffectiveEntitlement({ featureKey: String(req.params.featureKey), userId: req.user!.userId, companyId: req.user!.companyId, projectId }));
  } catch (error) { return safeFailure(res, error); }
});

router.get("/admin/feature-catalog/versions", authMiddleware, isSuperAdminMiddleware, async (_req, res) => {
  try { res.json({ versions: await listCatalogVersions(), readOnly: true }); } catch (error) { safeFailure(res, error); }
});

router.post("/admin/platform-capabilities/:featureKey", authMiddleware, isSuperAdminMiddleware, async (req, res) => {
  try {
    const status = String(req.body.status) as CapabilityStatus;
    const reasonCode = String(req.body.reasonCode ?? "").trim();
    const explanation = { en: String(req.body.explanation?.en ?? "").trim(), es: String(req.body.explanation?.es ?? "").trim() };
    if (!statuses.has(status)) {
      return inputFailure(res,400,"PLATFORM_STATUS_INVALID","A valid platform status is required.","Se requiere un estado de plataforma válido.");
    }
    const result = await createPlatformCapabilityVersion({ featureKey: String(req.params.featureKey), status, reasonCode, explanation, actorUserId: req.user!.userId });
    return res.status(201).json(result);
  } catch (error) { return safeFailure(res, error); }
});

export default router;
