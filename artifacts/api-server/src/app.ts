import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import router from "./routes";
import { startOverdueNotifier } from "./lib/overdue-notifier";
import { runAutoSeed } from "./lib/auto-seed";

const app: Express = express();

app.disable("etag");
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1", (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use("/api/v1", router);

startOverdueNotifier();
runAutoSeed();

export default app;
