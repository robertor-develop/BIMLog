import { createHash, randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "@workspace/db";
import {
  bimtechApprovedAllocation,
  bimtechGovernancePolicy,
  bimtechPricingTemplate,
  bimtechShopDrawingWorkflow,
  bimtechSleeveWorkflow,
  bimtechTemplateFingerprints,
} from "../src/lib/bimtech-template-repair-definitions";

const CANONICAL_COMPANY_ID = 31;
const DUPLICATE_COMPANY_ID = 35;
const RUBEN_USER_ID = 20;
const LORENA_USER_ID = 25;
const OWNER_OPERATOR_ID = 18;
const expectedMovableTables = new Set([
  "users", "company_master_catalog_administrators", "company_master_catalog_entries",
  "job_intakes",
]);
const intentionallyPreservedTables = new Set([
  "company_master_catalog_policies",
  "project_company_binding_versions",
]);
const apply = process.argv.includes("--apply");
const receiptPath = resolve(process.cwd(), process.env.BIMTECH_REPAIR_RECEIPT ?? "tmp/bimtech-identity-template-repair-receipt.json");

type Client = Awaited<ReturnType<typeof pool.connect>>;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

async function insertWorkflow(client: Client, code: string, name: string, definition: object, fingerprint: string) {
  const existing = (await client.query(`SELECT t.id,v.id "versionId",v.state,v.definition FROM company_delivery_workflow_templates t
    JOIN company_delivery_workflow_versions v ON v.template_id=t.id
    WHERE t.company_id=$1 AND t.code=$2 ORDER BY v.version DESC LIMIT 1`, [CANONICAL_COMPANY_ID, code])).rows[0];
  if (existing) {
    if (hash(existing.definition) !== hash(definition)) throw new Error(`Existing workflow ${code} differs from approved v1.2 definition`);
    return { code, status: "already_present", state: existing.state, templateId: existing.id, versionId: existing.versionId };
  }
  const templateId = randomUUID(); const versionId = randomUUID();
  await client.query(`INSERT INTO company_delivery_workflow_templates(id,company_id,code,name,created_by_id) VALUES($1,$2,$3,$4,$5)`,
    [templateId,CANONICAL_COMPANY_ID,code,name,OWNER_OPERATOR_ID]);
  await client.query(`INSERT INTO company_delivery_workflow_versions(id,template_id,version,state,definition,created_by_id,updated_by_id)
    VALUES($1,$2,1,'draft',$3::jsonb,$4,$4)`, [versionId,templateId,JSON.stringify(definition),OWNER_OPERATOR_ID]);
  await client.query(`INSERT INTO company_delivery_workflow_events(id,company_id,template_id,version_id,action,actor_id,details)
    VALUES($1,$2,$3,$4,'created',$5,$6::jsonb)`, [randomUUID(),CANONICAL_COMPANY_ID,templateId,versionId,OWNER_OPERATOR_ID,
      JSON.stringify({ authority:"Roberto direct authorization", source:"BIMLog Engine Templates v1.2 FINAL", approvedDefinitionFingerprint:fingerprint, lifecycle:"draft_pending_operations_director" })]);
  return { code, status: "created", state: "draft", templateId, versionId };
}

async function insertGovernance(client: Client) {
  const code = "BIMTECH_DELIVERY_GOVERNANCE";
  const existing = (await client.query(`SELECT p.id,v.id "versionId",v.state,v.definition FROM company_workflow_governance_policies p
    JOIN company_workflow_governance_versions v ON v.policy_id=p.id
    WHERE p.company_id=$1 AND p.code=$2 ORDER BY v.version DESC LIMIT 1`, [CANONICAL_COMPANY_ID,code])).rows[0];
  if (existing) {
    if (hash(existing.definition) !== hash(bimtechGovernancePolicy)) throw new Error(`Existing governance ${code} differs from approved v1.2 definition`);
    return { code, status:"already_present", state:existing.state, policyId:existing.id, versionId:existing.versionId };
  }
  const policyId=randomUUID(); const versionId=randomUUID();
  await client.query(`INSERT INTO company_workflow_governance_policies(id,company_id,code,name,created_by_id) VALUES($1,$2,$3,$4,$5)`,
    [policyId,CANONICAL_COMPANY_ID,code,"BIMTECH Delivery Governance",OWNER_OPERATOR_ID]);
  await client.query(`INSERT INTO company_workflow_governance_versions(id,policy_id,version,state,definition,created_by_id,updated_by_id)
    VALUES($1,$2,1,'draft',$3::jsonb,$4,$4)`, [versionId,policyId,JSON.stringify(bimtechGovernancePolicy),OWNER_OPERATOR_ID]);
  await client.query(`INSERT INTO company_workflow_governance_events(id,company_id,policy_id,version_id,action,actor_id,details)
    VALUES($1,$2,$3,$4,'created',$5,$6::jsonb)`, [randomUUID(),CANONICAL_COMPANY_ID,policyId,versionId,OWNER_OPERATOR_ID,
      JSON.stringify({ authority:"Roberto direct authorization", source:"BIMLog Role Governance & Responsibility Matrix v1.2 FINAL", approvedDefinitionFingerprint:bimtechTemplateFingerprints.governance, lifecycle:"draft_pending_operations_director", percentageEscalation:">10 percent requires CEO in addition to Operations Director" })]);
  return { code,status:"created",state:"draft",policyId,versionId };
}

async function insertPricing(client: Client) {
  const code="BIM_SERVICES_STANDARD";
  const existing=(await client.query(`SELECT id "versionId",template_id "templateId",status,provenance FROM generic_apu_template_versions
    WHERE company_id=$1 AND project_id IS NULL AND provenance->>'code'=$2 ORDER BY version DESC LIMIT 1`,[CANONICAL_COMPANY_ID,code])).rows[0];
  if(existing){
    if(existing.provenance?.definitionFingerprint!==bimtechTemplateFingerprints.pricing) throw new Error(`Existing pricing ${code} differs from approved v1.2 definition`);
    return {code,status:"already_present",state:existing.status,templateId:existing.templateId,versionId:existing.versionId};
  }
  const templateId=randomUUID(); const versionId=randomUUID();
  const definition=bimtechPricingTemplate.definition;
  const recordFingerprint=hash({id:versionId,definition});
  const provenance={action:"draft_saved",code,definition,definitionFingerprint:bimtechTemplateFingerprints.pricing,
    sourceVersionId:null,authority:"Roberto direct authorization",source:"BIMLog Engine Templates v1.2 FINAL",
    approvedAllocationPools:bimtechApprovedAllocation,lifecycle:"draft_pending_operations_director",
    commercialValue:"unset; contract-specific input required"};
  await client.query(`INSERT INTO generic_apu_template_versions
    (id,template_id,company_id,project_id,version,name,industry,status,currency,reason,content_fingerprint,supersedes_id,provenance,created_by_id)
    VALUES($1,$2,$3,NULL,1,$4,$5,'draft',$6,$7,$8,NULL,$9::jsonb,$10)`,
    [versionId,templateId,CANONICAL_COMPANY_ID,definition.name,definition.industry,definition.currency,
      "Approved v1.2 structure; commercial value remains contract-specific",recordFingerprint,JSON.stringify(provenance),OWNER_OPERATOR_ID]);
  for(const [index,node] of definition.nodes.entries()){
    await client.query(`INSERT INTO generic_apu_template_nodes
      (id,template_version_id,stable_node_id,parent_node_id,method,label,category,formula,percent,quantity,unit_cost,hours,hourly_rate,currency,sort_order,content_fingerprint,provenance)
      VALUES($1,$2,$3,NULL,$4,$5,'pricing',NULL,NULL,NULL,$6,NULL,NULL,$7,$8,$9,$10::jsonb)`,
      [randomUUID(),versionId,node.id,node.method,node.label,node.method==="fixed_amount"?node.amount:null,definition.currency,index,hash(node),JSON.stringify({definitionNode:node})]);
  }
  return {code,status:"created",state:"draft",templateId,versionId};
}

async function main(){
  const client=await pool.connect();
  let receipt:Record<string,unknown>={mode:apply?"apply":"dry-run",startedAt:new Date().toISOString()};
  try{
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:bimtech-identity-template-repair:20260925'))");
    const users=(await client.query(`SELECT id,email,full_name,company_id,is_super_admin FROM users WHERE id=ANY($1::int[]) ORDER BY id`,[[OWNER_OPERATOR_ID,RUBEN_USER_ID,LORENA_USER_ID]])).rows;
    if(users.length!==3||Number(users.find(row=>Number(row.id)===RUBEN_USER_ID)?.company_id)!==CANONICAL_COMPANY_ID||
      ![CANONICAL_COMPANY_ID,DUPLICATE_COMPANY_ID].includes(Number(users.find(row=>Number(row.id)===LORENA_USER_ID)?.company_id))) throw new Error("BIMTECH identity baseline mismatch");
    const refs=(await client.query(`SELECT DISTINCT tc.table_name,kcu.column_name FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON kcu.constraint_name=tc.constraint_name AND kcu.constraint_schema=tc.constraint_schema
      JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name=tc.constraint_name AND ccu.constraint_schema=tc.constraint_schema
      WHERE tc.constraint_type='FOREIGN KEY' AND ccu.table_name='companies' AND ccu.column_name='id' AND tc.table_schema='public' ORDER BY tc.table_name`)).rows;
    const populated:Array<{table:string;column:string;count:number}>=[];
    for(const ref of refs){const count=Number((await client.query(`SELECT count(*)::int count FROM "${ref.table_name}" WHERE "${ref.column_name}"=$1`,[DUPLICATE_COMPANY_ID])).rows[0].count);if(count)populated.push({table:ref.table_name,column:ref.column_name,count});}
    const unexpected=populated.filter(row=>!expectedMovableTables.has(row.table)&&!intentionallyPreservedTables.has(row.table));
    if(unexpected.length) throw new Error(`Unexpected duplicate-company rows: ${JSON.stringify(unexpected)}`);
    const collisions=(await client.query(`SELECT d.kind,d.code FROM company_master_catalog_entries d JOIN company_master_catalog_entries c
      ON c.company_id=$1 AND c.kind=d.kind AND c.code=d.code WHERE d.company_id=$2`,[CANONICAL_COMPANY_ID,DUPLICATE_COMPANY_ID])).rows;
    if(collisions.length) throw new Error(`Catalog collisions prevent merge: ${JSON.stringify(collisions)}`);
    const policies=(await client.query(`SELECT company_id,mode,version FROM company_master_catalog_policies WHERE company_id=ANY($1::int[]) ORDER BY company_id`,[[CANONICAL_COMPANY_ID,DUPLICATE_COMPANY_ID]])).rows;
    if(policies.length===2&&(policies[0].mode!==policies[1].mode||Number(policies[0].version)!==Number(policies[1].version))) throw new Error("Duplicate policy is not identical to canonical policy");
    const identityAlreadyMerged=Number(users.find(row=>Number(row.id)===LORENA_USER_ID)?.company_id)===CANONICAL_COMPANY_ID;
    if(!identityAlreadyMerged){
      for(const table of expectedMovableTables) await client.query(`UPDATE "${table}" SET company_id=$1 WHERE company_id=$2`,[CANONICAL_COMPANY_ID,DUPLICATE_COMPANY_ID]);
      await client.query(`UPDATE companies SET name='BIMTECH CORP — historical alias of company 31',is_public_profile=false,
        profile_description='Preserved historical duplicate; operational identity merged into canonical company 31 by owner-authorized repair.' WHERE id=$1`,[DUPLICATE_COMPANY_ID]);
    }
    const templates=[
      await insertWorkflow(client,"BIMTECH_SHOP_DRAWING","BIMTECH Shop Drawing",bimtechShopDrawingWorkflow,bimtechTemplateFingerprints.shopDrawing),
      await insertWorkflow(client,"BIMTECH_SLEEVE","BIMTECH Sleeve Drawing",bimtechSleeveWorkflow,bimtechTemplateFingerprints.sleeve),
      await insertGovernance(client),await insertPricing(client),
    ];
    const proof=(await client.query(`SELECT id,email,company_id FROM users WHERE id=ANY($1::int[]) ORDER BY id`,[[RUBEN_USER_ID,LORENA_USER_ID]])).rows;
    receipt={...receipt,canonicalCompanyId:CANONICAL_COMPANY_ID,preservedHistoricalCompanyId:DUPLICATE_COMPANY_ID,identityAlreadyMerged,populatedDuplicateCompanyReferences:populated,
      userProof:proof,templates,fingerprints:bimtechTemplateFingerprints,lifecycle:"draft_pending_operations_director",completedAt:new Date().toISOString()};
    if(apply) await client.query("COMMIT"); else await client.query("ROLLBACK");
  }catch(error){await client.query("ROLLBACK");receipt={...receipt,error:error instanceof Error?error.message:String(error),completedAt:new Date().toISOString()};throw error;}
  finally{client.release();await writeFile(receiptPath,JSON.stringify(receipt,null,2)+"\n","utf8");await pool.end();}
  console.log(JSON.stringify({ok:true,receiptPath,...receipt},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
