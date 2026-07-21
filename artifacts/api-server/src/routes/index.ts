import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import filesRouter from "./files";
import rfisRouter from "./rfis";
import submittalsRouter from "./submittals";
import activityRouter from "./activity";
import conventionsRouter from "./conventions";
import membersRouter from "./members";
import configRouter from "./config";
import downloadsRouter from "./downloads";
import documentsRouter from "./documents";
import adminRouter from "./admin";
import contactRouter from "./contact";
import notificationsRouter from "./notifications";
import directoryRouter from "./project_directory";
import transmittalsRouter from "./transmittals";
import changeOrdersRouter from "./change_orders";
import meetingMinutesRouter from "./meeting_minutes";
import scheduleRouter from "./schedule";
import searchRouter from "./search";
import reportsRouter from "./reports";
import dashboardBriefingRouter from "./dashboard_briefing";
import intelligenceRouter from "./intelligence";
import coordinationRouter from "./coordination";
import companyProfileRouter from "./company-profile";
import clashReportsRouter from "./clash_reports";
import submittalReportsRouter from "./submittal_reports";
import linkedItemsRouter from "./linked_items";
import agentsRouter from "./agents";
import autodeskRouter from "./autodesk";
import livingBriefRouter from "./living_brief";
import connectionsRouter from "./connections";
import feedbackRouter from "./feedback";
import telegramProductRouter from "./telegram-product";
import aiControlPlaneRouter from "./ai-control-plane";
import featuresRouter from "./features";
import featurePoliciesRouter from "./feature-policies";
import financialControlsRouter from "./financial-controls";
import financialBudgetsRouter from "./financial-budgets";

const router: IRouter = Router();

router.use(downloadsRouter);
router.use(healthRouter);
router.use(authRouter);
router.use(configRouter);
router.use(projectsRouter);
router.use(filesRouter);
router.use(documentsRouter);
router.use(rfisRouter);
router.use(submittalsRouter);
router.use(activityRouter);
router.use(conventionsRouter);
router.use(membersRouter);
router.use(adminRouter);
router.use(contactRouter);
router.use(notificationsRouter);
router.use(directoryRouter);
router.use(transmittalsRouter);
router.use(changeOrdersRouter);
router.use(meetingMinutesRouter);
router.use(scheduleRouter);
router.use(searchRouter);
router.use(reportsRouter);
router.use(dashboardBriefingRouter);
router.use(intelligenceRouter);
router.use(coordinationRouter);
router.use(companyProfileRouter);
router.use(clashReportsRouter);
router.use(submittalReportsRouter);
router.use(linkedItemsRouter);
router.use(agentsRouter);
router.use(autodeskRouter);
router.use(livingBriefRouter);
router.use(connectionsRouter);
router.use(feedbackRouter);
router.use(telegramProductRouter);
router.use(aiControlPlaneRouter);
router.use(featurePoliciesRouter);
router.use(featuresRouter);
router.use(financialControlsRouter);
router.use(financialBudgetsRouter);

// Soft-delete routes are appended inside their existing route files:
//   clash_reports.ts → DELETE /projects/:projectId/clash-reports/:reportId/clashes/:clashId
//   rfis.ts          → DELETE /projects/:projectId/rfis/:rfiId
//   submittals.ts    → DELETE /projects/:projectId/submittals/:submittalId
//   transmittals.ts  → DELETE /projects/:projectId/transmittals/:transmittalId
//   change_orders.ts → DELETE /projects/:projectId/change-orders/:changeOrderId
//   meeting_minutes.ts → DELETE /projects/:projectId/meetings/:meetingId
// Those files are already registered via the .use(...) calls above.

export default router;
