import { Router, type IRouter } from "express";
import { createHash, randomBytes } from "node:crypto";
import { pool } from "@workspace/db";
import { authMiddleware } from "../middlewares/auth";
import { getAppUrl, sendEmail } from "../lib/email";
import { waitForOnboardingMigration } from "../lib/onboarding-migration";

const router: IRouter = Router();
const profiles = new Set(["bim_coordinator","project_admin","document_controller","designer","field_team","executive"]);
const disciplines = new Set(["Architecture","Structural","Mechanical","Electrical","Plumbing","Fire Protection","Civil"]);
const documents = new Set(["Shop Drawings","Coordination Drawings","Clash Reports","RFIs","Submittals"]);
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function ensureProfile(userId: number, companyId: number) {
  await pool.query(`INSERT INTO user_onboarding_profiles(user_id,company_id) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING`,[userId,companyId]);
}

router.get("/onboarding", authMiddleware, async (req,res) => {
  await waitForOnboardingMigration();
  await ensureProfile(req.user!.userId,req.user!.companyId);
  const result=await pool.query(`SELECT p.*,u.email,c.name company_name,(SELECT count(*)::int FROM project_members WHERE user_id=p.user_id) project_count FROM user_onboarding_profiles p JOIN users u ON u.id=p.user_id JOIN companies c ON c.id=p.company_id WHERE p.user_id=$1`,[req.user!.userId]);
  const row=result.rows[0];
  res.json({email:row.email,companyName:row.company_name,emailVerifiedAt:row.email_verified_at,workProfile:row.work_profile,preferredDisciplines:row.preferred_disciplines,preferredDocumentTypes:row.preferred_document_types,completedSteps:row.completed_steps,completedAt:row.completed_at,projectCount:row.project_count});
});

router.post("/onboarding/email-verification", authMiddleware, async (req,res) => {
  await waitForOnboardingMigration();
  await ensureProfile(req.user!.userId,req.user!.companyId);
  const current=await pool.query(`SELECT email_verified_at FROM user_onboarding_profiles WHERE user_id=$1`,[req.user!.userId]);
  if(current.rows[0]?.email_verified_at){res.json({status:"already_verified"});return;}
  const token=randomBytes(32).toString("base64url"),tokenHash=hash(token),expires=new Date(Date.now()+24*60*60*1000);
  await pool.query(`WITH removed AS (DELETE FROM email_verification_tokens WHERE user_id=$1 AND consumed_at IS NULL) INSERT INTO email_verification_tokens(token_hash,user_id,expires_at) VALUES($2,$1,$3)`,[req.user!.userId,tokenHash,expires]);
  const url=`${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;
  const delivery=await sendEmail({to:req.user!.email,subject:"Verify your BIMLog email",triggerType:"onboarding_email_verification",html:`<p>Confirm this email address to finish setting up BIMLog.</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`});
  if(delivery!=="sent"){
    res.status(delivery==="skipped"?503:502).json({error:delivery==="skipped"?"EMAIL_DELIVERY_NOT_CONFIGURED":"EMAIL_DELIVERY_FAILED",status:delivery});
    return;
  }
  res.status(202).json({status:delivery,expiresAt:expires.toISOString()});
});

router.post("/onboarding/email-verification/confirm", async (req,res) => {
  await waitForOnboardingMigration();
  const token=typeof req.body?.token==="string"?req.body.token:"";
  if(token.length<32){res.status(400).json({error:"EMAIL_VERIFICATION_INVALID"});return;}
  const client=await pool.connect();
  try {
    await client.query("BEGIN");
    const result=await client.query(`SELECT user_id,expires_at,consumed_at FROM email_verification_tokens WHERE token_hash=$1 FOR UPDATE`,[hash(token)]);
    const row=result.rows[0];
    if(!row||row.consumed_at||new Date(row.expires_at)<=new Date()){await client.query("ROLLBACK");res.status(409).json({error:"EMAIL_VERIFICATION_EXPIRED"});return;}
    await client.query(`UPDATE email_verification_tokens SET consumed_at=now() WHERE token_hash=$1`,[hash(token)]);
    await client.query(`UPDATE user_onboarding_profiles SET email_verified_at=COALESCE(email_verified_at,now()),completed_steps=(SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements_text(completed_steps||'["email"]'::jsonb)),updated_at=now() WHERE user_id=$1`,[row.user_id]);
    await client.query("COMMIT");
    res.json({verified:true});
  } catch(error){await client.query("ROLLBACK");throw error;} finally {client.release();}
});

router.patch("/onboarding", authMiddleware, async (req,res) => {
  await waitForOnboardingMigration();
  await ensureProfile(req.user!.userId,req.user!.companyId);
  const role=typeof req.body?.workProfile==="string"?req.body.workProfile:null;
  const preferredDisciplines=Array.isArray(req.body?.preferredDisciplines)?req.body.preferredDisciplines.filter((v:unknown)=>typeof v==="string"&&disciplines.has(v)).slice(0,7):null;
  const preferredDocumentTypes=Array.isArray(req.body?.preferredDocumentTypes)?req.body.preferredDocumentTypes.filter((v:unknown)=>typeof v==="string"&&documents.has(v)).slice(0,5):null;
  if(role!==null&&!profiles.has(role)){res.status(400).json({error:"WORK_PROFILE_INVALID"});return;}
  await pool.query(`UPDATE user_onboarding_profiles SET work_profile=COALESCE($2,work_profile),preferred_disciplines=COALESCE($3::jsonb,preferred_disciplines),preferred_document_types=COALESCE($4::jsonb,preferred_document_types),completed_steps=CASE WHEN $2::text IS NULL THEN completed_steps ELSE (SELECT jsonb_agg(DISTINCT value) FROM jsonb_array_elements_text(completed_steps||'["profile"]'::jsonb)) END,updated_at=now() WHERE user_id=$1`,[req.user!.userId,role,preferredDisciplines?JSON.stringify(preferredDisciplines):null,preferredDocumentTypes?JSON.stringify(preferredDocumentTypes):null]);
  res.json({saved:true});
});

router.post("/onboarding/complete", authMiddleware, async (req,res) => {
  await waitForOnboardingMigration();
  const result=await pool.query(`UPDATE user_onboarding_profiles p SET completed_steps='["email","company","profile","project","defaults"]'::jsonb,completed_at=now(),updated_at=now() WHERE user_id=$1 AND email_verified_at IS NOT NULL AND work_profile IS NOT NULL AND EXISTS(SELECT 1 FROM project_members m WHERE m.user_id=p.user_id) RETURNING completed_at`,[req.user!.userId]);
  if(!result.rows[0]){res.status(409).json({error:"ONBOARDING_PREREQUISITES_INCOMPLETE"});return;}
  res.json({completedAt:result.rows[0].completed_at});
});

export default router;
