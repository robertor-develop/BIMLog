import { Router } from "express";
import { authMiddleware } from "../middlewares/auth";
import { FinancialControlError } from "../lib/financial-control-contract";
import {
  bootstrapFinancialControls,
  changeFinancialSuspension,
  createApprovalPolicy,
  createFinancialContext,
  createFinancialGrant,
  evaluateSyntheticFinancialRequest,
  financialAdminState,
  financialAuditState,
  ownFinancialState,
  revokeFinancialGrant,
} from "../lib/financial-control-service";

const router = Router();
router.use("/financial-controls", authMiddleware);
const run =
  (handler: (req: any, res: any) => Promise<void>) =>
  async (req: any, res: any) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error instanceof FinancialControlError) {
        res
          .status(error.status)
          .json({
            code: error.code,
            error: { en: error.message, es: error.message },
          });
        return;
      }
      console.error("[financial-controls] request failed");
      res
        .status(500)
        .json({
          code: "FIN_INTERNAL_ERROR",
          error: {
            en: "Financial controls are temporarily unavailable.",
            es: "Los controles financieros no están disponibles temporalmente.",
          },
        });
    }
  };

router.get(
  "/financial-controls/state",
  run(async (req, res) => {
    res.json(await ownFinancialState(req.user.userId, req.query.projectId));
  }),
);
router.get(
  "/financial-controls/admin",
  run(async (req, res) => {
    res.json(await financialAdminState(req.user.userId, req.query.projectId));
  }),
);
router.get(
  "/financial-controls/audit",
  run(async (req, res) => {
    res.json(await financialAuditState(req.user.userId, req.query.projectId));
  }),
);
router.post(
  "/financial-controls/bootstrap",
  run(async (req, res) => {
    res
      .status(201)
      .json(
        await bootstrapFinancialControls({
          actorUserId: req.user.userId,
          companyId: req.body.companyId,
          projectId: req.body.projectId,
          administratorUserId: req.body.administratorUserId,
          baseCurrency: req.body.baseCurrency,
          reportingCurrency: req.body.reportingCurrency,
          permittedCurrencies: req.body.permittedCurrencies,
          reason: req.body.reason,
        }),
      );
  }),
);
router.post(
  "/financial-controls/contexts",
  run(async (req, res) => {
    res
      .status(201)
      .json(
        await createFinancialContext({
          actorUserId: req.user.userId,
          projectId: req.body.projectId,
          baseCurrency: req.body.baseCurrency,
          reportingCurrency: req.body.reportingCurrency,
          permittedCurrencies: req.body.permittedCurrencies,
          effectiveFrom: req.body.effectiveFrom,
          effectiveTo: req.body.effectiveTo,
          reason: req.body.reason,
        }),
      );
  }),
);
router.post(
  "/financial-controls/grants",
  run(async (req, res) => {
    res
      .status(201)
      .json(
        await createFinancialGrant({
          actorUserId: req.user.userId,
          projectId: req.body.projectId,
          userId: req.body.userId,
          authority: req.body.authority,
          effectiveFrom: req.body.effectiveFrom,
          effectiveTo: req.body.effectiveTo,
          reason: req.body.reason,
        }),
      );
  }),
);
router.post(
  "/financial-controls/grants/:grantId/revoke",
  run(async (req, res) => {
    res
      .status(201)
      .json(
        await revokeFinancialGrant({
          actorUserId: req.user.userId,
          grantId: String(req.params.grantId),
          reason: req.body.reason,
        }),
      );
  }),
);
router.post(
  "/financial-controls/approval-policies",
  run(async (req, res) => {
    res
      .status(201)
      .json(
        await createApprovalPolicy({
          actorUserId: req.user.userId,
          projectId: req.body.projectId,
          transactionCategory: req.body.transactionCategory,
          currency: req.body.currency,
          maxAmount: req.body.maxAmount,
          state: req.body.state,
          effectiveFrom: req.body.effectiveFrom,
          effectiveTo: req.body.effectiveTo,
          reason: req.body.reason,
        }),
      );
  }),
);
router.post(
  "/financial-controls/suspension",
  run(async (req, res) => {
    res
      .status(201)
      .json(
        await changeFinancialSuspension({
          actorUserId: req.user.userId,
          projectId: req.body.projectId,
          companyId: req.body.companyId,
          action: req.body.action,
          reason: req.body.reason,
          emergency: req.body.emergency === true,
        }),
      );
  }),
);
router.post(
  "/financial-controls/evaluate",
  run(async (req, res) => {
    res.json(
      await evaluateSyntheticFinancialRequest({
        actorUserId: req.user.userId,
        projectId: req.body.projectId,
        operation: req.body.operation,
        makerUserId: req.body.makerUserId,
        category: req.body.category,
        amount: req.body.amount,
        relatedRequests: req.body.relatedRequests,
      }),
    );
  }),
);
export default router;
