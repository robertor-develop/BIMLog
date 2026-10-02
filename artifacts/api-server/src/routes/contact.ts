import { Router } from "express";
import { db } from "@workspace/db";
import { contactSubmissionsTable } from "@workspace/db/schema";
import {eq} from "drizzle-orm";
import {parseSalesInquiryInput,salesInquiryFingerprint} from "../lib/commercial-sales-inquiry";

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

export default router;
