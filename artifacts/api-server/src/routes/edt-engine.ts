import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";
import { edtProjectId, resolveEdtRouteActor, sendEdtRouteError } from "../lib/edt-engine-route-context";

const router: IRouter = Router();

router.get("/projects/:projectId/edt-engine/capabilities", authMiddleware, async (req, res): Promise<void> => {
  try {
    const projectId = edtProjectId(req);
    const actor = await resolveEdtRouteActor(req, projectId);
    res.json({ projectId, eligibleRole: actor.eligibleRole, grants: actor.grants });
  } catch (error) {
    sendEdtRouteError(res, error);
  }
});

export default router;
