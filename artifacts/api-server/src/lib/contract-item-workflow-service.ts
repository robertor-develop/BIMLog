import crypto from "crypto";
import { pool } from "@workspace/db";
import { FinancialControlError } from "./financial-control-contract";
import { authorizeFinancialOperation } from "./financial-control-service";
import { boundedText, positiveId } from "./financial-budget-contract";
import { waitForContractItemWorkflowMigration } from "./contract-item-workflow-migration";
import { assertWorkflowParent, defaultWorkflowPhases, requiredWorkflowParent, workflowNodeStatus, workflowNodeType } from "./contract-item-workflow-contract";

const uuid = () => crypto.randomUUID();

async function transaction<T>(run: (client: any) => Promise<T>) {
  await waitForContractItemWorkflowMigration();
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result = await run(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function itemScope(client: any, projectId: number, contractId: string, stableLineId: string) {
  const row = (await client.query(`
    SELECT c.id contract_id,v.id contract_version_id,v.status contract_status,l.stable_line_id,
      l.description,l.contract_item_snapshot
    FROM financial_contracts c
    JOIN LATERAL (SELECT * FROM financial_contract_versions WHERE contract_id=c.id ORDER BY version DESC LIMIT 1) v ON true
    JOIN financial_contract_sov_lines l ON l.contract_version_id=v.id
    WHERE c.id=$1 AND c.project_id=$2 AND l.stable_line_id=$3
  `, [contractId, projectId, stableLineId])).rows[0];
  if (!row) throw new FinancialControlError(404, "CONTRACT_ITEM_NOT_FOUND", "Contract Item not found in the current contract version.");
  return row;
}

function tree(nodes: any[]) {
  const mapped = nodes.map((row) => ({ id: row.id, parentId: row.parent_id, type: row.node_type, name: row.name, sequence: Number(row.sequence), status: row.status, dueDate: row.due_date, assigneeUserId: row.assignee_user_id == null ? null : Number(row.assignee_user_id), revision: Number(row.revision), children: [] as any[] }));
  const byId = new Map(mapped.map((node) => [node.id, node]));
  const roots: any[] = [];
  for (const node of mapped) { const parent = node.parentId ? byId.get(node.parentId) : null; if (parent) parent.children.push(node); else roots.push(node); }
  const sort = (items: any[]) => { items.sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name)); items.forEach((item) => sort(item.children)); };
  sort(roots);
  return roots;
}

async function response(client: any, workflow: any) {
  const nodes = (await client.query(`SELECT * FROM contract_item_workflow_nodes WHERE workflow_id=$1 ORDER BY sequence,id`, [workflow.id])).rows;
  return { workflow: { id: workflow.id, projectId: Number(workflow.project_id), contractId: workflow.contract_id, contractVersionId: workflow.contract_version_id, stableLineId: workflow.stable_line_id, displayName: workflow.display_name, templateKey: workflow.template_key, status: workflow.status, revision: Number(workflow.revision), updatedAt: new Date(workflow.updated_at).toISOString() }, nodes: tree(nodes) };
}

export async function getContractItemWorkflow(input: { actorUserId: number; projectId: unknown; contractId: unknown; stableLineId: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 1, 100), stableLineId = boundedText(input.stableLineId, "stableLineId", 1, 100);
  await waitForContractItemWorkflowMigration();
  await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.view", operation: "read" });
  const scope = await itemScope(pool, projectId, contractId, stableLineId);
  const workflow = (await pool.query(`SELECT * FROM contract_item_workflows WHERE contract_version_id=$1 AND stable_line_id=$2`, [scope.contract_version_id, stableLineId])).rows[0];
  return workflow ? response(pool, workflow) : { workflow: null, nodes: [] };
}

export async function initializeContractItemWorkflow(input: { actorUserId: number; projectId: unknown; contractId: unknown; stableLineId: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 1, 100), stableLineId = boundedText(input.stableLineId, "stableLineId", 1, 100);
  return transaction(async (client) => {
    await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.prepare", operation: "prepare", client });
    const scope = await itemScope(client, projectId, contractId, stableLineId);
    let workflow = (await client.query(`SELECT * FROM contract_item_workflows WHERE contract_version_id=$1 AND stable_line_id=$2 FOR UPDATE`, [scope.contract_version_id, stableLineId])).rows[0];
    if (workflow) return response(client, workflow);
    const snapshot = scope.contract_item_snapshot ?? {};
    const templateKey = boundedText(snapshot.workflowTemplate ?? "generic", "workflowTemplate", 1, 100);
    const displayName = boundedText(snapshot.displayName ?? scope.description, "displayName", 1, 300);
    const workflowId = uuid();
    workflow = (await client.query(`INSERT INTO contract_item_workflows(id,project_id,contract_id,contract_version_id,stable_line_id,display_name,template_key,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [workflowId, projectId, contractId, scope.contract_version_id, stableLineId, displayName, templateKey, input.actorUserId])).rows[0];
    const phases = defaultWorkflowPhases(templateKey);
    for (let i = 0; i < phases.length; i++) await client.query(`INSERT INTO contract_item_workflow_nodes(id,workflow_id,parent_id,node_type,name,sequence,created_by_id) VALUES($1,$2,NULL,'phase',$3,$4,$5)`, [uuid(), workflowId, phases[i], i + 1, input.actorUserId]);
    await client.query(`INSERT INTO contract_item_workflow_events(id,workflow_id,actor_user_id,event_type,after_state,reason) VALUES($1,$2,$3,'workflow_initialized','active','Contract Item workflow initialized from its frozen template')`, [uuid(), workflowId, input.actorUserId]);
    return response(client, workflow);
  });
}

export async function addContractItemWorkflowNode(input: { actorUserId: number; projectId: unknown; contractId: unknown; stableLineId: unknown; parentId?: unknown; nodeType: unknown; name: unknown; dueDate?: unknown; assigneeUserId?: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 1, 100), stableLineId = boundedText(input.stableLineId, "stableLineId", 1, 100);
  const nodeType = workflowNodeType(input.nodeType);
  const name = boundedText(input.name, "name", 1, 200), parentId = input.parentId == null || input.parentId === "" ? null : boundedText(input.parentId, "parentId", 1, 100);
  if ((requiredWorkflowParent(nodeType) == null) !== (parentId == null)) throw new FinancialControlError(400, "WORKFLOW_PARENT_REQUIRED", "This workflow level requires the correct parent level.");
  return transaction(async (client) => {
    await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.prepare", operation: "prepare", client });
    const scope = await itemScope(client, projectId, contractId, stableLineId);
    const workflow = (await client.query(`SELECT * FROM contract_item_workflows WHERE contract_version_id=$1 AND stable_line_id=$2 FOR UPDATE`, [scope.contract_version_id, stableLineId])).rows[0];
    if (!workflow) throw new FinancialControlError(409, "WORKFLOW_NOT_INITIALIZED", "Initialize the Contract Item workflow first.");
    if (workflow.status !== "active") throw new FinancialControlError(409, "WORKFLOW_NOT_ACTIVE", "Only an active workflow can be changed.");
    if (parentId) {
      const parent = (await client.query(`SELECT node_type FROM contract_item_workflow_nodes WHERE id=$1 AND workflow_id=$2`, [parentId, workflow.id])).rows[0];
      assertWorkflowParent(nodeType, parent?.node_type ? workflowNodeType(parent.node_type) : null);
    } else {
      assertWorkflowParent(nodeType, null);
    }
    const assignee = input.assigneeUserId == null || input.assigneeUserId === "" ? null : positiveId(input.assigneeUserId, "assigneeUserId");
    if (assignee) {
      const member = (await client.query(`SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2 AND status='active'`, [projectId, assignee])).rows[0];
      if (!member) throw new FinancialControlError(400, "WORKFLOW_ASSIGNEE_INVALID", "Task assignee must be an active project member.");
    }
    const sequence = Number((await client.query(`SELECT COALESCE(MAX(sequence),0)+1 next FROM contract_item_workflow_nodes WHERE workflow_id=$1 AND parent_id IS NOT DISTINCT FROM $2`, [workflow.id, parentId])).rows[0].next);
    const nodeId = uuid();
    await client.query(`INSERT INTO contract_item_workflow_nodes(id,workflow_id,parent_id,node_type,name,sequence,due_date,assignee_user_id,created_by_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [nodeId, workflow.id, parentId, nodeType, name, sequence, input.dueDate || null, assignee, input.actorUserId]);
    await client.query(`UPDATE contract_item_workflows SET revision=revision+1,updated_at=now() WHERE id=$1`, [workflow.id]);
    await client.query(`INSERT INTO contract_item_workflow_events(id,workflow_id,node_id,actor_user_id,event_type,after_state,reason) VALUES($1,$2,$3,$4,'node_created',$5,$6)`, [uuid(), workflow.id, nodeId, input.actorUserId, nodeType, `${nodeType} created without changing Contract Item budget`]);
    const current = (await client.query(`SELECT * FROM contract_item_workflows WHERE id=$1`, [workflow.id])).rows[0];
    return response(client, current);
  });
}

export async function updateContractItemWorkflowNode(input: { actorUserId: number; projectId: unknown; contractId: unknown; stableLineId: unknown; nodeId: unknown; expectedRevision: unknown; status: unknown }) {
  const projectId = positiveId(input.projectId, "projectId"), contractId = boundedText(input.contractId, "contractId", 1, 100), stableLineId = boundedText(input.stableLineId, "stableLineId", 1, 100), nodeId = boundedText(input.nodeId, "nodeId", 1, 100);
  const status = workflowNodeStatus(input.status);
  const expectedRevision = positiveId(input.expectedRevision, "expectedRevision");
  return transaction(async (client) => {
    await authorizeFinancialOperation({ actorUserId: input.actorUserId, projectId, featureKey: "cost.commitment.prepare", operation: "prepare", client });
    const scope = await itemScope(client, projectId, contractId, stableLineId);
    const workflow = (await client.query(`SELECT * FROM contract_item_workflows WHERE contract_version_id=$1 AND stable_line_id=$2 FOR UPDATE`, [scope.contract_version_id, stableLineId])).rows[0];
    if (!workflow) throw new FinancialControlError(404, "WORKFLOW_NOT_FOUND", "Contract Item workflow not found.");
    const node = (await client.query(`SELECT * FROM contract_item_workflow_nodes WHERE id=$1 AND workflow_id=$2 FOR UPDATE`, [nodeId, workflow.id])).rows[0];
    if (!node) throw new FinancialControlError(404, "WORKFLOW_NODE_NOT_FOUND", "Workflow node not found.");
    if (Number(node.revision) !== expectedRevision) throw new FinancialControlError(409, "WORKFLOW_NODE_CHANGED", "This workflow item changed. Reload it before saving.");
    await client.query(`UPDATE contract_item_workflow_nodes SET status=$1,revision=revision+1,updated_at=now() WHERE id=$2`, [status, nodeId]);
    await client.query(`UPDATE contract_item_workflows SET revision=revision+1,updated_at=now() WHERE id=$1`, [workflow.id]);
    await client.query(`INSERT INTO contract_item_workflow_events(id,workflow_id,node_id,actor_user_id,event_type,before_state,after_state,reason) VALUES($1,$2,$3,$4,'node_status_changed',$5,$6,'Workflow progress changed; budget remains unchanged')`, [uuid(), workflow.id, nodeId, input.actorUserId, node.status, status]);
    const current = (await client.query(`SELECT * FROM contract_item_workflows WHERE id=$1`, [workflow.id])).rows[0];
    return response(client, current);
  });
}
