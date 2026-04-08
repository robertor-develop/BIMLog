import { Router } from "express";
import { authMiddleware, requireProjectMember } from "../middlewares/auth";
import { getProjectIntelligence } from "../lib/project-intelligence";

const router: Router = Router();

router.get("/projects/:projectId/intelligence-summary", authMiddleware, requireProjectMember(), async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    if (isNaN(projectId)) { res.status(400).json({ error: "Invalid project ID" }); return; }

    const filters: { from?: string; to?: string; versionFrom?: number; versionTo?: number } = {};
    if (req.query.from) {
      const fromStr = String(req.query.from);
      if (isNaN(new Date(fromStr + "T00:00:00.000Z").getTime())) { res.status(400).json({ error: "Invalid 'from' date" }); return; }
      filters.from = fromStr;
    }
    if (req.query.to) {
      const toStr = String(req.query.to);
      if (isNaN(new Date(toStr + "T00:00:00.000Z").getTime())) { res.status(400).json({ error: "Invalid 'to' date" }); return; }
      filters.to = toStr;
    }
    if (req.query.versionFrom) {
      const vf = Number(req.query.versionFrom);
      if (!Number.isFinite(vf) || vf < 1) { res.status(400).json({ error: "Invalid 'versionFrom'" }); return; }
      filters.versionFrom = vf;
    }
    if (req.query.versionTo) {
      const vt = Number(req.query.versionTo);
      if (!Number.isFinite(vt) || vt < 1) { res.status(400).json({ error: "Invalid 'versionTo'" }); return; }
      filters.versionTo = vt;
    }

    const result = await getProjectIntelligence(projectId, filters);
    if (!result) { res.status(404).json({ error: "Project not found" }); return; }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

export default router;
