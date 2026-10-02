import { Router } from "express";
import { db } from "@workspace/db";
import { contactSubmissionsTable } from "@workspace/db/schema";
import {and,desc,eq} from "drizzle-orm";
import {parseSalesInquiryInput,salesInquiryFingerprint} from "../lib/commercial-sales-inquiry";
import {authMiddleware,isSuperAdminMiddleware} from "../middlewares/auth";
import {assertSalesInquiryTransition,SALES_INQUIRY_STATUSES} from "../lib/sales-inquiry-operations";

const router = Router();

router.post("/contact", async (req, res) => {
  try {
    const input=parseSalesInquiryInput(req.body);
    const fingerprint=salesInquiryFingerprint(input);
    try{
      const [created]=await db.insert(contactSubmissionsTable).values({...input,fingerprint,status:"new"}).returning({id:contactSubmissionsTable.id,status:contactSubmissionsTable.status});
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
  const status=typeof req.query.status==="string"?req.query.status:"";
  if(status&&!SALES_INQUIRY_STATUSES.includes(status as never)){res.status(400).json({code:"SALES_INQUIRY_STATUS_INVALID"});return;}
  const requested=Number(req.query.limit??50);
  const limit=Number.isSafeInteger(requested)&&requested>0?Math.min(requested,100):50;
  const fields={id:contactSubmissionsTable.id,fullName:contactSubmissionsTable.fullName,email:contactSubmissionsTable.email,companyName:contactSubmissionsTable.companyName,country:contactSubmissionsTable.country,interest:contactSubmissionsTable.interest,message:contactSubmissionsTable.message,plan:contactSubmissionsTable.plan,billingCycle:contactSubmissionsTable.billingCycle,useCase:contactSubmissionsTable.useCase,status:contactSubmissionsTable.status,createdAt:contactSubmissionsTable.createdAt,updatedAt:contactSubmissionsTable.updatedAt};
  const rows=await db.select(fields).from(contactSubmissionsTable).where(status?eq(contactSubmissionsTable.status,status):undefined).orderBy(desc(contactSubmissionsTable.createdAt)).limit(limit);
  res.set("Cache-Control","private, no-store, max-age=0");
  res.json({items:rows,limit});
});

router.patch("/admin/sales-inquiries/:id/status",authMiddleware,isSuperAdminMiddleware,async(req,res)=>{
  const id=Number(req.params.id),expectedStatus=req.body?.expectedStatus,nextStatus=req.body?.status;
  if(!Number.isSafeInteger(id)||id<1){res.status(400).json({code:"SALES_INQUIRY_ID_INVALID"});return;}
  try{assertSalesInquiryTransition(expectedStatus,nextStatus);}catch{res.status(400).json({code:"SALES_INQUIRY_TRANSITION_INVALID"});return;}
  const [updated]=await db.update(contactSubmissionsTable).set({status:nextStatus,updatedAt:new Date()}).where(and(eq(contactSubmissionsTable.id,id),eq(contactSubmissionsTable.status,expectedStatus))).returning({id:contactSubmissionsTable.id,status:contactSubmissionsTable.status,updatedAt:contactSubmissionsTable.updatedAt});
  if(!updated){res.status(409).json({code:"SALES_INQUIRY_STALE_OR_MISSING"});return;}
  res.json(updated);
});

export default router;
