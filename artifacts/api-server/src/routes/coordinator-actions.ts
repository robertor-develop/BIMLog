import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  CoordinatorRegisterError,
  loadCoordinatorActionRegister,
  parseRegisterQuery,
} from "../lib/coordinator-action-register";

const router: IRouter = Router();

router.get(
  "/projects/:projectId/coordinator-actions",
  authMiddleware,
  async (req, res) => {
    try {
      const result = await loadCoordinatorActionRegister({
        userId: req.user!.userId,
        projectId: Number(req.params.projectId),
        query: parseRegisterQuery(req.query as Record<string, unknown>),
        superAdminAccess: String(
          req.header("x-bimlog-super-admin-access") ?? "",
        ),
        superAdminReason: String(
          req.header("x-bimlog-super-admin-reason") ?? "",
        ),
      });
      res.setHeader("Cache-Control", "private, no-store");
      res.json(result);
    } catch (error) {
      if (error instanceof CoordinatorRegisterError) {
        res
          .status(error.status)
          .json({ error: error.code, message: error.message });
        return;
      }
      res
        .status(500)
        .json({
          error: "COORDINATOR_REGISTER_FAILED",
          message: "The action register could not be loaded.",
        });
    }
  },
);

export default router;
