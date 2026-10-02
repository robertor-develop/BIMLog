import {Router,type IRouter} from "express";
import {db} from "@workspace/db";
import {companiesTable,usersTable} from "@workspace/db/schema";
import {eq,sql} from "drizzle-orm";
import {authMiddleware} from "../middlewares/auth";
import {effectiveCommercialAccessForUser} from "../lib/commercial-entitlement";
import {deriveCommercialRuntimeWorkspace} from "../lib/commercial-workspace-runtime";

const router:IRouter=Router();
const configured=(name:string)=>typeof process.env[name]==="string"&&process.env[name]!.trim().length>0;

router.get("/commercial/workspace",authMiddleware,async(req,res)=>{
  try{
    const actor=req.user!;
    const [company]=await db.select({id:companiesTable.id,name:companiesTable.name,address:companiesTable.address,phone:companiesTable.phone}).from(companiesTable).where(eq(companiesTable.id,actor.companyId)).limit(1);
    if(!company){res.status(403).json({code:"COMMERCIAL_COMPANY_UNAVAILABLE",error:"The authenticated company is unavailable."});return;}
    const [members]=await db.select({count:sql<number>`count(*)::int`}).from(usersTable).where(eq(usersTable.companyId,company.id));
    const access=await effectiveCommercialAccessForUser(actor.userId);
    res.json(deriveCommercialRuntimeWorkspace({companyId:company.id,companyName:company.name,memberCount:Number(members?.count??0),commercialAccess:access.any,subscriptionConfigured:configured("BIMLOG_STRIPE_PRICE_IDS"),billingIdentityComplete:Boolean(company.address?.trim()&&company.phone?.trim()),paymentProviderConfigured:configured("STRIPE_SECRET_KEY"),webhookConfigured:configured("STRIPE_WEBHOOK_SECRET"),billingPortalConfigured:configured("STRIPE_PORTAL_CONFIGURATION_ID"),supportConfigured:configured("SENDGRID_API_KEY")}));
  }catch{res.status(503).json({code:"COMMERCIAL_WORKSPACE_UNAVAILABLE",error:"Commercial workspace status is temporarily unavailable."});}
});

export default router;
