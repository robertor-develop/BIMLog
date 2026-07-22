import { Router, type IRouter, type Request, type Response } from "express";
import { authMiddleware } from "../middlewares/auth";
import {
  CoordinatorRegisterError,
  loadCoordinatorActionRegister,
  parseRegisterQuery,
} from "../lib/coordinator-action-register";
import {
  CoordinatorSavedViewError,
  createCoordinatorSavedView,
  deleteCoordinatorSavedView,
  listCoordinatorSavedViews,
  updateCoordinatorSavedView,
} from "../lib/coordinator-saved-views";

const router: IRouter = Router();

const scope = (req: Request) => ({
  userId: req.user!.userId,
  projectId: Number(req.params.projectId),
  superAdminAccess: String(req.header("x-bimlog-super-admin-access") ?? ""),
  superAdminReason: String(req.header("x-bimlog-super-admin-reason") ?? ""),
});

function savedViewFailure(res: Response, error: unknown) {
  if (error instanceof CoordinatorSavedViewError) {
    res.status(error.status).json({ error: error.code, message: error.message, messageEs: error.messageEs });
    return;
  }
  if (error instanceof CoordinatorRegisterError) {
    res.status(error.status).json({ error: error.code, message: error.message, messageEs: "No se pudo autorizar la operación de la vista guardada." });
    return;
  }
  res.status(500).json({
    error: "SAVED_VIEW_OPERATION_FAILED",
    message: "The saved-view operation could not be completed.",
    messageEs: "No se pudo completar la operación de la vista guardada.",
  });
}

function assertSavedViewBody(req: Request) {
  if (Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8") > 8192)
    throw new CoordinatorSavedViewError(413, "SAVED_VIEW_PAYLOAD_TOO_LARGE", "The saved-view request is too large.", "La solicitud de la vista guardada es demasiado grande.");
}

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

router.get(
  "/projects/:projectId/coordinator-saved-views",
  authMiddleware,
  async (req, res) => {
    try {
      res.setHeader("Cache-Control", "private, no-store");
      res.json(await listCoordinatorSavedViews(scope(req)));
    } catch (error) {
      savedViewFailure(res, error);
    }
  },
);

router.post(
  "/projects/:projectId/coordinator-saved-views",
  authMiddleware,
  async (req, res) => {
    try {
      assertSavedViewBody(req);
      const result = await createCoordinatorSavedView({
        ...scope(req),
        name: req.body?.name,
        configuration: req.body?.configuration,
        isDefault: req.body?.isDefault,
        idempotencyKey: req.body?.idempotencyKey,
      });
      res.status(result.idempotent ? 200 : 201).json(result);
    } catch (error) {
      savedViewFailure(res, error);
    }
  },
);

router.patch(
  "/projects/:projectId/coordinator-saved-views/:savedViewId",
  authMiddleware,
  async (req, res) => {
    try {
      assertSavedViewBody(req);
      res.json(
        await updateCoordinatorSavedView({
          ...scope(req),
          savedViewId: String(req.params.savedViewId),
          name: req.body?.name,
          configuration: req.body?.configuration,
          isDefault: req.body?.isDefault,
          expectedVersion: req.body?.expectedVersion,
          idempotencyKey: req.body?.idempotencyKey,
        }),
      );
    } catch (error) {
      savedViewFailure(res, error);
    }
  },
);

router.delete(
  "/projects/:projectId/coordinator-saved-views/:savedViewId",
  authMiddleware,
  async (req, res) => {
    try {
      assertSavedViewBody(req);
      res.json(
        await deleteCoordinatorSavedView({
          ...scope(req),
          savedViewId: String(req.params.savedViewId),
          expectedVersion: req.body?.expectedVersion,
          idempotencyKey: req.body?.idempotencyKey,
        }),
      );
    } catch (error) {
      savedViewFailure(res, error);
    }
  },
);

export default router;
