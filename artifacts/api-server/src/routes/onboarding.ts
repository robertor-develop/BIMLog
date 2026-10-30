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
const milestones = new Set(["today_viewed","primary_action_opened","onboarding_completed","first_project_opened"]);
const milestoneSurfaces = new Set(["headquarters","onboarding","project"]);
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function ensureProfile(userId: number, companyId: number) {
  await pool.query(`INSERT INTO user_onboarding_profiles(user_id,company_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET company_id=EXCLUDED.company_id`,[userId,companyId]);
}

router.get("/onboarding", authMiddleware, async (req,res) => {
  await waitForOnboardingMigration();
  await ensureProfile(req.user!.userId,req.user!.companyId);
  const result=await pool.query(`SELECT p.*,u.email,c.name company_name,(SELECT count(*)::int FROM project_members pm JOIN projects scoped ON scoped.id=pm.project_id JOIN users creator ON creator.id=scoped.created_by_id WHERE pm.user_id=p.user_id AND pm.status='active' AND scoped.status<>'archived' AND COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=scoped.id ORDER BY version DESC LIMIT 1),creator.company_id)=p.company_id) project_count,fv.kind first_value_kind,fv.record_id first_value_record_id,fv.project_id first_value_project_id,fv.project_code first_value_project_code,fv.project_name first_value_project_name,fv.label first_value_label,fv.created_at first_value_created_at FROM user_onboarding_profiles p JOIN users u ON u.id=p.user_id JOIN companies c ON c.id=p.company_id LEFT JOIN LATERAL (SELECT candidate.kind,candidate.record_id,candidate.project_id,project.code project_code,project.name project_name,candidate.label,candidate.created_at FROM (SELECT 'rfi'::text kind,r.id record_id,r.project_id,r.subject label,r.created_at FROM rfis r JOIN project_members member ON member.project_id=r.project_id WHERE member.user_id=p.user_id AND member.status='active' UNION ALL SELECT 'submittal'::text,s.id,s.project_id,s.title,s.created_at FROM submittals s JOIN project_members member ON member.project_id=s.project_id WHERE member.user_id=p.user_id AND member.status='active' UNION ALL SELECT 'file'::text,f.id,f.project_id,f.file_name,f.created_at FROM files f JOIN project_members member ON member.project_id=f.project_id WHERE member.user_id=p.user_id AND member.status='active') candidate JOIN projects project ON project.id=candidate.project_id JOIN users creator ON creator.id=project.created_by_id WHERE project.status<>'archived' AND COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=project.id ORDER BY version DESC LIMIT 1),creator.company_id)=p.company_id ORDER BY candidate.created_at,candidate.kind,candidate.record_id LIMIT 1) fv ON true WHERE p.user_id=$1`,[req.user!.userId]);
  const row=result.rows[0];
  const firstValueEvidence=row.first_value_record_id?{kind:row.first_value_kind,recordId:row.first_value_record_id,projectId:row.first_value_project_id,projectCode:row.first_value_project_code,projectName:row.first_value_project_name,label:row.first_value_label,createdAt:row.first_value_created_at}:null;
  res.json({email:row.email,companyName:row.company_name,emailVerifiedAt:row.email_verified_at,workProfile:row.work_profile,preferredDisciplines:row.preferred_disciplines,preferredDocumentTypes:row.preferred_document_types,completedSteps:row.completed_steps,completedAt:row.completed_at,projectCount:row.project_count,firstValueReached:Boolean(firstValueEvidence),firstValueEvidence});
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
  const guidePaused=typeof req.body?.guidePaused==="boolean"?req.body.guidePaused:null;
  const acknowledgeFirstValue=req.body?.acknowledgeFirstValue===true;
  if(role!==null&&!profiles.has(role)){res.status(400).json({error:"WORK_PROFILE_INVALID"});return;}
  const saved=await pool.query(`UPDATE user_onboarding_profiles profile SET work_profile=COALESCE($2,work_profile),preferred_disciplines=COALESCE($3::jsonb,preferred_disciplines),preferred_document_types=COALESCE($4::jsonb,preferred_document_types),completed_steps=(SELECT COALESCE(jsonb_agg(DISTINCT value),'[]'::jsonb) FROM jsonb_array_elements_text((completed_steps - CASE WHEN $5::boolean IS FALSE THEN 'guide_paused' ELSE '' END) || CASE WHEN $2::text IS NULL THEN '[]'::jsonb ELSE '["profile"]'::jsonb END || CASE WHEN $5::boolean IS TRUE THEN '["guide_paused"]'::jsonb ELSE '[]'::jsonb END || CASE WHEN $6::boolean IS TRUE THEN '["first_value_seen"]'::jsonb ELSE '[]'::jsonb END)),updated_at=now() WHERE user_id=$1 AND ($6::boolean IS FALSE OR EXISTS(SELECT 1 FROM project_members member JOIN projects scoped ON scoped.id=member.project_id JOIN users creator ON creator.id=scoped.created_by_id WHERE member.user_id=profile.user_id AND member.status='active' AND scoped.status<>'archived' AND COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=scoped.id ORDER BY version DESC LIMIT 1),creator.company_id)=profile.company_id AND (EXISTS(SELECT 1 FROM rfis record WHERE record.project_id=member.project_id) OR EXISTS(SELECT 1 FROM submittals record WHERE record.project_id=member.project_id) OR EXISTS(SELECT 1 FROM files record WHERE record.project_id=member.project_id)))) RETURNING completed_steps`,[req.user!.userId,role,preferredDisciplines?JSON.stringify(preferredDisciplines):null,preferredDocumentTypes?JSON.stringify(preferredDocumentTypes):null,guidePaused,acknowledgeFirstValue]);
  if(acknowledgeFirstValue&&!saved.rows[0]){res.status(409).json({error:"FIRST_VALUE_EVIDENCE_REQUIRED"});return;}
  res.json({saved:true,guidePaused,firstValueAcknowledged:acknowledgeFirstValue});
});

router.post("/onboarding/complete", authMiddleware, async (req,res) => {
  await waitForOnboardingMigration();
  const result=await pool.query(`UPDATE user_onboarding_profiles p SET completed_steps='["email","company","profile","project","defaults"]'::jsonb,completed_at=now(),updated_at=now() WHERE user_id=$1 AND email_verified_at IS NOT NULL AND work_profile IS NOT NULL AND EXISTS(SELECT 1 FROM project_members m WHERE m.user_id=p.user_id) RETURNING completed_at`,[req.user!.userId]);
  if(!result.rows[0]){res.status(409).json({error:"ONBOARDING_PREREQUISITES_INCOMPLETE"});return;}
  res.json({completedAt:result.rows[0].completed_at});
});

router.post("/onboarding/milestones", authMiddleware, async (req,res) => {
  await waitForOnboardingMigration();
  const milestone=typeof req.body?.milestone==="string"?req.body.milestone:"";
  const surface=typeof req.body?.surface==="string"?req.body.surface:"";
  if(!milestones.has(milestone)||!milestoneSurfaces.has(surface)){res.status(400).json({error:"ADOPTION_MILESTONE_INVALID"});return;}
  await pool.query(`INSERT INTO adoption_milestone_events(company_id,user_id,milestone,surface) SELECT $1,$2,$3,$4 WHERE NOT EXISTS (SELECT 1 FROM adoption_milestone_events WHERE user_id=$2 AND milestone=$3 AND surface=$4)`,[req.user!.companyId,req.user!.userId,milestone,surface]);
  res.status(202).json({recorded:true});
});

export default router;
