import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { authMiddleware, isSuperAdminMiddleware } from "../middlewares/auth";
import { publicReleaseMetadata, resolveReleaseMetadata } from "../lib/release-metadata";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok", ...publicReleaseMetadata() });
  res.json(data);
});

router.get("/release-diagnostics", authMiddleware, isSuperAdminMiddleware, (_req, res) => {
  res.json({ status: "ok", releaseIdentity: resolveReleaseMetadata() });
});

export default router;
