import {Router,type IRouter} from "express";
import {and,eq} from "drizzle-orm";
import {db} from "@workspace/db";
import {companiesTable,notificationsTable,supportCaseDataRequestFulfillmentsTable,supportCaseDataRequestReviewsTable,supportCasesTable,usersTable} from "@workspace/db/schema";
import {authMiddleware,isSuperAdminMiddleware} from "../middlewares/auth";
import {dataRequestFulfillmentFingerprint,parseDataRequestFulfillment} from "../lib/commercial-data-request-fulfillment";
import {supportNotification} from "../lib/support-case-notification";
import {createCustomerDataExport} from "../lib/commercial-data-export";

const router:IRouter=Router();
router.post("/admin/support/cases/:id/data-request/fulfillment",authMiddleware,isSuperAdminMiddleware,async(req,res)=>{
  const id=Number(req.params.id),actorId=req.user!.userId;
  if(!Number.isSafeInteger(id)||id<1){res.status(400).json({code:"SUPPORT_CASE_ID_INVALID"});return;}
  let input;try{input=parseDataRequestFulfillment(req.body);}catch{res.status(400).json({code:"DATA_REQUEST_FULFILLMENT_INVALID"});return;}
  const now=new Date(),fingerprint=dataRequestFulfillmentFingerprint(input),result=await db.transaction(async tx=>{
    const [current]=await tx.select({category:supportCasesTable.category,dataRequestKind:supportCasesTable.dataRequestKind,dataRequestState:supportCasesTable.dataRequestState,assignedToUserId:supportCasesTable.assignedToUserId,requesterUserId:supportCasesTable.requesterUserId,subject:supportCasesTable.subject,updatedAt:supportCasesTable.updatedAt}).from(supportCasesTable).where(eq(supportCasesTable.id,id)).for("update").limit(1);
    if(!current)return "missing" as const;
    if(current.category!=="data"||current.dataRequestKind!==input.kind)return "kind" as const;
    if(current.assignedToUserId!==actorId)return "owner" as const;
    if(current.dataRequestState==="fulfilled"){
      const [existing]=await tx.select({actorUserId:supportCaseDataRequestFulfillmentsTable.actorUserId,receiptReference:supportCaseDataRequestFulfillmentsTable.receiptReference,summary:supportCaseDataRequestFulfillmentsTable.summary,fingerprint:supportCaseDataRequestFulfillmentsTable.fingerprint,createdAt:supportCaseDataRequestFulfillmentsTable.createdAt}).from(supportCaseDataRequestFulfillmentsTable).where(eq(supportCaseDataRequestFulfillmentsTable.supportCaseId,id)).limit(1);
      return existing?.actorUserId===actorId&&existing.fingerprint===fingerprint?{id,dataRequestKind:input.kind,dataRequestState:"fulfilled" as const,dataRequestReason:existing.summary,dataRequestReviewedAt:existing.createdAt,dataRequestFulfilledAt:existing.createdAt,updatedAt:current.updatedAt,receiptReference:existing.receiptReference,replayed:true}:"conflict" as const;
    }
    if(current.dataRequestState!==input.expectedState||current.updatedAt.getTime()!==input.expectedUpdatedAt.getTime())return "stale" as const;
    const [updated]=await tx.update(supportCasesTable).set({dataRequestState:"fulfilled",dataRequestReason:input.summary,dataRequestReviewedByUserId:actorId,dataRequestReviewedAt:now,dataRequestFulfilledAt:now,updatedAt:now}).where(and(eq(supportCasesTable.id,id),eq(supportCasesTable.updatedAt,input.expectedUpdatedAt))).returning({id:supportCasesTable.id,dataRequestKind:supportCasesTable.dataRequestKind,dataRequestState:supportCasesTable.dataRequestState,dataRequestReason:supportCasesTable.dataRequestReason,dataRequestReviewedAt:supportCasesTable.dataRequestReviewedAt,dataRequestFulfilledAt:supportCasesTable.dataRequestFulfilledAt,updatedAt:supportCasesTable.updatedAt});
    if(!updated)return "stale" as const;
    await tx.insert(supportCaseDataRequestFulfillmentsTable).values({supportCaseId:id,actorUserId:actorId,kind:input.kind,decisionState:input.expectedState,receiptReference:input.receiptReference,summary:input.summary,fingerprint,createdAt:now});
    await tx.insert(supportCaseDataRequestReviewsTable).values({supportCaseId:id,actorUserId:actorId,fromState:input.expectedState,toState:"fulfilled",reason:input.summary,fingerprint,createdAt:now});
    const notice=supportNotification("data_request_fulfilled",id,current.subject,"fulfilled");
    await tx.insert(notificationsTable).values({userId:current.requesterUserId,projectId:null,...notice,isRead:false});
    return {...updated,receiptReference:input.receiptReference,replayed:false};
  });
  if(result==="missing"){res.status(404).json({code:"SUPPORT_CASE_NOT_FOUND"});return;}
  if(result==="kind"){res.status(409).json({code:"DATA_REQUEST_KIND_MISMATCH"});return;}
  if(result==="owner"){res.status(409).json({code:"SUPPORT_CASE_NOT_ASSIGNED_TO_ACTOR"});return;}
  if(result==="stale"){res.status(409).json({code:"DATA_REQUEST_FULFILLMENT_STALE"});return;}
  if(result==="conflict"){res.status(409).json({code:"DATA_REQUEST_FULFILLMENT_CONFLICT"});return;}
  res.set("Cache-Control","private, no-store, max-age=0");res.status(result.replayed?200:201).json(result);
});

const receiptProjection={receiptReference:supportCaseDataRequestFulfillmentsTable.receiptReference,summary:supportCaseDataRequestFulfillmentsTable.summary,decisionState:supportCaseDataRequestFulfillmentsTable.decisionState,fulfilledAt:supportCaseDataRequestFulfillmentsTable.createdAt};
router.get("/support/cases/:id/data-request/fulfillment",authMiddleware,async(req,res)=>{const id=Number(req.params.id),actor=req.user!;if(!Number.isSafeInteger(id)||id<1){res.status(400).json({code:"SUPPORT_CASE_ID_INVALID"});return;}const [item]=await db.select(receiptProjection).from(supportCaseDataRequestFulfillmentsTable).innerJoin(supportCasesTable,eq(supportCasesTable.id,supportCaseDataRequestFulfillmentsTable.supportCaseId)).where(and(eq(supportCasesTable.id,id),eq(supportCasesTable.companyId,actor.companyId),eq(supportCasesTable.requesterUserId,actor.userId))).limit(1);if(!item){res.status(404).json({code:"DATA_REQUEST_FULFILLMENT_NOT_FOUND"});return;}res.set("Cache-Control","private, no-store, max-age=0");res.json({item});});
router.get("/support/cases/:id/data-request/export",authMiddleware,async(req,res)=>{const id=Number(req.params.id),actor=req.user!;if(!Number.isSafeInteger(id)||id<1){res.status(400).json({code:"SUPPORT_CASE_ID_INVALID"});return;}const [item]=await db.select({requestId:supportCasesTable.id,kind:supportCasesTable.dataRequestKind,state:supportCasesTable.dataRequestState,requestedAt:supportCasesTable.createdAt,fulfilledAt:supportCasesTable.dataRequestFulfilledAt,customerId:usersTable.id,customerEmail:usersTable.email,customerName:usersTable.fullName,customerJobTitle:usersTable.jobTitle,customerPhone:usersTable.phone,customerCreatedAt:usersTable.createdAt,companyId:companiesTable.id,companyName:companiesTable.name,companyWebsite:companiesTable.website,companyAddress:companiesTable.address,companyPhone:companiesTable.phone,companyIndustry:companiesTable.industry,companyType:companiesTable.companyType,companyCreatedAt:companiesTable.createdAt}).from(supportCasesTable).innerJoin(usersTable,eq(usersTable.id,supportCasesTable.requesterUserId)).innerJoin(companiesTable,eq(companiesTable.id,supportCasesTable.companyId)).where(and(eq(supportCasesTable.id,id),eq(supportCasesTable.companyId,actor.companyId),eq(supportCasesTable.requesterUserId,actor.userId),eq(supportCasesTable.dataRequestKind,"export"),eq(supportCasesTable.dataRequestState,"fulfilled"))).limit(1);if(!item||!item.fulfilledAt){res.status(404).json({code:"DATA_REQUEST_EXPORT_NOT_AVAILABLE"});return;}const artifact=createCustomerDataExport({request:{id:item.requestId,kind:"export",state:"fulfilled",requestedAt:item.requestedAt,fulfilledAt:item.fulfilledAt},customer:{id:item.customerId,email:item.customerEmail,fullName:item.customerName,jobTitle:item.customerJobTitle,phone:item.customerPhone,createdAt:item.customerCreatedAt},company:{id:item.companyId,name:item.companyName,website:item.companyWebsite,address:item.companyAddress,phone:item.companyPhone,industry:item.companyIndustry,companyType:item.companyType,createdAt:item.companyCreatedAt}});res.set({"Cache-Control":"private, no-store, max-age=0","Content-Disposition":`attachment; filename="bimlog-data-export-${id}.json"`,"Content-Length":String(artifact.body.byteLength),"X-Content-Type-Options":"nosniff","X-BIMLog-Content-SHA256":artifact.sha256});res.type("application/json").send(artifact.body);});
router.get("/admin/support/cases/:id/data-request/fulfillment",authMiddleware,isSuperAdminMiddleware,async(req,res)=>{const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1){res.status(400).json({code:"SUPPORT_CASE_ID_INVALID"});return;}const [item]=await db.select(receiptProjection).from(supportCaseDataRequestFulfillmentsTable).where(eq(supportCaseDataRequestFulfillmentsTable.supportCaseId,id)).limit(1);if(!item){res.status(404).json({code:"DATA_REQUEST_FULFILLMENT_NOT_FOUND"});return;}res.set("Cache-Control","private, no-store, max-age=0");res.json({item});});
export default router;
