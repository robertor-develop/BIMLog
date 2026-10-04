import {Router,type IRouter} from "express";
import {db,pool} from "@workspace/db";
import {companiesTable,usersTable} from "@workspace/db/schema";
import {eq,sql} from "drizzle-orm";
import {authMiddleware} from "../middlewares/auth";
import {effectiveCommercialAccessForUser} from "../lib/commercial-entitlement";
import {deriveCommercialRuntimeWorkspace} from "../lib/commercial-workspace-runtime";
import {inspectCommercialPlatformReadiness} from "../lib/commercial-platform-readiness";
import {requireCommercialBillingManager,resolveCommercialBillingAuthority} from "../lib/commercial-billing-authority";
import {startCommercialCheckout} from "../lib/commercial-checkout-command";
import {startCommercialBillingPortal} from "../lib/commercial-portal-command";

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
    const billingAuthority=await resolveCommercialBillingAuthority(pool,{userId:actor.userId,companyId:actor.companyId});
    res.json({...deriveCommercialRuntimeWorkspace({companyId:company.id,companyName:company.name,memberCount:Number(members?.count??0),commercialAccess:access.any,billingIdentityComplete:Boolean(company.address?.trim()&&company.phone?.trim()),...platform,platformChecks:platform.checks}),billingAuthority:{canManageBilling:billingAuthority.canManageBilling,role:billingAuthority.role}});
  }catch{res.status(503).json({code:"COMMERCIAL_WORKSPACE_UNAVAILABLE",error:"Commercial workspace status is temporarily unavailable."});}
});

router.post("/commercial/checkout",authMiddleware,async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");
  try{
    const actor=req.user!,authority=await resolveCommercialBillingAuthority(pool,{userId:actor.userId,companyId:actor.companyId});requireCommercialBillingManager(authority);
    const requestKey=typeof req.body?.requestKey==="string"?req.body.requestKey.trim():"";
    if(!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(requestKey)){res.status(400).json({code:"CHECKOUT_REQUEST_INVALID",error:"A valid checkout request identity is required."});return;}
    const result=await startCommercialCheckout({client:pool,environment:process.env,companyId:actor.companyId,userId:actor.userId,requestKey,plan:req.body?.plan,cycle:req.body?.cycle});
    res.status(201).json(result);
  }catch(error){const message=error instanceof Error?error.message:"Checkout unavailable";const denied=/administrator authority/.test(message);res.status(denied?403:503).json({code:denied?"BILLING_AUTHORITY_REQUIRED":"CHECKOUT_UNAVAILABLE",error:message});}
});

router.post("/commercial/billing-portal",authMiddleware,async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");
  try{
    const actor=req.user!,authority=await resolveCommercialBillingAuthority(pool,{userId:actor.userId,companyId:actor.companyId});requireCommercialBillingManager(authority);
    res.status(201).json(await startCommercialBillingPortal({client:pool,environment:process.env,companyId:actor.companyId,userId:actor.userId}));
  }catch(error){const message=error instanceof Error?error.message:"Billing self-service unavailable";const denied=/administrator authority/.test(message);res.status(denied?403:503).json({code:denied?"BILLING_AUTHORITY_REQUIRED":"BILLING_PORTAL_UNAVAILABLE",error:message});}
});

export default router;
