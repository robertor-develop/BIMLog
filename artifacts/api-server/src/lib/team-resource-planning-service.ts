import crypto from "node:crypto";
import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { effectiveCommercialAccessForUser } from "./commercial-entitlement";
import { waitForJobIntakeMigration } from "./job-intake-migration";
import { waitForTeamResourcePlanningMigration } from "./team-resource-planning-migration";

type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }> };
type Assignment = { taskId: string; assignmentId: string | null; expectedAssignmentVersion: number | null; userId: number; plannedHours: number; startDate: string; endDate: string; category: string; reason: string; expectedTaskVersion: number };
type Profile = { weeklyCapacityHours: number; timezone: string; workingDays: number[]; leave: Array<{ startDate: string; endDate: string; label?: string }>; internalHourlyRate: number | null; billingHourlyRate: number | null };
type ExperienceEvidence = { category: string; evidenceCount: number };
const MANAGER_ROLES = new Set(["owner", "admin", "project_admin", "project_manager", "bim_manager", "manager"]);

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const money = (value: number) => Number(value.toFixed(2));
const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(",")}]` : `{${Object.entries(value as Record<string, unknown>).sort(([a],[b]) => a.localeCompare(b)).map(([key,item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
const fingerprint = (value: unknown) => crypto.createHash("sha256").update(canonical(value)).digest("hex");
const storedScenarioKey = (projectId:number, value:string) => `project:${projectId}:${value}`;
const externalScenarioKey = (projectId:number, value:string) => value.startsWith(`project:${projectId}:`) ? value.slice(`project:${projectId}:`.length) : value;
const storedEventKey = (projectId:number, value:string) => fingerprint({projectId,eventKey:value});
function id(value: unknown, field: string) { const n=Number(value); if(!Number.isSafeInteger(n)||n<=0) throw new FinancialControlError(400,"TEAM_RESOURCE_ID_INVALID",`${field} is invalid.`); return n; }
function text(value: unknown, field: string, min=1, max=200) { const s=String(value??"").trim(); if(s.length<min||s.length>max) throw new FinancialControlError(400,"TEAM_RESOURCE_TEXT_INVALID",`${field} is invalid.`); return s; }
function date(value: unknown, field: string) { const s=String(value??""); if(!isoDate.test(s)||Number.isNaN(Date.parse(`${s}T00:00:00Z`))) throw new FinancialControlError(400,"TEAM_RESOURCE_DATE_INVALID",`${field} is invalid.`); return s; }
function finite(value: unknown, field: string, min=0, max=1_000_000) { const n=Number(value); if(!Number.isFinite(n)||n<min||n>max) throw new FinancialControlError(400,"TEAM_RESOURCE_NUMBER_INVALID",`${field} is invalid.`); return n; }
function nullableRate(value: unknown, field: string) { return value == null || value === "" ? null : finite(value,field,0); }
function profile(value: any, options: { allowRates: boolean; existingRates?: Pick<Profile, "internalHourlyRate" | "billingHourlyRate"> } = { allowRates: true }): Profile {
  if(!value||typeof value!=="object"||Array.isArray(value)) throw new FinancialControlError(400,"TEAM_RESOURCE_PROFILE_INVALID","A complete availability profile is required.");
  const weeklyCapacityHours=finite(value?.weeklyCapacityHours,"weeklyCapacityHours",1,168);
  const timezone=text(value?.timezone,"timezone",1,100);
  if(!Array.isArray(value?.workingDays)) throw new FinancialControlError(400,"TEAM_RESOURCE_WORKING_DAYS_REQUIRED","Working days must be explicitly provided.");
  const workingDays:number[]=[...new Set<number>(value.workingDays.map((item:unknown)=>finite(item,"workingDay",0,6)))].sort((a,b)=>a-b);
  if(!workingDays.length) throw new FinancialControlError(400,"TEAM_RESOURCE_WORKING_DAYS_REQUIRED","At least one working day is required.");
  const leave=(Array.isArray(value?.leave)?value.leave:[]).map((item:any)=>{const startDate=date(item.startDate,"leave.startDate"),endDate=date(item.endDate,"leave.endDate");if(startDate>endDate)throw new FinancialControlError(400,"TEAM_RESOURCE_LEAVE_RANGE_INVALID","Leave start must not be after end.");return{startDate,endDate,label:String(item.label??"").trim().slice(0,120)}});
  const internalHourlyRate = options.allowRates ? nullableRate(value?.internalHourlyRate,"internalHourlyRate") : options.existingRates?.internalHourlyRate ?? null;
  const billingHourlyRate = options.allowRates ? nullableRate(value?.billingHourlyRate,"billingHourlyRate") : options.existingRates?.billingHourlyRate ?? null;
  return {weeklyCapacityHours,timezone,workingDays,leave,internalHourlyRate,billingHourlyRate};
}
function assignments(value: unknown): Assignment[] { if(!Array.isArray(value)||!value.length) throw new FinancialControlError(400,"TEAM_RESOURCE_ASSIGNMENTS_REQUIRED","At least one assignment is required."); return value.map((item:any)=>{const startDate=date(item.startDate,"assignment.startDate"),endDate=date(item.endDate,"assignment.endDate");if(startDate>endDate)throw new FinancialControlError(400,"TEAM_RESOURCE_ASSIGNMENT_RANGE_INVALID","Assignment start must not be after end.");const assignmentId=item.assignmentId==null||item.assignmentId===""?null:text(item.assignmentId,"assignmentId",1,200),expectedAssignmentVersion=assignmentId?id(item.expectedAssignmentVersion,"expectedAssignmentVersion"):null;return{taskId:text(item.taskId,"taskId",1,200),assignmentId,expectedAssignmentVersion,userId:id(item.userId,"userId"),plannedHours:finite(item.plannedHours,"plannedHours",0.01,100000),startDate,endDate,category:text(item.category,"category",1,120),reason:text(item.reason,"reason",5,500),expectedTaskVersion:id(item.expectedTaskVersion,"expectedTaskVersion")}}); }

async function access(actorUserId: number, projectId: number, client: Queryable) {
  const row=(await client.query(`SELECT p.id,p.name,p.code,u.company_id "actorCompanyId",u.is_super_admin "isSuperAdmin",pm.role,ji.data,
    COALESCE((SELECT company_id FROM project_company_binding_versions WHERE project_id=p.id ORDER BY version DESC LIMIT 1),creator.company_id) "companyId"
    FROM projects p JOIN users u ON u.id=$2 JOIN users creator ON creator.id=p.created_by_id
    LEFT JOIN project_members pm ON pm.project_id=p.id AND pm.user_id=u.id AND pm.status='active'
    LEFT JOIN job_intakes ji ON ji.project_id=p.id
    WHERE p.id=$1 AND p.status<>'archived'`,[projectId,actorUserId])).rows[0];
  if(!row) throw new FinancialControlError(404,"TEAM_RESOURCE_PROJECT_NOT_FOUND","Project not found.");
  if(!row.isSuperAdmin&&!row.role) throw new FinancialControlError(403,"TEAM_RESOURCE_MEMBERSHIP_REQUIRED","Active project membership is required.");
  if(!row.isSuperAdmin&&Number(row.actorCompanyId)!==Number(row.companyId)) throw new FinancialControlError(403,"TEAM_RESOURCE_COMPANY_MISMATCH","The project belongs to another company.");
  const commercial=await effectiveCommercialAccessForUser(actorUserId,client);
  if(!row.isSuperAdmin&&!commercial.team_performance) throw new FinancialControlError(403,"TEAM_RESOURCE_ENTITLEMENT_REQUIRED","Team Performance & Skills access is required.");
  const leaderId=Number(row.data?.team?.projectLeaderUserId??0)||null;
  const canManage=Boolean(row.isSuperAdmin||leaderId===actorUserId||MANAGER_ROLES.has(String(row.role??"").toLowerCase()));
  const canViewRates=Boolean(row.isSuperAdmin||(canManage&&commercial.budget&&commercial.cost_value_planner));
  return {...row,leaderId,canManage,canViewRates,canManageRates:false};
}

function daysBetween(startDate:string,endDate:string,workingDays:number[],leave:Profile["leave"]) { let days=0; const cursor=new Date(`${startDate}T00:00:00Z`),end=new Date(`${endDate}T00:00:00Z`); while(cursor<=end){const day=cursor.getUTCDay(),stamp=cursor.toISOString().slice(0,10),away=leave.some(item=>item.startDate<=stamp&&item.endDate>=stamp);if(workingDays.includes(day)&&!away)days++;cursor.setUTCDate(cursor.getUTCDate()+1);} return days; }
export function evaluateStaffingScenario(input:{startDate:string;endDate:string;assignments:Assignment[];profiles:Map<number,Profile>;commitments:Map<number,number>;experience:Map<string,number>}) {
  const people=new Map<number,{userId:number;capacityHours:number|null;existingHours:number;scenarioHours:number;internalCost:number|null;billingValue:number|null;warnings:string[]}>();
  for(const assignment of input.assignments){
    const p=input.profiles.get(assignment.userId);
    const capacityHours=p?money(daysBetween(input.startDate,input.endDate,p.workingDays,p.leave)*(p.weeklyCapacityHours/p.workingDays.length)):null;
    const current=people.get(assignment.userId)??{userId:assignment.userId,capacityHours,existingHours:money(input.commitments.get(assignment.userId)??0),scenarioHours:0,internalCost:p?.internalHourlyRate==null?null:0,billingValue:p?.billingHourlyRate==null?null:0,warnings:[]};
    current.scenarioHours=money(current.scenarioHours+assignment.plannedHours);
    if(p?.internalHourlyRate!=null&&current.internalCost!=null)current.internalCost=money(current.internalCost+assignment.plannedHours*p.internalHourlyRate);
    if(p?.billingHourlyRate!=null&&current.billingValue!=null)current.billingValue=money(current.billingValue+assignment.plannedHours*p.billingHourlyRate);
    if(!p)current.warnings.push("CAPACITY_PROFILE_REQUIRED");
    if(!(input.experience.get(`${assignment.userId}:${assignment.category.trim().toLocaleLowerCase("en-US")}`)??0))current.warnings.push(`NO_VERIFIED_CATEGORY_EVIDENCE:${assignment.category}`);
    people.set(assignment.userId,current);
  }
  for(const person of people.values()){if(person.capacityHours!=null&&person.existingHours+person.scenarioHours>person.capacityHours)person.warnings.push("CAPACITY_EXCEEDED");}
  const rows=[...people.values()].map(item=>({...item,availableHours:item.capacityHours==null?null:money(Math.max(0,item.capacityHours-item.existingHours)),utilization:item.capacityHours?Number(((item.existingHours+item.scenarioHours)/item.capacityHours).toFixed(4)):null,warnings:[...new Set(item.warnings)]}));
  const costKnown=rows.every(row=>row.internalCost!=null),valueKnown=rows.every(row=>row.billingValue!=null);
  return {people:rows,totals:{scenarioHours:money(rows.reduce((s,r)=>s+r.scenarioHours,0)),internalCost:costKnown?money(rows.reduce((s,r)=>s+(r.internalCost??0),0)):null,billingValue:valueKnown?money(rows.reduce((s,r)=>s+(r.billingValue??0),0)):null},warnings:[...new Set(rows.flatMap(row=>row.warnings))],decision:"review_required"};
}

async function context(actorUserId:number,projectId:number,client:Queryable){
  const auth=await access(actorUserId,projectId,client);
  const members=(await client.query(`SELECT u.id,u.full_name "name",COALESCE(u.job_title,'') "jobTitle",pm.role FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 AND pm.status='active' ORDER BY lower(u.full_name),u.id`,[projectId])).rows;
  const memberIds=members.map((member:any)=>Number(member.id));
  const profiles=memberIds.length?(await client.query(`SELECT DISTINCT ON(user_id) id,user_id "userId",version,content,created_at "createdAt" FROM team_capacity_profile_versions WHERE company_id=$1 AND user_id=ANY($2::int[]) ORDER BY user_id,version DESC`,[auth.companyId,memberIds])).rows:[];
  const tasks=(await client.query(`SELECT t.id,t.name_en "nameEn",t.name_es "nameEs",t.status,t.planned_hours "plannedHours",t.progress_percent "progress",t.assignee_user_id "assigneeUserId",t.version,w.name "workItem",
    r.id "assignmentId",r.version "assignmentVersion"
    FROM job_activation_tasks t JOIN job_activation_work_items w ON w.id=t.work_item_id
    LEFT JOIN LATERAL(SELECT ra.id,ra.version FROM job_activation_resource_assignments ra WHERE ra.task_id=t.id AND ra.user_id=t.assignee_user_id ORDER BY ra.created_at,ra.id LIMIT 1) r ON true
    WHERE w.project_id=$1 AND w.status<>'cancelled' AND t.status NOT IN('complete','cancelled') ORDER BY w.name,t.sequence,t.id`,[projectId])).rows;
  const loads=memberIds.length?(await client.query(`WITH assignment_load AS(
      SELECT r.user_id,t.id task_id,p.id project_id,p.code,p.name,r.planned_hours*(1-t.progress_percent/100.0) remaining_hours
      FROM job_activation_resource_assignments r JOIN job_activation_tasks t ON t.id=r.task_id JOIN job_activation_work_items w ON w.id=t.work_item_id JOIN projects p ON p.id=w.project_id
      WHERE r.user_id=ANY($1::int[]) AND t.status NOT IN('complete','cancelled')
    ), direct_load AS(
      SELECT t.assignee_user_id user_id,t.id task_id,p.id project_id,p.code,p.name,t.planned_hours*(1-t.progress_percent/100.0) remaining_hours
      FROM job_activation_tasks t JOIN job_activation_work_items w ON w.id=t.work_item_id JOIN projects p ON p.id=w.project_id
      WHERE t.assignee_user_id=ANY($1::int[]) AND t.status NOT IN('complete','cancelled')
        AND NOT EXISTS(SELECT 1 FROM job_activation_resource_assignments r WHERE r.task_id=t.id AND r.user_id=t.assignee_user_id)
    ), visible_load AS(SELECT * FROM assignment_load UNION ALL SELECT * FROM direct_load)
    SELECT user_id "userId",project_id "projectId",code "projectCode",name "projectName",SUM(remaining_hours) "remainingHours"
    FROM visible_load v WHERE $3::boolean OR EXISTS(SELECT 1 FROM project_members viewer WHERE viewer.project_id=v.project_id AND viewer.user_id=$2 AND viewer.status='active')
    GROUP BY user_id,project_id,code,name ORDER BY user_id,lower(name),project_id`,[memberIds,actorUserId,Boolean(auth.isSuperAdmin)])).rows:[];
  const evidence=memberIds.length?(await client.query(`WITH assigned AS(
      SELECT r.user_id,t.id task_id,t.status,t.updated_at,r.role,w.workflow_template,w.name work_item
      FROM job_activation_resource_assignments r JOIN job_activation_tasks t ON t.id=r.task_id JOIN job_activation_work_items w ON w.id=t.work_item_id
      WHERE w.project_id=$1 AND r.user_id=ANY($2::int[])
      UNION ALL
      SELECT t.assignee_user_id,t.id,t.status,t.updated_at,'' role,w.workflow_template,w.name
      FROM job_activation_tasks t JOIN job_activation_work_items w ON w.id=t.work_item_id
      WHERE w.project_id=$1 AND t.assignee_user_id=ANY($2::int[]) AND NOT EXISTS(SELECT 1 FROM job_activation_resource_assignments r WHERE r.task_id=t.id AND r.user_id=t.assignee_user_id)
    ), labels AS(
      SELECT user_id,task_id,status,updated_at,'role' kind,role category FROM assigned WHERE btrim(role)<>''
      UNION ALL SELECT user_id,task_id,status,updated_at,'workflow',workflow_template FROM assigned WHERE btrim(workflow_template)<>''
      UNION ALL SELECT user_id,task_id,status,updated_at,'scope',work_item FROM assigned WHERE btrim(work_item)<>''
    ), package_labels AS(
      SELECT p.responsible_user_id user_id,p.id evidence_id,p.updated_at,'package' kind,p.package_type category FROM job_activation_work_packages p WHERE p.project_id=$1 AND p.responsible_user_id=ANY($2::int[]) AND p.status<>'cancelled'
    ), deliverable_labels AS(
      SELECT COALESCE(r.user_id,t.assignee_user_id) user_id,d.id evidence_id,d.linked_at updated_at,'deliverable' kind,d.deliverable_type category
      FROM job_activation_task_deliverables d JOIN job_activation_tasks t ON t.id=d.task_id LEFT JOIN job_activation_resource_assignments r ON r.task_id=t.id
      WHERE d.project_id=$1 AND COALESCE(r.user_id,t.assignee_user_id)=ANY($2::int[])
    ), all_evidence AS(
      SELECT user_id,task_id::text evidence_id,updated_at,kind,category FROM labels
      UNION ALL SELECT * FROM package_labels
      UNION ALL SELECT * FROM deliverable_labels
    )
    SELECT user_id "userId",category,array_agg(DISTINCT kind ORDER BY kind) kinds,COUNT(DISTINCT evidence_id)::int "evidenceCount",MAX(updated_at) "lastEvidence"
    FROM all_evidence WHERE btrim(category)<>'' GROUP BY user_id,category ORDER BY user_id,COUNT(DISTINCT evidence_id) DESC,lower(category)`,[projectId,memberIds])).rows:[];
  const scenarios=(await client.query(`SELECT DISTINCT ON(scenario_key) id,scenario_key "scenarioKey",version,content,evaluation,created_at "createdAt",EXISTS(SELECT 1 FROM team_staffing_application_events e WHERE e.scenario_version_id=team_staffing_scenario_versions.id AND e.project_id=$1) applied FROM team_staffing_scenario_versions WHERE project_id=$1 AND company_id=$2 ORDER BY scenario_key,version DESC`,[projectId,auth.companyId])).rows;
  return{auth,members,profiles,tasks,loads,evidence,scenarios};
}

export async function getResourcePlanning(input:{actorUserId:unknown;projectId:unknown},client:Queryable=pool){await Promise.all([waitForJobIntakeMigration(),waitForTeamResourcePlanningMigration()]);const actor=id(input.actorUserId,"actorUserId"),project=id(input.projectId,"projectId");const data=await context(actor,project,client);return{project:{id:project,name:data.auth.name,code:data.auth.code},canManage:data.auth.canManage,canViewRates:data.auth.canViewRates,canManageRates:data.auth.canManageRates,members:data.members.map((member:any)=>{const stored=data.profiles.find((p:any)=>Number(p.userId)===Number(member.id))??null;const content=stored?.content&&typeof stored.content==="object"?{...stored.content,internalHourlyRate:data.auth.canViewRates?stored.content.internalHourlyRate:null,billingHourlyRate:data.auth.canViewRates?stored.content.billingHourlyRate:null}:stored?.content;return{...member,profile:stored?{...stored,content}:null,crossProjectLoad:data.loads.filter((load:any)=>Number(load.userId)===Number(member.id)),verifiedExperience:data.evidence.filter((item:any)=>Number(item.userId)===Number(member.id)).map((item:any):ExperienceEvidence&Record<string,unknown>=>({...item,evidenceCount:Number(item.evidenceCount)}))};}),tasks:data.tasks,scenarios:data.scenarios.map((scenario:any)=>({...scenario,scenarioKey:externalScenarioKey(project,String(scenario.scenarioKey))})),methodology:"Saved availability and leave define capacity. Existing commitments come only from authorized Job Operations projects. Verified experience comes only from recorded project work and is not a rating. Scenarios never change live assignments until an authorized reviewer explicitly applies them."};}

export async function saveCapacityProfile(
  input:{actorUserId:unknown;projectId:unknown;userId:unknown;profile:unknown;expectedVersion?:unknown},
  client:any=pool,
) {
  await waitForTeamResourcePlanningMigration();
  const actor=id(input.actorUserId,"actorUserId"),project=id(input.projectId,"projectId"),userId=id(input.userId,"userId");
  const auth=await access(actor,project,client);
  if(actor!==userId) throw new FinancialControlError(403,"TEAM_RESOURCE_PROFILE_SELF_ONLY","Availability and leave are user-controlled. Users may update only their own profile.");
  const connection=typeof client.connect==="function"?await client.connect():client;
  try {
    await connection.query("BEGIN");
    const member=(await connection.query(`SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2 AND status='active' FOR UPDATE`,[project,userId])).rows[0];
    if(!member) throw new FinancialControlError(400,"TEAM_RESOURCE_MEMBER_REQUIRED","The profile user must be an active project member.");
    const latest=(await connection.query(`SELECT id,version,content FROM team_capacity_profile_versions WHERE company_id=$1 AND user_id=$2 ORDER BY version DESC LIMIT 1 FOR UPDATE`,[auth.companyId,userId])).rows[0];
    const expected=Number(input.expectedVersion??0);
    if((latest?.version??0)!==expected) throw new FinancialControlError(409,"TEAM_RESOURCE_PROFILE_VERSION_CONFLICT","The availability profile changed. Reload before saving.");
    const existingRates={
      internalHourlyRate: nullableRate(latest?.content?.internalHourlyRate,"internalHourlyRate"),
      billingHourlyRate: nullableRate(latest?.content?.billingHourlyRate,"billingHourlyRate"),
    };
    const content=profile(input.profile,{allowRates:false,existingRates});
    const row=(await connection.query(`INSERT INTO team_capacity_profile_versions(id,company_id,user_id,version,content,content_fingerprint,supersedes_id,created_by_id) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8) RETURNING id,version,content,created_at "createdAt"`,[crypto.randomUUID(),auth.companyId,userId,expected+1,JSON.stringify(content),fingerprint(content),latest?.id??null,actor])).rows[0];
    await connection.query("COMMIT");
    return {...row,content:{...row.content,internalHourlyRate:auth.canViewRates?row.content.internalHourlyRate:null,billingHourlyRate:auth.canViewRates?row.content.billingHourlyRate:null}};
  } catch(error:any) {
    await connection.query("ROLLBACK");
    if(error?.code==="23505") throw new FinancialControlError(409,"TEAM_RESOURCE_PROFILE_VERSION_CONFLICT","The availability profile changed. Reload before saving.");
    throw error;
  } finally { if(connection!==client) connection.release(); }
}

async function evaluationData(actor:number,project:number,content:any,client:Queryable){
  const data=await context(actor,project,client);
  const parsed=assignments(content.assignments),taskIds=new Set<string>();
  if(parsed.some(item=>{if(taskIds.has(item.taskId))return true;taskIds.add(item.taskId);return false;})) throw new FinancialControlError(400,"TEAM_RESOURCE_DUPLICATE_TASK","A staffing scenario may contain each task only once.");
  const startDate=date(content.startDate,"startDate"),endDate=date(content.endDate,"endDate");
  if(startDate>endDate) throw new FinancialControlError(400,"TEAM_RESOURCE_RANGE_INVALID","Scenario start must not be after end.");
  if(parsed.some(item=>item.startDate<startDate||item.endDate>endDate)) throw new FinancialControlError(400,"TEAM_RESOURCE_ASSIGNMENT_OUTSIDE_SCENARIO","Every assignment date range must remain inside the staffing scenario range.");
  const memberIds=new Set(data.members.map((m:any)=>Number(m.id)));
  if(parsed.some(item=>!memberIds.has(item.userId))) throw new FinancialControlError(400,"TEAM_RESOURCE_SCENARIO_MEMBER_INVALID","Every scenario user must be an active project member.");
  const taskMap=new Map(data.tasks.map((task:any)=>[String(task.id),task]));
  for(const item of parsed){
    const task:any=taskMap.get(item.taskId);
    if(!task) throw new FinancialControlError(400,"TEAM_RESOURCE_SCENARIO_TASK_INVALID","Every scenario task must be an active task in this project.");
    if(Number(task.version)!==item.expectedTaskVersion) throw new FinancialControlError(409,"TEAM_RESOURCE_TASK_VERSION_CONFLICT","A task changed. Reload the scenario before saving.");
    if((task.assignmentId??null)!==item.assignmentId||(task.assignmentId!=null&&Number(task.assignmentVersion)!==item.expectedAssignmentVersion)) throw new FinancialControlError(409,"TEAM_RESOURCE_ASSIGNMENT_VERSION_CONFLICT","A resource assignment changed. Reload the scenario before saving.");
    if(item.assignmentId) throw new FinancialControlError(409,"TEAM_RESOURCE_DIRECT_TASK_ONLY","Existing priced resource rows must be reassigned through Job Operations. Staffing scenarios may apply only to direct task assignees so predecessor rates and costs are never inherited.");
  }
  const profileMap=new Map<number,Profile>();
  for(const row of data.profiles){
    const stored=profile(row.content,{allowRates:true});
    profileMap.set(Number(row.userId),data.auth.canViewRates?stored:{...stored,internalHourlyRate:null,billingHourlyRate:null});
  }
  const commitments=new Map<number,number>();
  for(const load of data.loads) commitments.set(Number(load.userId),(commitments.get(Number(load.userId))??0)+Number(load.remainingHours));
  for(const taskId of taskIds){
    const task:any=taskMap.get(taskId),currentUser=Number(task?.assigneeUserId??0);
    if(currentUser>0) commitments.set(currentUser,Math.max(0,(commitments.get(currentUser)??0)-Number(task.plannedHours??0)*(1-Number(task.progress??0)/100)));
  }
  const experience=new Map<string,number>();
  for(const item of data.evidence) experience.set(`${Number(item.userId)}:${String(item.category).trim().toLocaleLowerCase("en-US")}`,Number(item.evidenceCount??0));
  const basisFingerprint=fingerprint({
    profiles:data.profiles.map((row:any)=>({userId:Number(row.userId),id:row.id,version:Number(row.version)})),
    loads:data.loads.map((row:any)=>({userId:Number(row.userId),projectId:Number(row.projectId),remainingHours:Number(row.remainingHours)})),
    evidence:data.evidence.map((row:any)=>({userId:Number(row.userId),category:row.category,evidenceCount:Number(row.evidenceCount),lastEvidence:row.lastEvidence??null})),
    tasks:parsed.map(item=>{const task:any=taskMap.get(item.taskId);return{taskId:item.taskId,version:Number(task.version),assignmentId:task.assignmentId??null,assignmentVersion:task.assignmentVersion==null?null:Number(task.assignmentVersion)}}),
  });
  return{parsed,startDate,endDate,basisFingerprint,evaluation:evaluateStaffingScenario({startDate,endDate,assignments:parsed,profiles:profileMap,commitments,experience})};
}
export async function evaluateScenario(input:{actorUserId:unknown;projectId:unknown;content:any},client:Queryable=pool){await waitForTeamResourcePlanningMigration();const actor=id(input.actorUserId,"actorUserId"),project=id(input.projectId,"projectId");return(await evaluationData(actor,project,input.content,client)).evaluation;}
export async function saveScenario(input:{actorUserId:unknown;projectId:unknown;scenarioKey?:unknown;expectedVersion?:unknown;content:any},client:any=pool){
  await waitForTeamResourcePlanningMigration();
  const actor=id(input.actorUserId,"actorUserId"),project=id(input.projectId,"projectId"),auth=await access(actor,project,client);
  if(!auth.canManage) throw new FinancialControlError(403,"TEAM_RESOURCE_MANAGE_REQUIRED","Project leadership is required to save staffing scenarios.");
  const publicKey=input.scenarioKey?text(input.scenarioKey,"scenarioKey",1,100):crypto.randomUUID(),scenarioKey=storedScenarioKey(project,publicKey);
  const connection=typeof client.connect==="function"?await client.connect():client;
  try {
    await connection.query("BEGIN");
    const latest=(await connection.query(`SELECT id,version FROM team_staffing_scenario_versions WHERE scenario_key=$1 AND company_id=$2 AND project_id=$3 ORDER BY version DESC LIMIT 1 FOR UPDATE`,[scenarioKey,auth.companyId,project])).rows[0];
    const expected=Number(input.expectedVersion??0);
    if((latest?.version??0)!==expected) throw new FinancialControlError(409,"TEAM_RESOURCE_SCENARIO_VERSION_CONFLICT","The scenario changed. Reload before saving.");
    const data=await evaluationData(actor,project,input.content,connection);
    const content={name:text(input.content?.name,"name",3,120),startDate:data.startDate,endDate:data.endDate,assignments:data.parsed,basisFingerprint:data.basisFingerprint};
    const row=(await connection.query(`INSERT INTO team_staffing_scenario_versions(id,scenario_key,company_id,project_id,version,content,evaluation,content_fingerprint,supersedes_id,created_by_id) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10) RETURNING id,scenario_key "scenarioKey",version,content,evaluation,created_at "createdAt"`,[crypto.randomUUID(),scenarioKey,auth.companyId,project,expected+1,JSON.stringify(content),JSON.stringify(data.evaluation),fingerprint(content),latest?.id??null,actor])).rows[0];
    await connection.query("COMMIT");
    return {...row,scenarioKey:publicKey};
  } catch(error:any) {
    await connection.query("ROLLBACK");
    if(error?.code==="23505") throw new FinancialControlError(409,"TEAM_RESOURCE_SCENARIO_VERSION_CONFLICT","The scenario changed. Reload before saving.");
    throw error;
  } finally { if(connection!==client) connection.release(); }
}

export async function applyScenario(input:{actorUserId:unknown;projectId:unknown;scenarioVersionId:unknown;eventKey:unknown;reason:unknown},client:any=pool){
  await waitForTeamResourcePlanningMigration();
  const actor=id(input.actorUserId,"actorUserId"),project=id(input.projectId,"projectId"),auth=await access(actor,project,client);
  if(!auth.canManage) throw new FinancialControlError(403,"TEAM_RESOURCE_MANAGE_REQUIRED","Project leadership is required to apply staffing scenarios.");
  const scenarioId=text(input.scenarioVersionId,"scenarioVersionId",1,200),publicEventKey=text(input.eventKey,"eventKey",8,200),eventKey=storedEventKey(project,publicEventKey),reason=text(input.reason,"reason",10,1000);
  const connection=typeof client.connect==="function"?await client.connect():client;
  try {
    await connection.query("BEGIN");
    await connection.query(`SELECT pg_advisory_xact_lock(hashtext('bimlog:team-staffing-apply'),hashtext($1))`,[eventKey]);
    const replay=(await connection.query(`SELECT scenario_version_id "scenarioVersionId",reason,result FROM team_staffing_application_events WHERE project_id=$1 AND event_key=$2`,[project,eventKey])).rows[0];
    if(replay){
      if(String(replay.scenarioVersionId)!==scenarioId||String(replay.reason)!==reason) throw new FinancialControlError(409,"TEAM_RESOURCE_EVENT_KEY_DIVERGENT_REPLAY","The event key was already used for a different staffing application.");
      await connection.query("COMMIT");return replay.result;
    }
    const row=(await connection.query(`SELECT content FROM team_staffing_scenario_versions WHERE id=$1 AND company_id=$2 AND project_id=$3 FOR UPDATE`,[scenarioId,auth.companyId,project])).rows[0];
    if(!row) throw new FinancialControlError(404,"TEAM_RESOURCE_SCENARIO_NOT_FOUND","Scenario version not found.");
    const live=await evaluationData(actor,project,row.content,connection);
    if(String(row.content?.basisFingerprint??"")!==live.basisFingerprint) throw new FinancialControlError(409,"TEAM_RESOURCE_SCENARIO_BASIS_STALE","Capacity, commitments, evidence, or assignment authority changed. Re-evaluate and save a new scenario version.");
    const list=live.parsed,applied=[];
    for(const item of list){
      const member=(await connection.query(`SELECT u.full_name "name",u.email FROM project_members pm JOIN users u ON u.id=pm.user_id WHERE pm.project_id=$1 AND pm.user_id=$2 AND pm.status='active'`,[project,item.userId])).rows[0];
      if(!member) throw new FinancialControlError(409,"TEAM_RESOURCE_MEMBER_STALE","A selected project member is no longer active.");
      if(item.assignmentId) throw new FinancialControlError(409,"TEAM_RESOURCE_DIRECT_TASK_ONLY","Existing priced resource rows must be reassigned through Job Operations; no scenario assignments were applied.");
      const updated=(await connection.query(`UPDATE job_activation_tasks t SET assignee_user_id=$3,version=t.version+1,updated_at=now() FROM job_activation_work_items w WHERE t.id=$1 AND t.version=$2 AND w.id=t.work_item_id AND w.project_id=$4 RETURNING t.id,t.version,w.id "workItemId"`,[item.taskId,item.expectedTaskVersion,item.userId,project])).rows[0];
      if(!updated) throw new FinancialControlError(409,"TEAM_RESOURCE_TASK_VERSION_CONFLICT","A live task changed; no scenario assignments were applied.");
      await connection.query(`INSERT INTO job_activation_operation_events(id,project_id,work_item_id,task_id,assignment_id,actor_user_id,event_type,evidence) VALUES($1,$2,$3,$4,$5,$6,'resource_reassigned',$7::jsonb)`,[crypto.randomUUID(),project,updated.workItemId,item.taskId,null,actor,JSON.stringify({source:"staffing_scenario",scenarioVersionId:scenarioId,reason,fromTaskVersion:item.expectedTaskVersion,toTaskVersion:Number(updated.version),plannedHoursAdvisory:item.plannedHours,userId:item.userId})]);
      applied.push({taskId:item.taskId,assignmentId:null,userId:item.userId,newTaskVersion:Number(updated.version),newAssignmentVersion:null,plannedHoursAdvisory:item.plannedHours});
    }
    const result={scenarioVersionId:scenarioId,applied,reason};
    await connection.query(`INSERT INTO team_staffing_application_events(id,event_key,scenario_version_id,project_id,actor_user_id,reason,result) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`,[crypto.randomUUID(),eventKey,scenarioId,project,actor,reason,JSON.stringify(result)]);
    await connection.query("COMMIT");
    return result;
  } catch(error:any) {
    await connection.query("ROLLBACK");
    if(error?.code==="23505") throw new FinancialControlError(409,"TEAM_RESOURCE_EVENT_KEY_CONFLICT","This project event key was already used by another staffing application.");
    throw error;
  } finally { if(connection!==client) connection.release(); }
}
