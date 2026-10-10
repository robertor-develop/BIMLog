import {Router,type IRouter} from "express";
import {db,pool} from "@workspace/db";
import {companiesTable,usersTable} from "@workspace/db/schema";
import {eq,sql} from "drizzle-orm";
import {authMiddleware,isSuperAdminMiddleware} from "../middlewares/auth";
import {effectiveCommercialAccessForUser} from "../lib/commercial-entitlement";
import {deriveCommercialRuntimeWorkspace} from "../lib/commercial-workspace-runtime";
import {inspectCommercialPlatformReadiness} from "../lib/commercial-platform-readiness";
import {requireCommercialBillingManager,resolveCommercialBillingAuthority} from "../lib/commercial-billing-authority";
import {startCommercialCheckout} from "../lib/commercial-checkout-command";
import {startCommercialBillingPortal} from "../lib/commercial-portal-command";
import {readCustomerBillingHistory} from "../lib/commercial-billing-history";
import {parseBillingHistoryQuery} from "../lib/commercial-billing-history-query";
import {deriveCommercialLaunchActivation} from "../lib/commercial-launch-activation";
import {verifyCommercialLaunchLive} from "../lib/commercial-launch-live-verification";
import {readCommercialLaunchVerificationHistory,readLatestCommercialLaunchVerification,recordCommercialLaunchVerification} from "../lib/commercial-launch-verification-store";
import {deriveCommercialLaunchAuthorization} from "../lib/commercial-launch-authorization";
import {resolveReleaseMetadata} from "../lib/release-metadata";
import {readPersistentCommercialAuthority} from "../lib/commercial-persistence";
import type {CommercialSubscriptionStatus} from "../lib/commercial-workspace-runtime";
import {prepareCompanySubscription} from "../lib/commercial-subscription-setup";
import {deriveCommercialLaunchProfile,commercialLaunchProfileConfigurationKeys} from "../lib/commercial-launch-profile";
import {deriveCommercialLaunchDossier} from "../lib/commercial-launch-dossier";
import {deriveCommercialBillingIdentity,parseCommercialBillingIdentityUpdate} from "../lib/commercial-billing-identity";

const router:IRouter=Router();

router.get("/commercial/billing-identity",authMiddleware,async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");res.set("Vary","Authorization");
  try{
    const actor=req.user!,authority=await resolveCommercialBillingAuthority(pool,{userId:actor.userId,companyId:actor.companyId});requireCommercialBillingManager(authority);
    const [company]=await db.select({id:companiesTable.id,name:companiesTable.name,address:companiesTable.address,phone:companiesTable.phone}).from(companiesTable).where(eq(companiesTable.id,actor.companyId)).limit(1);
    if(!company)throw new Error("Authenticated billing identity is unavailable");
    res.json(deriveCommercialBillingIdentity({companyId:company.id,legalName:company.name,address:company.address,phone:company.phone}));
  }catch(error){const denied=/administrator authority/.test(error instanceof Error?error.message:"");res.status(denied?403:503).json({code:denied?"BILLING_AUTHORITY_REQUIRED":"BILLING_IDENTITY_UNAVAILABLE",error:denied?"Billing administrator authority is required.":"Billing identity is temporarily unavailable."});}
});

router.patch("/commercial/billing-identity",authMiddleware,async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");res.set("Vary","Authorization");
  try{
    const actor=req.user!,authority=await resolveCommercialBillingAuthority(pool,{userId:actor.userId,companyId:actor.companyId});requireCommercialBillingManager(authority);
    const values=parseCommercialBillingIdentityUpdate(req.body);
    const [company]=await db.update(companiesTable).set(values).where(eq(companiesTable.id,actor.companyId)).returning({id:companiesTable.id,name:companiesTable.name,address:companiesTable.address,phone:companiesTable.phone});
    if(!company)throw new Error("Authenticated billing identity is unavailable");
    res.json(deriveCommercialBillingIdentity({companyId:company.id,legalName:company.name,address:company.address,phone:company.phone}));
  }catch(error){const message=error instanceof Error?error.message:"",denied=/administrator authority/.test(message),invalid=/Billing (address|phone|identity update)/.test(message);res.status(denied?403:invalid?400:503).json({code:denied?"BILLING_AUTHORITY_REQUIRED":invalid?"BILLING_IDENTITY_INVALID":"BILLING_IDENTITY_UNAVAILABLE",error:denied?"Billing administrator authority is required.":invalid?message:"Billing identity is temporarily unavailable."});}
});

router.get("/admin/commercial-launch",authMiddleware,isSuperAdminMiddleware,(_req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");
  res.set("Vary","Authorization");
  res.json(deriveCommercialLaunchActivation(process.env));
});

router.post("/admin/commercial-launch/verify",authMiddleware,isSuperAdminMiddleware,async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");res.set("Vary","Authorization");
  try{const live=await verifyCommercialLaunchLive(process.env);const receipt=await recordCommercialLaunchVerification(pool,req.user!.userId,live);res.json({...live,receipt});}catch{res.status(503).json({code:"COMMERCIAL_LIVE_VERIFICATION_UNAVAILABLE",error:"Provider verification is temporarily unavailable."});}
});

router.get("/admin/commercial-launch/verifications",authMiddleware,isSuperAdminMiddleware,async(_req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");res.set("Vary","Authorization");
  try{res.json({items:await readCommercialLaunchVerificationHistory(pool,10)});}catch{res.status(503).json({code:"COMMERCIAL_VERIFICATION_HISTORY_UNAVAILABLE",error:"Commercial verification history is temporarily unavailable."});}
});

router.get("/admin/commercial-launch/authorization",authMiddleware,isSuperAdminMiddleware,async(_req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");res.set("Vary","Authorization");
  try{const receipt=await readLatestCommercialLaunchVerification(pool);res.json(deriveCommercialLaunchAuthorization({sourceCommit:resolveReleaseMetadata(process.env).sourceCommit,receipt}));}catch{res.status(503).json({code:"COMMERCIAL_LAUNCH_AUTHORIZATION_UNAVAILABLE",error:"Commercial launch authorization is temporarily unavailable."});}
});

router.get("/admin/commercial-launch/dossier",authMiddleware,isSuperAdminMiddleware,async(_req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");res.set("Vary","Authorization");
  try{
    const sourceCommit=resolveReleaseMetadata(process.env).sourceCommit;
    const profile=deriveCommercialLaunchProfile(process.env),services=deriveCommercialLaunchActivation(process.env);
    const receipt=await readLatestCommercialLaunchVerification(pool),authorization=deriveCommercialLaunchAuthorization({sourceCommit,receipt});
    const dossier=deriveCommercialLaunchDossier({sourceCommit,profile,serviceReady:services.ready,serviceBlockerCount:services.requiredActionCount,verificationReady:authorization.ready});
    res.json({...dossier,profile,missingConfigurationKeys:commercialLaunchProfileConfigurationKeys(profile.missingFields),services:{status:services.status,providerMode:services.providerMode,requiredActionCount:services.requiredActionCount},authorization:{status:authorization.status,ready:authorization.ready}});
  }catch{res.status(503).json({code:"COMMERCIAL_LAUNCH_DOSSIER_UNAVAILABLE",error:"Commercial launch dossier is temporarily unavailable."});}
});

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
    const commercialAuthority=await readPersistentCommercialAuthority(pool,company.id);
    const rawStatus=commercialAuthority?.subscription.status;
    const subscriptionStatus=(rawStatus===undefined?"not_configured":rawStatus) as CommercialSubscriptionStatus;
    if(!["not_configured","pending","trialing","active","past_due","suspended","canceling"].includes(subscriptionStatus))throw new Error("Commercial subscription status is invalid");
    const preparedSubscription=commercialAuthority?{subscriptionId:String(commercialAuthority.subscription.id),plan:commercialAuthority.subscription.plan_code,billingCycle:commercialAuthority.subscription.billing_cycle,seatQuantity:commercialAuthority.subscription.seat_quantity}:null;
    const providerCustomerBound=Boolean(commercialAuthority?.providerBindings.some(row=>row.provider==="stripe"&&row.status==="active"&&typeof row.customer_reference==="string"&&row.customer_reference.startsWith("cus_")));
    res.json({...deriveCommercialRuntimeWorkspace({companyId:company.id,companyName:company.name,memberCount:Number(members?.count??0),commercialAccess:access.any,subscriptionStatus,catalogConfigured:platform.subscriptionConfigured,billingIdentityComplete:Boolean(company.address?.trim()&&company.phone?.trim()),...platform,platformChecks:platform.checks}),preparedSubscription,providerCustomerBound,billingAuthority:{canManageBilling:billingAuthority.canManageBilling,role:billingAuthority.role}});
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

router.post("/commercial/subscription-setup",authMiddleware,async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");
  try{
    const actor=req.user!,authority=await resolveCommercialBillingAuthority(pool,{userId:actor.userId,companyId:actor.companyId});requireCommercialBillingManager(authority);
    const [identity]=await db.select({companyName:companiesTable.name,billingEmail:usersTable.email}).from(companiesTable).innerJoin(usersTable,eq(usersTable.id,actor.userId)).where(eq(companiesTable.id,actor.companyId)).limit(1);
    if(!identity)throw new Error("Company billing identity is unavailable");
    const result=await prepareCompanySubscription({client:pool,environment:process.env,companyId:actor.companyId,userId:actor.userId,companyName:identity.companyName,billingEmail:identity.billingEmail,requestKey:String(req.body?.requestKey??"").trim(),plan:req.body?.plan,cycle:req.body?.cycle});
    res.status(result.replayed?200:201).json(result);
  }catch(error){const message=error instanceof Error?error.message:"Subscription setup unavailable",denied=/administrator authority/.test(message),invalid=/request identity|offer is invalid|supported checkout/.test(message);res.status(denied?403:invalid?400:503).json({code:denied?"BILLING_AUTHORITY_REQUIRED":invalid?"SUBSCRIPTION_SETUP_INVALID":"SUBSCRIPTION_SETUP_UNAVAILABLE",error:message});}
});

router.post("/commercial/billing-portal",authMiddleware,async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");
  try{
    const actor=req.user!,authority=await resolveCommercialBillingAuthority(pool,{userId:actor.userId,companyId:actor.companyId});requireCommercialBillingManager(authority);
    res.status(201).json(await startCommercialBillingPortal({client:pool,environment:process.env,companyId:actor.companyId,userId:actor.userId}));
  }catch(error){const message=error instanceof Error?error.message:"Billing self-service unavailable";const denied=/administrator authority/.test(message);res.status(denied?403:503).json({code:denied?"BILLING_AUTHORITY_REQUIRED":"BILLING_PORTAL_UNAVAILABLE",error:message});}
});

router.get("/commercial/billing-history",authMiddleware,async(req,res)=>{
  res.set("Cache-Control","private, no-store, max-age=0");
  res.set("Vary","Authorization");
  try{
    const actor=req.user!,authority=await resolveCommercialBillingAuthority(pool,{userId:actor.userId,companyId:actor.companyId});requireCommercialBillingManager(authority);
    res.json(await readCustomerBillingHistory(pool,actor.companyId,parseBillingHistoryQuery(req.query)));
  }catch(error){
    const message=error instanceof Error?error.message:"Billing history unavailable",denied=/administrator authority/.test(message),invalid=/Billing (status|page|page size)|Duplicate billing query/.test(message);
    res.status(denied?403:invalid?400:503).json({code:denied?"BILLING_AUTHORITY_REQUIRED":invalid?"BILLING_HISTORY_QUERY_INVALID":"BILLING_HISTORY_UNAVAILABLE",error:message});
  }
});

export default router;
