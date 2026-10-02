import {Router,type IRouter} from "express";
import {db} from "@workspace/db";
import {companiesTable,usersTable} from "@workspace/db/schema";
import {eq,sql} from "drizzle-orm";
import {authMiddleware} from "../middlewares/auth";
import {effectiveCommercialAccessForUser} from "../lib/commercial-entitlement";
import {deriveCommercialRuntimeWorkspace} from "../lib/commercial-workspace-runtime";
import {inspectCommercialPlatformReadiness} from "../lib/commercial-platform-readiness";

const router:IRouter=Router();

router.get("/commercial/workspace",authMiddleware,async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");
  res.set("Vary","Authorization");
  try{
    const actor=req.user!;
    const [company]=await db.select({id:companiesTable.id,name:companiesTable.name,address:companiesTable.address,phone:companiesTable.phone}).from(companiesTable).where(eq(companiesTable.id,actor.companyId)).limit(1);
    if(!company){res.status(403).json({code:"COMMERCIAL_COMPANY_UNAVAILABLE",error:"The authenticated company is unavailable."});return;}
    const [members]=await db.select({count:sql<number>`count(*)::int`}).from(usersTable).where(eq(usersTable.companyId,company.id));
    const access=await effectiveCommercialAccessForUser(actor.userId);
    const platform=inspectCommercialPlatformReadiness(process.env);
    res.json(deriveCommercialRuntimeWorkspace({companyId:company.id,companyName:company.name,memberCount:Number(members?.count??0),commercialAccess:access.any,billingIdentityComplete:Boolean(company.address?.trim()&&company.phone?.trim()),...platform,platformChecks:platform.checks}));
  }catch{res.status(503).json({code:"COMMERCIAL_WORKSPACE_UNAVAILABLE",error:"Commercial workspace status is temporarily unavailable."});}
});

export default router;
