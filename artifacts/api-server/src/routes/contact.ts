import { Router } from "express";
import { db } from "@workspace/db";
import { contactSubmissionsTable,salesInquiryAssignmentEventsTable,salesInquiryFollowUpsTable,usersTable } from "@workspace/db/schema";
import {and,count,desc,eq,ilike,isNull,lt,ne,or} from "drizzle-orm";
import {parseSalesInquiryInput,salesInquiryFingerprint} from "../lib/commercial-sales-inquiry";
import {authMiddleware,isSuperAdminMiddleware} from "../middlewares/auth";
import {assertSalesInquiryTransition} from "../lib/sales-inquiry-operations";
import {parseSalesInquiryListQuery} from "../lib/sales-inquiry-query";
import {salesInquiryResponseDueAt} from "../lib/sales-inquiry-response";
import {canChangeSalesInquiryAssignment,parseSalesInquiryAssignment} from "../lib/sales-inquiry-assignment";
import {parseSalesInquiryAssignmentHistoryQuery} from "../lib/sales-inquiry-assignment-history";
import {parseSalesInquiryFollowUp} from "../lib/sales-inquiry-follow-up";
import {alias} from "drizzle-orm/pg-core";

const router = Router();

router.post("/contact", async (req, res) => {
  try {
    const input=parseSalesInquiryInput(req.body);
    const fingerprint=salesInquiryFingerprint(input);
    try{
      const receivedAt=new Date();
      const [created]=await db.insert(contactSubmissionsTable).values({...input,fingerprint,status:"new",createdAt:receivedAt,updatedAt:receivedAt,responseDueAt:salesInquiryResponseDueAt(receivedAt)}).returning({id:contactSubmissionsTable.id,status:contactSubmissionsTable.status});
      res.status(201).json({success:true,inquiryId:created.id,status:created.status,replayed:false});
    }catch(error){
      if((error as {code?:unknown})?.code!=="23505")throw error;
      const [existing]=await db.select({id:contactSubmissionsTable.id,fingerprint:contactSubmissionsTable.fingerprint,status:contactSubmissionsTable.status}).from(contactSubmissionsTable).where(eq(contactSubmissionsTable.requestKey,input.requestKey)).limit(1);
      if(!existing||existing.fingerprint!==fingerprint){res.status(409).json({code:"SALES_INQUIRY_REQUEST_CONFLICT",error:"This inquiry request identity was already used for different information."});return;}
      res.json({success:true,inquiryId:existing.id,status:existing.status,replayed:true});
    }
  } catch (error) {
    if(error instanceof Error&&/is required|is invalid|not accepted/.test(error.message)){res.status(400).json({code:"SALES_INQUIRY_INVALID",error:error.message});return;}
    res.status(503).json({code:"SALES_INQUIRY_UNAVAILABLE",error:"Your inquiry could not be saved right now. Please try again."});
  }
});

router.get("/admin/sales-inquiries",authMiddleware,isSuperAdminMiddleware,async(req,res)=>{
  let query;
  try{query=parseSalesInquiryListQuery(req.query as Record<string,unknown>);}catch(error){res.status(400).json({code:error instanceof Error?error.message:"SALES_INQUIRY_QUERY_INVALID"});return;}
  const filters=[];
  if(query.status)filters.push(eq(contactSubmissionsTable.status,query.status));
  if(query.search){const term=`%${query.search}%`;filters.push(or(ilike(contactSubmissionsTable.fullName,term),ilike(contactSubmissionsTable.email,term),ilike(contactSubmissionsTable.companyName,term),ilike(contactSubmissionsTable.country,term),ilike(contactSubmissionsTable.interest,term))!);}
  if(query.overdue)filters.push(and(ne(contactSubmissionsTable.status,"closed"),lt(contactSubmissionsTable.responseDueAt,new Date()))!);
  if(query.assignment==="mine")filters.push(eq(contactSubmissionsTable.assignedToUserId,req.user!.userId));
  if(query.assignment==="unassigned")filters.push(isNull(contactSubmissionsTable.assignedToUserId));
  const where=filters.length?and(...filters):undefined;
  const fields={id:contactSubmissionsTable.id,fullName:contactSubmissionsTable.fullName,email:contactSubmissionsTable.email,companyName:contactSubmissionsTable.companyName,country:contactSubmissionsTable.country,interest:contactSubmissionsTable.interest,message:contactSubmissionsTable.message,plan:contactSubmissionsTable.plan,billingCycle:contactSubmissionsTable.billingCycle,useCase:contactSubmissionsTable.useCase,status:contactSubmissionsTable.status,responseDueAt:contactSubmissionsTable.responseDueAt,assignedToUserId:contactSubmissionsTable.assignedToUserId,assignedToName:usersTable.fullName,assignedAt:contactSubmissionsTable.assignedAt,createdAt:contactSubmissionsTable.createdAt,updatedAt:contactSubmissionsTable.updatedAt};
  const [selectedRows,totalRows]=await Promise.all([db.select(fields).from(contactSubmissionsTable).leftJoin(usersTable,eq(usersTable.id,contactSubmissionsTable.assignedToUserId)).where(where).orderBy(desc(contactSubmissionsTable.createdAt),desc(contactSubmissionsTable.id)).limit(query.limit).offset(query.offset),db.select({total:count()}).from(contactSubmissionsTable).where(where)]);
  const rows=selectedRows.map(row=>({...row,assignedToCurrentUser:row.assignedToUserId===req.user!.userId}));
  res.set("Cache-Control","private, no-store, max-age=0");
  res.json({items:rows,limit:query.limit,offset:query.offset,total:Number(totalRows[0]?.total??0)});
});

router.patch("/admin/sales-inquiries/:id/status",authMiddleware,isSuperAdminMiddleware,async(req,res)=>{
  const id=Number(req.params.id),expectedStatus=req.body?.expectedStatus,nextStatus=req.body?.status;
  if(!Number.isSafeInteger(id)||id<1){res.status(400).json({code:"SALES_INQUIRY_ID_INVALID"});return;}
  try{assertSalesInquiryTransition(expectedStatus,nextStatus);}catch{res.status(400).json({code:"SALES_INQUIRY_TRANSITION_INVALID"});return;}
  const [updated]=await db.update(contactSubmissionsTable).set({status:nextStatus,updatedAt:new Date()}).where(and(eq(contactSubmissionsTable.id,id),eq(contactSubmissionsTable.status,expectedStatus))).returning({id:contactSubmissionsTable.id,status:contactSubmissionsTable.status,updatedAt:contactSubmissionsTable.updatedAt});
  if(!updated){res.status(409).json({code:"SALES_INQUIRY_STALE_OR_MISSING"});return;}
  res.json(updated);
});

router.patch("/admin/sales-inquiries/:id/assignment",authMiddleware,isSuperAdminMiddleware,async(req,res)=>{
  const id=Number(req.params.id),actorId=req.user!.userId;
  if(!Number.isSafeInteger(id)||id<1){res.status(400).json({code:"SALES_INQUIRY_ID_INVALID"});return;}
  let input;
  try{input=parseSalesInquiryAssignment(req.body);}catch{res.status(400).json({code:"SALES_INQUIRY_ASSIGNMENT_INVALID"});return;}
  const updated=await db.transaction(async tx=>{
    const [current]=await tx.select({assignedToUserId:contactSubmissionsTable.assignedToUserId,updatedAt:contactSubmissionsTable.updatedAt}).from(contactSubmissionsTable).where(eq(contactSubmissionsTable.id,id)).for("update").limit(1);
    if(!current||current.updatedAt.getTime()!==input.expectedUpdatedAt.getTime())return null;
    if(!canChangeSalesInquiryAssignment(current.assignedToUserId,actorId,input.assigned))return "conflict" as const;
    const now=new Date(),nextAssigneeUserId=input.assigned?actorId:null;
    const [changed]=await tx.update(contactSubmissionsTable).set({assignedToUserId:nextAssigneeUserId,assignedAt:input.assigned?now:null,updatedAt:now}).where(and(eq(contactSubmissionsTable.id,id),eq(contactSubmissionsTable.updatedAt,input.expectedUpdatedAt))).returning({id:contactSubmissionsTable.id,assignedToUserId:contactSubmissionsTable.assignedToUserId,assignedAt:contactSubmissionsTable.assignedAt,updatedAt:contactSubmissionsTable.updatedAt});
    if(!changed)return null;
    await tx.insert(salesInquiryAssignmentEventsTable).values({inquiryId:id,actorUserId:actorId,previousAssigneeUserId:current.assignedToUserId,nextAssigneeUserId,action:input.assigned?"assigned":"released",createdAt:now});
    return changed;
  });
  if(updated==="conflict"){res.status(409).json({code:"SALES_INQUIRY_ASSIGNMENT_CONFLICT"});return;}
  if(!updated){res.status(409).json({code:"SALES_INQUIRY_STALE_OR_MISSING"});return;}
  res.json(updated);
});

router.get("/admin/sales-inquiries/:id/assignment-history",authMiddleware,isSuperAdminMiddleware,async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1){res.status(400).json({code:"SALES_INQUIRY_ID_INVALID"});return;}
  let query;
  try{query=parseSalesInquiryAssignmentHistoryQuery(req.query as Record<string,unknown>);}catch{res.status(400).json({code:"SALES_INQUIRY_HISTORY_QUERY_INVALID"});return;}
  const actor=alias(usersTable,"assignment_actor"),previousOwner=alias(usersTable,"previous_assignment_owner"),nextOwner=alias(usersTable,"next_assignment_owner");
  const [inquiry,items,totalRows]=await Promise.all([
    db.select({id:contactSubmissionsTable.id}).from(contactSubmissionsTable).where(eq(contactSubmissionsTable.id,id)).limit(1),
    db.select({id:salesInquiryAssignmentEventsTable.id,action:salesInquiryAssignmentEventsTable.action,actorUserId:salesInquiryAssignmentEventsTable.actorUserId,actorName:actor.fullName,previousAssigneeUserId:salesInquiryAssignmentEventsTable.previousAssigneeUserId,previousAssigneeName:previousOwner.fullName,nextAssigneeUserId:salesInquiryAssignmentEventsTable.nextAssigneeUserId,nextAssigneeName:nextOwner.fullName,createdAt:salesInquiryAssignmentEventsTable.createdAt}).from(salesInquiryAssignmentEventsTable).innerJoin(actor,eq(actor.id,salesInquiryAssignmentEventsTable.actorUserId)).leftJoin(previousOwner,eq(previousOwner.id,salesInquiryAssignmentEventsTable.previousAssigneeUserId)).leftJoin(nextOwner,eq(nextOwner.id,salesInquiryAssignmentEventsTable.nextAssigneeUserId)).where(eq(salesInquiryAssignmentEventsTable.inquiryId,id)).orderBy(desc(salesInquiryAssignmentEventsTable.createdAt),desc(salesInquiryAssignmentEventsTable.id)).limit(query.limit).offset(query.offset),
    db.select({total:count()}).from(salesInquiryAssignmentEventsTable).where(eq(salesInquiryAssignmentEventsTable.inquiryId,id)),
  ]);
  if(!inquiry.length){res.status(404).json({code:"SALES_INQUIRY_NOT_FOUND"});return;}
  res.set("Cache-Control","private, no-store, max-age=0");
  res.json({items,limit:query.limit,offset:query.offset,total:Number(totalRows[0]?.total??0)});
});

router.get("/admin/sales-inquiries/:id/follow-ups",authMiddleware,isSuperAdminMiddleware,async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1){res.status(400).json({code:"SALES_INQUIRY_ID_INVALID"});return;}
  let query;try{query=parseSalesInquiryAssignmentHistoryQuery(req.query as Record<string,unknown>);}catch{res.status(400).json({code:"SALES_INQUIRY_FOLLOW_UP_QUERY_INVALID"});return;}
  const [inquiry,items,totalRows]=await Promise.all([db.select({id:contactSubmissionsTable.id}).from(contactSubmissionsTable).where(eq(contactSubmissionsTable.id,id)).limit(1),db.select({id:salesInquiryFollowUpsTable.id,actorUserId:salesInquiryFollowUpsTable.actorUserId,actorName:usersTable.fullName,note:salesInquiryFollowUpsTable.note,createdAt:salesInquiryFollowUpsTable.createdAt}).from(salesInquiryFollowUpsTable).innerJoin(usersTable,eq(usersTable.id,salesInquiryFollowUpsTable.actorUserId)).where(eq(salesInquiryFollowUpsTable.inquiryId,id)).orderBy(desc(salesInquiryFollowUpsTable.createdAt),desc(salesInquiryFollowUpsTable.id)).limit(query.limit).offset(query.offset),db.select({total:count()}).from(salesInquiryFollowUpsTable).where(eq(salesInquiryFollowUpsTable.inquiryId,id))]);
  if(!inquiry.length){res.status(404).json({code:"SALES_INQUIRY_NOT_FOUND"});return;}res.set("Cache-Control","private, no-store, max-age=0");res.json({items,limit:query.limit,offset:query.offset,total:Number(totalRows[0]?.total??0)});
});

router.post("/admin/sales-inquiries/:id/follow-ups",authMiddleware,isSuperAdminMiddleware,async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isSafeInteger(id)||id<1){res.status(400).json({code:"SALES_INQUIRY_ID_INVALID"});return;}let input;try{input=parseSalesInquiryFollowUp(req.body);}catch{res.status(400).json({code:"SALES_INQUIRY_FOLLOW_UP_INVALID"});return;}
  const created=await db.transaction(async tx=>{const [current]=await tx.select({updatedAt:contactSubmissionsTable.updatedAt}).from(contactSubmissionsTable).where(eq(contactSubmissionsTable.id,id)).for("update").limit(1);if(!current||current.updatedAt.getTime()!==input.expectedUpdatedAt.getTime())return null;const now=new Date();const [event]=await tx.insert(salesInquiryFollowUpsTable).values({inquiryId:id,actorUserId:req.user!.userId,note:input.note,createdAt:now}).returning({id:salesInquiryFollowUpsTable.id,note:salesInquiryFollowUpsTable.note,createdAt:salesInquiryFollowUpsTable.createdAt});await tx.update(contactSubmissionsTable).set({updatedAt:now}).where(eq(contactSubmissionsTable.id,id));return {...event,updatedAt:now};});
  if(!created){res.status(409).json({code:"SALES_INQUIRY_STALE_OR_MISSING"});return;}res.status(201).json(created);
});

export default router;
