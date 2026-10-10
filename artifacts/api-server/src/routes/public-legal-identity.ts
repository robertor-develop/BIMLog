import { Router, type IRouter } from "express";
import { derivePublicLegalIdentity } from "../lib/public-legal-identity";

const router: IRouter = Router();

router.get("/public/legal-identity", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.status(200).json(derivePublicLegalIdentity(process.env));
});

export default router;
