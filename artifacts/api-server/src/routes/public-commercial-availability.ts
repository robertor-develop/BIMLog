import { Router, type IRouter } from "express";
import { derivePublicCommercialAvailability } from "../lib/public-commercial-availability";

const router: IRouter = Router();
router.get("/public/commercial-availability", (_req,res) => {
  res.setHeader("Cache-Control","no-store");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.status(200).json(derivePublicCommercialAvailability(process.env));
});
export default router;
