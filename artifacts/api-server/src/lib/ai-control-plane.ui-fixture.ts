import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";
import { ensureAiControlPlaneSchema } from "./ai-control-plane-migration";
import { createProviderConnection } from "./ai-control-plane";

async function main(){
  await ensureAiControlPlaneSchema();
  process.env.AI_PROVIDER_ACTIVE_KEK_VERSION="v1";
  process.env.AI_PROVIDER_KEK_V1=Buffer.alloc(32,9).toString("base64url");
  const password=process.env.AI_CONTROL_UI_FIXTURE_PASSWORD;
  if(!password) throw new Error("AI_CONTROL_UI_FIXTURE_PASSWORD is required for isolated UI evidence.");
  const marker=`ai-ui-${Date.now()}`, passwordHash=await bcrypt.hash(password,10);
  const company=(await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`,[`${marker} Company`])).rows[0];
  async function user(role:string,isSuperAdmin=false){return (await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,$2,$3,$4,$5) RETURNING id,email`,[`${marker}-${role}@example.test`,password,`${role[0].toUpperCase()}${role.slice(1)} Evidence`,company.id,isSuperAdmin])).rows[0];}
  const personal=await user("personal"), admin=await user("company-admin"), ordinary=await user("ordinary"), superAdmin=await user("super-admin",true);
  await pool.query(`UPDATE users SET password_hash=$1 WHERE id=ANY($2::int[])`,[passwordHash,[personal.id,admin.id,ordinary.id,superAdmin.id]]);
  const project=(await pool.query(`INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id`,[`${marker} Project`,marker,admin.id])).rows[0];
  await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'project_admin','active')`,[project.id,admin.id]);
  const personalConnection=await createProviderConnection({actorUserId:personal.id,actorCompanyId:company.id,actorIsSuperAdmin:false,actorIsCompanyAdmin:false,ownerType:"personal",provider:"openai",secret:`sk-${marker}-personal`,label:"My OpenAI workspace",allowedModels:["approved-model-a"]});
  const companyConnection=await createProviderConnection({actorUserId:admin.id,actorCompanyId:company.id,actorIsSuperAdmin:false,actorIsCompanyAdmin:true,ownerType:"company",provider:"anthropic",secret:`sk-${marker}-company`,label:"Company Anthropic credits",allowedModels:["approved-model-b"]});
  const systemConnection=await createProviderConnection({actorUserId:superAdmin.id,actorCompanyId:company.id,actorIsSuperAdmin:true,actorIsCompanyAdmin:true,ownerType:"system",provider:"openai",secret:`sk-${marker}-system`,label:"BIMLog system credits",allowedModels:["approved-model-c"]});
  await pool.query(`UPDATE provider_connections SET status='active',validated_at=now() WHERE id=ANY($1::text[])`,[[personalConnection.id,companyConnection.id,systemConnection.id]]);
  const output={marker,password,users:{personal:personal.email,companyAdmin:admin.email,ordinary:ordinary.email,superAdmin:superAdmin.email}};
  const report=JSON.stringify(output,null,2);console.log(report);
  if(process.env.AI_CONTROL_UI_FIXTURE_OUTPUT)await import("node:fs/promises").then(fs=>fs.writeFile(process.env.AI_CONTROL_UI_FIXTURE_OUTPUT!,`${report}\n`,{encoding:"utf8",flag:"wx"}));
  await pool.end();
}
main().catch(async e=>{console.error(e instanceof Error?e.message:String(e));await pool.end();process.exitCode=1;});
