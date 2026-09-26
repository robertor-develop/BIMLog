import { randomUUID } from "node:crypto";
type ReconciliationClient = {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

export type ReconciliationPlan = {
  sourceCompanyId: number;
  targetCompanyId: number;
  actorId: number;
  reason: string;
  bindings: Array<{ projectId: number; bindingId: string; version: number }>;
};

/** Bounded operator correction; original bindings and all business records are immutable here. */
export async function reconcileCompanyBindings(client: ReconciliationClient, plan: ReconciliationPlan, apply = false) {
  if (![plan.sourceCompanyId,plan.targetCompanyId,plan.actorId].every(id=>Number.isSafeInteger(id)&&id>0) ||
      plan.sourceCompanyId===plan.targetCompanyId || !plan.reason.trim() || plan.reason.length>1000 ||
      !plan.bindings.length || plan.bindings.length>100 ||
      new Set(plan.bindings.map(row=>row.projectId)).size!==plan.bindings.length ||
      plan.bindings.some(row=>!Number.isSafeInteger(row.projectId)||row.projectId<=0||!Number.isSafeInteger(row.version)||row.version<1||!row.bindingId))
    throw new Error("RECONCILIATION_PLAN_INVALID");
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL lock_timeout='5s'");
    // Same lock used by company creation/rename. No customer table is deleted.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('bimlog:company-identity'))");
    const actor=(await client.query("SELECT id,email,is_super_admin FROM users WHERE id=$1 FOR SHARE",[plan.actorId])).rows[0];
    if(!actor?.is_super_admin) throw new Error("RECONCILIATION_AUTHORITY_REQUIRED");
    const companies=(await client.query("SELECT id,retired_into_company_id FROM companies WHERE id=ANY($1::int[]) ORDER BY id FOR UPDATE",[[plan.sourceCompanyId,plan.targetCompanyId]])).rows;
    const source=companies.find(row=>row.id===plan.sourceCompanyId),target=companies.find(row=>row.id===plan.targetCompanyId);
    if(!source||!target||target.retired_into_company_id!==null||
      (source.retired_into_company_id!==null&&source.retired_into_company_id!==plan.targetCompanyId)) throw new Error("RECONCILIATION_COMPANY_CHANGED");
    if((await client.query("SELECT id FROM users WHERE company_id=$1 LIMIT 1",[plan.sourceCompanyId])).rows.length)
      throw new Error("RECONCILIATION_USERS_REMAIN");
    const references=(await client.query(`SELECT table_name,column_name FROM information_schema.columns
      WHERE table_schema=current_schema() AND column_name IN ('company_id','canonical_company_id') AND data_type='integer'`)).rows;
    for(const ref of references){
      if(["project_company_binding_versions","company_master_catalog_policies"].includes(String(ref.table_name))) continue;
      const identifier=(value:string)=>'"'+value.replaceAll('"','""')+'"';
      if((await client.query(`SELECT 1 FROM ${identifier(String(ref.table_name))} WHERE ${identifier(String(ref.column_name))}=$1 LIMIT 1`,[plan.sourceCompanyId])).rows.length)
        throw new Error("RECONCILIATION_OPERATIONAL_REFERENCES_REMAIN");
    }
    await client.query("LOCK TABLE project_company_binding_versions IN SHARE ROW EXCLUSIVE MODE");
    const current=(await client.query(`SELECT DISTINCT ON(project_id) id,project_id,company_id,version,supersedes_binding_id,audit_evidence
      FROM project_company_binding_versions ORDER BY project_id,version DESC`)).rows;
    if(current.some(row=>row.company_id===plan.sourceCompanyId&&!plan.bindings.some(expected=>expected.projectId===row.project_id)))
      throw new Error("RECONCILIATION_UNPLANNED_PROJECT");
    const changed:number[]=[];
    for(const expected of [...plan.bindings].sort((a,b)=>a.projectId-b.projectId)){
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`project-company:${expected.projectId}`]);
      const prior=(await client.query("SELECT id,company_id,version,supersedes_binding_id,audit_evidence FROM project_company_binding_versions WHERE project_id=$1 ORDER BY version DESC LIMIT 1",[expected.projectId])).rows[0];
      const audit=prior?.audit_evidence as {sourceCompanyId?:number}|undefined;
      if(prior?.company_id===plan.targetCompanyId&&prior.version===expected.version+1&&prior.supersedes_binding_id===expected.bindingId&&audit?.sourceCompanyId===plan.sourceCompanyId) continue;
      if(!prior||prior.id!==expected.bindingId||prior.version!==expected.version||prior.company_id!==plan.sourceCompanyId)
        throw new Error("RECONCILIATION_BINDING_CHANGED");
      await client.query(`INSERT INTO project_company_binding_versions(id,project_id,company_id,version,bound_by_id,reason_code,explanation_en,explanation_es,supersedes_binding_id,audit_evidence)
        VALUES($1,$2,$3,$4,$5,'COMPANY_IDENTITY_RECONCILIATION',$6,$7,$8,$9::jsonb)`,
      [randomUUID(),expected.projectId,plan.targetCompanyId,expected.version+1,actor.id,plan.reason,"Corrección de identidad de empresa; se conserva la versión anterior.",prior.id,JSON.stringify({source:"company_identity_reconciliation",sourceCompanyId:plan.sourceCompanyId,targetCompanyId:plan.targetCompanyId})]);
      changed.push(expected.projectId);
    }
    if(source.retired_into_company_id===null){
      await client.query("UPDATE companies SET retired_into_company_id=$1,retired_at=now(),is_public_profile=false WHERE id=$2",[plan.targetCompanyId,plan.sourceCompanyId]);
      await client.query("INSERT INTO admin_actions_log(admin_user_id,admin_email,action,target_type,target_id,details) VALUES($1,$2,'retire_company_alias','company',$3,$4::jsonb)",
        [actor.id,actor.email,String(plan.sourceCompanyId),JSON.stringify({targetCompanyId:plan.targetCompanyId,reason:plan.reason,projectIds:plan.bindings.map(row=>row.projectId)})]);
    }
    await client.query(apply?"COMMIT":"ROLLBACK");
    return {mode:apply?"applied":"dry_run",changedProjectIds:changed,sourceCompanyId:plan.sourceCompanyId,targetCompanyId:plan.targetCompanyId};
  } catch(error){await client.query("ROLLBACK");throw error;}
}
