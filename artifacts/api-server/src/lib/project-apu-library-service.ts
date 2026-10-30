import { createHash, randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { authorizeFinancialOperation } from "./financial-control-service";
import { waitForGenericApuPersistenceMigration } from "./generic-apu-persistence-migration";
import { validatePricingTemplate } from "./company-pricing-template-contract";
import { CostValuePlanError } from "./cost-value-plan-service";
import { projectApuIdentity } from "./apu-library-reuse";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function getProjectLibraryApplications(actorUserId:number,projectId:number,options:{budgetControl?:boolean;receiptIds?:string[];projectApuVersionId?:string}={}) {
  await waitForGenericApuPersistenceMigration();
  const auth=await authorizeFinancialOperation({actorUserId,projectId,featureKey:options.budgetControl?"cost.budget.view":"cost.value_planner.view",operation:"read"});
  if(options.projectApuVersionId&&!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(options.projectApuVersionId))throw new CostValuePlanError(400,"APU_VERSION_QUERY_INVALID","Provide an exact bounded project APU version identity.");
  const rows=(await pool.query(`SELECT p.id "projectApuVersionId",p.project_apu_id "projectApuId",p.version,p.status,p.currency,p.template_version_id "templateVersionId",p.template_fingerprint "templateFingerprint",p.applied_by_id "makerUserId",p.applied_at "appliedAt",p.provenance,
    t.name "templateName",t.version "templateVersion" FROM generic_project_apu_versions p JOIN generic_apu_template_versions t ON t.id=p.template_version_id WHERE p.project_id=$1 AND p.company_id=$2 AND ($3::text IS NULL OR p.id=$3) ORDER BY p.applied_at DESC LIMIT 100`,[projectId,auth.scope.companyId,options.projectApuVersionId??null])).rows;
  if(!options.budgetControl)return {projectId,companyId:auth.scope.companyId,applications:rows};
  const receiptIds=options.receiptIds??[];
  if(receiptIds.length>100||receiptIds.some(id=>!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)))throw new CostValuePlanError(400,"APU_RECEIPT_QUERY_INVALID","Provide at most 100 bounded receipt identities.");
  const history=(await pool.query(`SELECT h.id,h.event_type,h.actor_user_id,h.evidence,h.occurred_at,COALESCE(h.evidence->>'projectApuVersionId',a.evidence->>'projectApuVersionId') "projectApuVersionId" FROM financial_authority_journal h LEFT JOIN financial_authority_journal a ON a.id=h.evidence->>'originalReceiptId' AND a.company_id=h.company_id AND a.project_id=h.project_id AND a.event_type='generic_apu_overrun_approved' WHERE h.company_id=$1 AND h.project_id=$2 AND h.event_type IN('generic_apu_overrun_approved','generic_apu_overrun_reversed') AND COALESCE(h.evidence->>'projectApuVersionId',a.evidence->>'projectApuVersionId')=ANY($3::text[]) AND (cardinality($4::text[])=0 OR h.id=ANY($4::text[]) OR h.evidence->>'originalReceiptId'=ANY($4::text[])) ORDER BY h.occurred_at DESC,h.id DESC LIMIT 1000`,[auth.scope.companyId,projectId,rows.map(row=>row.projectApuVersionId),receiptIds])).rows;
  return {projectId,companyId:auth.scope.companyId,applications:rows.map(row=>({...row,authorityHistory:history.filter(event=>event.projectApuVersionId===row.projectApuVersionId)}))};
}
export async function applyLibraryApu(actorUserId: number, projectId: number, input: { templateVersionId?: unknown; idempotencyKey?: unknown }) {
  await waitForGenericApuPersistenceMigration();
  const auth = await authorizeFinancialOperation({ actorUserId,projectId,featureKey:"cost.value_planner.prepare",operation:"prepare" });
  const templateVersionId = String(input?.templateVersionId ?? "");
  const idempotencyKey = String(input?.idempotencyKey ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(templateVersionId) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(idempotencyKey))
    throw new CostValuePlanError(400,"APU_LIBRARY_APPLICATION_INVALID","A template version and idempotency key are required.");
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`project-apu:${projectId}`]);
    const template = (await connection.query(`SELECT v.*,v.provenance->'definition' definition,
      (SELECT newest.status FROM generic_apu_template_versions newest WHERE newest.template_id=v.template_id AND newest.company_id=v.company_id ORDER BY newest.version DESC LIMIT 1) latest_status
      FROM generic_apu_template_versions v WHERE v.id=$1 AND v.company_id=$2 AND v.project_id IS NULL`,[templateVersionId,auth.scope.companyId])).rows[0];
    if (!template || template.status !== "published" || template.latest_status !== "published") throw new CostValuePlanError(409,"APU_LIBRARY_VERSION_INELIGIBLE","Select an eligible currently published APU version.");
    const { definition,preview,fingerprint } = validatePricingTemplate(template.definition);
    if (fingerprint !== template.content_fingerprint) throw new CostValuePlanError(409,"APU_LIBRARY_FINGERPRINT_MISMATCH","The published APU fingerprint is invalid.");
    const requestFingerprint = digest({projectId,templateVersionId,idempotencyKey});
    const priorKey = (await connection.query(`SELECT id,request_fingerprint FROM generic_project_apu_versions WHERE project_id=$1 AND idempotency_key=$2`,[projectId,idempotencyKey])).rows[0];
    if (priorKey) {
      if (priorKey.request_fingerprint !== requestFingerprint) throw new CostValuePlanError(409,"APU_LIBRARY_IDEMPOTENCY_CONFLICT","The application key was already used for a different request.");
      await connection.query("ROLLBACK"); return { projectApuVersionId:priorKey.id,replayed:true };
    }
    const projectApuId = projectApuIdentity(projectId,template.template_id);
    const prior = (await connection.query(`SELECT id,version FROM generic_project_apu_versions WHERE project_apu_id=$1 ORDER BY version DESC LIMIT 1`,[projectApuId])).rows[0];
    const version = Number(prior?.version ?? 0)+1;
    const projectApuVersionId = randomUUID();
    const contentFingerprint = digest({projectId,templateVersionId,templateFingerprint:fingerprint,version,lines:preview.lines});
    await connection.query(`INSERT INTO generic_project_apu_versions(id,project_apu_id,project_id,company_id,template_version_id,version,status,currency,template_fingerprint,content_fingerprint,idempotency_key,request_fingerprint,supersedes_id,provenance,applied_by_id,applied_at)
      VALUES($1,$2,$3,$4,$5,$6,'calculated',$7,$8,$9,$10,$11,$12,$13::jsonb,$14,now())`,[projectApuVersionId,projectApuId,projectId,auth.scope.companyId,templateVersionId,version,definition.currency,fingerprint,contentFingerprint,idempotencyKey,requestFingerprint,prior?.id ?? null,JSON.stringify({source:"company_apu_library",templateId:template.template_id,templateVersion:Number(template.version),templateVersionId,templateFingerprint:fingerprint}),actorUserId]);
    const nodes = (await connection.query(`SELECT id,stable_node_id,content_fingerprint FROM generic_apu_template_nodes WHERE template_version_id=$1`,[templateVersionId])).rows;
    const byStable = new Map(nodes.map(node => [node.stable_node_id,node]));
    for (const [index,line] of preview.lines.entries()) {
      const node = byStable.get(line.id); if (!node) throw new CostValuePlanError(409,"APU_LIBRARY_NODE_MISMATCH","The published APU nodes are incomplete.");
      await connection.query(`INSERT INTO generic_project_apu_lines(id,project_apu_version_id,template_node_id,stable_line_id,method,raw_inputs,raw_amount,rounded_amount,currency,sort_order,content_fingerprint,provenance)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12::jsonb)`,[randomUUID(),projectApuVersionId,node.id,line.id,line.method,JSON.stringify({sourceTemplateNodeId:node.id}),line.rawAmount,line.roundedAmount,line.currency,index,digest({projectApuVersionId,line}),JSON.stringify({templateNodeFingerprint:node.content_fingerprint})]);
    }
    await connection.query("COMMIT");
    return {projectApuId,projectApuVersionId,version,templateVersionId,templateVersion:Number(template.version),templateFingerprint:fingerprint,currency:definition.currency,total:preview.roundedTotal,replayed:false};
  } catch(error) { await connection.query("ROLLBACK").catch(rollbackError => console.error("[project-apu-library] rollback failed", rollbackError)); throw error; }
  finally { connection.release(); }
}
