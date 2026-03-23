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
import prodSeedRouter from "./prod-seed";

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
router.use(prodSeedRouter);

export default router;
