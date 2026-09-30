import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { allocateFloorHourCosts, canonicalFloorHourEstimate, EXCESS_HOUR_RATE, floorHourEstimateFingerprint } from "./floor-hour-cost-contract";
import { waitForJobIntakeMigration } from "./job-intake-migration";

type Queryable={query:(text:string,values?:unknown[])=>Promise<{rows:any[];rowCount?:number|null}>};
const reason=(value:unknown)=>{const text=String(value??"").trim();if(text.length<10||text.length>1000)throw new FinancialControlError(400,"FLOOR_HOUR_REASON_INVALID","Reason must contain 10 to 1000 characters.");return text;};

async function writeAllocationRun(client:Queryable,estimate:any,actorUserId:number,runReason:string){
  const entries=(await client.query(`SELECT e.id,e.work_date::text "workDate",e.created_at::text "createdAt",e.hours::text,e.status,e.superseded_by_entry_id "supersededByEntryId",e.user_id "userId",e.assignment_id "assignmentId",r.internal_hourly_rate::text "normalRate" FROM job_activation_time_entries e JOIN job_activation_resource_assignments r ON r.id=e.assignment_id WHERE e.work_item_id=$1 ORDER BY e.work_date,e.created_at,e.id`,[estimate.workItemId])).rows;
  const eligible=entries.filter((entry:any)=>['approved','legacy_recorded'].includes(entry.status)&&!entry.supersededByEntryId);
  if(eligible.some((entry:any)=>entry.normalRate==null))throw new FinancialControlError(409,"FLOOR_HOUR_MEMBER_COST_UNRESOLVED","Every eligible entry requires an approved member-cost snapshot before excess cost can be calculated.");
  const result=allocateFloorHourCosts({estimateVersionId:estimate.id,approvedHours:estimate.approvedHours,excessRate:estimate.excessHourlyRate,entries});
  const sourceFingerprint=crypto.createHash('sha256').update(JSON.stringify({estimateVersionId:estimate.id,entries:eligible.map(({id,hours,status,supersededByEntryId,normalRate,workDate,createdAt}:any)=>({id,hours,status,supersededByEntryId,normalRate,workDate,createdAt}))})).digest('hex');
  const prior=(await client.query(`SELECT id FROM job_activation_time_cost_allocation_runs WHERE estimate_version_id=$1 AND source_fingerprint=$2`,[estimate.id,sourceFingerprint])).rows[0];
  if(prior)return {...result,runId:prior.id,idempotent:true};
  const runId=crypto.randomUUID();
  await client.query(`INSERT INTO job_activation_time_cost_allocation_runs(id,company_id,project_id,work_item_id,location_identity,estimate_version_id,reason,source_fingerprint,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[runId,estimate.companyId,estimate.projectId,estimate.workItemId,estimate.locationIdentity,estimate.id,runReason,sourceFingerprint,actorUserId]);
  for(const row of result.allocations)await client.query(`INSERT INTO job_activation_time_cost_allocations(id,run_id,time_entry_id,sequence_hours_before,normal_hours,excess_hours,normal_hourly_rate,excess_hourly_rate,normal_cost,excess_cost,total_cost,calculation_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,[crypto.randomUUID(),runId,row.entryId,row.sequenceHoursBefore,row.normalHours,row.excessHours,row.normalRate,row.excessRate,row.normalCost,row.excessCost,row.totalCost,row.calculationFingerprint]);
  return {...result,runId,idempotent:false};
}

export async function proposeFloorHourEstimate(input:{actorUserId:number;companyId:number;projectId:number;intakeId:string;workItemId:unknown;approvedHours:unknown;reason:unknown},host:any=pool){
  await waitForJobIntakeMigration();const client=typeof host.connect==='function'?await host.connect():host;
  try{await client.query('BEGIN');
    const work=(await client.query(`SELECT id,location_identity "locationIdentity" FROM job_activation_work_items WHERE id=$1 AND project_id=$2 AND intake_id=$3 AND status<>'cancelled' FOR SHARE`,[String(input.workItemId),input.projectId,input.intakeId])).rows[0];
    if(!work)throw new FinancialControlError(404,"FLOOR_HOUR_WORK_ITEM_NOT_FOUND","Active scope was not found in this project.");
    if(!work.locationIdentity)throw new FinancialControlError(409,"FLOOR_HOUR_LOCATION_REQUIRED","The scope must have a canonical floor or location before an estimate can be proposed.");
    const policy=(await client.query(`SELECT id FROM company_internal_cost_policy_versions WHERE company_id=$1 AND status='approved' AND effective_from<=CURRENT_DATE ORDER BY effective_from DESC,version DESC LIMIT 1 FOR SHARE`,[input.companyId])).rows[0];
    if(!policy)throw new FinancialControlError(409,"FLOOR_HOUR_POLICY_REQUIRED","Approve the company internal-cost policy before proposing a floor estimate.");
    const latest=(await client.query(`SELECT id,version FROM job_activation_floor_hour_estimate_versions WHERE project_id=$1 AND work_item_id=$2 AND location_identity=$3 ORDER BY version DESC LIMIT 1 FOR UPDATE`,[input.projectId,work.id,work.locationIdentity])).rows[0];
    const version=Number(latest?.version??0)+1,approvedHours=canonicalFloorHourEstimate(input.approvedHours),id=crypto.randomUUID();
    const fingerprint=floorHourEstimateFingerprint({projectId:input.projectId,workItemId:work.id,locationIdentity:work.locationIdentity,version,approvedHours,excessRate:EXCESS_HOUR_RATE,policyVersionId:policy.id});
    const row=(await client.query(`INSERT INTO job_activation_floor_hour_estimate_versions(id,company_id,project_id,intake_id,work_item_id,location_identity,version,approved_hours,excess_hourly_rate,internal_cost_policy_version_id,status,reason,content_fingerprint,supersedes_id,proposed_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'proposed',$11,$12,$13,$14) RETURNING id,work_item_id "workItemId",location_identity "locationIdentity",version,approved_hours::text "approvedHours",excess_hourly_rate::text "excessHourlyRate",status,content_fingerprint "contentFingerprint"`,[id,input.companyId,input.projectId,input.intakeId,work.id,work.locationIdentity,version,approvedHours,EXCESS_HOUR_RATE,policy.id,reason(input.reason),fingerprint,latest?.id??null,input.actorUserId])).rows[0];
    await client.query('COMMIT');return row;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{if(client!==host)client.release();}
}

export async function decideFloorHourEstimate(input:{actorUserId:number;companyId:number;projectId:number;estimateVersionId:unknown;outcome:unknown;reason:unknown},host:any=pool){
  await waitForJobIntakeMigration();const client=typeof host.connect==='function'?await host.connect():host;
  try{await client.query('BEGIN');const authority=(await client.query(`SELECT is_super_admin "isCeo" FROM users WHERE id=$1 AND company_id=$2`,[input.actorUserId,input.companyId])).rows[0];
    if(!authority?.isCeo)throw new FinancialControlError(403,"FLOOR_HOUR_CEO_APPROVAL_REQUIRED","Only the company CEO authority may approve or reject floor-hour cost estimates.");
    const outcome=String(input.outcome);if(!['approved','rejected'].includes(outcome))throw new FinancialControlError(400,"FLOOR_HOUR_DECISION_INVALID","Decision must be approved or rejected.");
    const estimate=(await client.query(`SELECT id,company_id "companyId",project_id "projectId",work_item_id "workItemId",location_identity "locationIdentity",approved_hours::text "approvedHours",excess_hourly_rate::text "excessHourlyRate" FROM job_activation_floor_hour_estimate_versions WHERE id=$1 AND company_id=$2 AND project_id=$3 AND status='proposed' FOR UPDATE`,[String(input.estimateVersionId),input.companyId,input.projectId])).rows[0];
    if(!estimate)throw new FinancialControlError(409,"FLOOR_HOUR_VERSION_NOT_PENDING","Floor-hour estimate is missing or no longer pending.");
    if(outcome==='approved')await client.query(`UPDATE job_activation_floor_hour_estimate_versions SET status='superseded' WHERE project_id=$1 AND work_item_id=$2 AND location_identity=$3 AND status='approved'`,[input.projectId,estimate.workItemId,estimate.locationIdentity]);
    await client.query(`UPDATE job_activation_floor_hour_estimate_versions SET status=$2,approved_by_id=$3,decided_at=now(),reason=reason||E'\nDecision: '||$4 WHERE id=$1`,[estimate.id,outcome,input.actorUserId,reason(input.reason)]);
    const calculation=outcome==='approved'?await writeAllocationRun(client,estimate,input.actorUserId,'Approved floor-hour estimate'):null;
    await client.query('COMMIT');return {...estimate,status:outcome,calculation};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{if(client!==host)client.release();}
}

export async function refreshFloorHourCostForWorkItem(client:Queryable,input:{actorUserId:number;projectId:number;workItemId:string;reason:string}){
  const estimate=(await client.query(`SELECT id,company_id "companyId",project_id "projectId",work_item_id "workItemId",location_identity "locationIdentity",approved_hours::text "approvedHours",excess_hourly_rate::text "excessHourlyRate" FROM job_activation_floor_hour_estimate_versions WHERE project_id=$1 AND work_item_id=$2 AND status='approved'`,[input.projectId,input.workItemId])).rows[0];
  return estimate?writeAllocationRun(client,estimate,input.actorUserId,input.reason):null;
}

export async function getFloorHourCostGovernance(input:{projectId:number;includeSensitive:boolean},client:Queryable=pool){
  if(!input.includeSensitive)return {visible:false,estimates:[],breakdowns:[]};
  const estimates=(await client.query(`SELECT e.id,e.work_item_id "workItemId",w.name "workItemName",e.location_identity "locationIdentity",e.version,e.approved_hours::text "approvedHours",e.excess_hourly_rate::text "excessHourlyRate",e.status,e.internal_cost_policy_version_id "policyVersionId",e.proposed_at "proposedAt",e.decided_at "decidedAt" FROM job_activation_floor_hour_estimate_versions e JOIN job_activation_work_items w ON w.id=e.work_item_id WHERE e.project_id=$1 ORDER BY e.work_item_id,e.location_identity,e.version DESC`,[input.projectId])).rows;
  const breakdowns=(await client.query(`SELECT DISTINCT ON(r.work_item_id,r.location_identity) r.id "runId",r.work_item_id "workItemId",r.location_identity "locationIdentity",r.estimate_version_id "estimateVersionId",r.created_at "calculatedAt",COALESCE(SUM(a.normal_hours),0)::text "normalHours",COALESCE(SUM(a.excess_hours),0)::text "excessHours",COALESCE(SUM(a.normal_cost),0)::text "normalCost",COALESCE(SUM(a.excess_cost),0)::text "excessCost",COALESCE(SUM(a.total_cost),0)::text "totalCost" FROM job_activation_time_cost_allocation_runs r LEFT JOIN job_activation_time_cost_allocations a ON a.run_id=r.id WHERE r.project_id=$1 GROUP BY r.id ORDER BY r.work_item_id,r.location_identity,r.created_at DESC,r.id DESC`,[input.projectId])).rows;
  return {visible:true,estimates,breakdowns,rule:"Only hours beyond the approved floor estimate use the $3.50/hour excess rate. Customer billing is unchanged."};
}
