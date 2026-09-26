import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { Client } = createRequire(import.meta.url)("pg");
process.env.PROD_DATABASE_URL = "postgresql://postgres@127.0.0.1:55469/bimlog_rfi_test";
const { workflowGovernanceActorRoles, requireWorkflowPolicyRole } = await import("../src/lib/workflow-governance-role-authority");
const { pool } = await import("@workspace/db");
const { workflowPolicyApprovalProgress } = await import("../src/lib/workflow-governance-approval-progress");
const { governanceThresholdApplies, frozenWorkflowMoney } = await import("../src/lib/workflow-governance-threshold");
const { activationFingerprint } = await import("../src/lib/job-activation-commercial-baseline");
const usd = { currency: "USD", amountMinor: 2500000 };
assert.equal(governanceThresholdApplies(usd, {currency:"USD",amount:"24999.99"}), false);
assert.equal(governanceThresholdApplies(usd, {currency:"USD",amount:"25000"}), false);
assert.equal(governanceThresholdApplies(usd, {currency:"USD",amount:"25000.000001"}), true);
assert.equal(governanceThresholdApplies({currency:"JPY",amountMinor:25}, {currency:"JPY",amount:"25"}), false);
assert.equal(governanceThresholdApplies({currency:"KWD",amountMinor:25001}, {currency:"KWD",amount:"25.002"}), true);
assert.throws(() => governanceThresholdApplies(usd, {currency:"EUR",amount:"999999"}), {code:"WORKFLOW_POLICY_CURRENCY_MISMATCH"});
assert.throws(() => governanceThresholdApplies(usd, null), {code:"WORKFLOW_POLICY_AMOUNT_REQUIRED"});
assert.equal(governanceThresholdApplies({currency:"USD",amountMinor:Number.MAX_SAFE_INTEGER}, {currency:"USD",amount:"90071992547409.910001"}), true);
const presentationPath = "../../bimlog/src/lib/governance-threshold-presentation.ts";
const { governanceThresholdLabel } = await import(presentationPath);
const messagePath = "../../bimlog/src/lib/workflow-governance-decision-message.ts";
const { workflowActionError } = await import(messagePath);
const denied = Object.assign(new Error("No se pudo completar la operación."), {code:"DELIVERY_WORKFLOW_TASKS_INCOMPLETE"});
assert.equal(workflowActionError(denied, (_en:string,es:string)=>es), "Complete primero todos los puntos de control de la fase.");
assert.equal(workflowActionError(denied, (en:string)=>en), "Complete all phase checkpoints first.");
assert.equal(workflowActionError(new Error("Safe fallback"), (en:string)=>en), "Safe fallback");
assert.equal(governanceThresholdLabel(usd,false), "Greater than 25,000.00 USD");
assert.equal(governanceThresholdLabel(null,true), "Siempre");
const hierarchy = { approvalRules: [{ action: "complete_deliverable", roles: ["CEO"] },
  { action: "complete_phase", roles: ["QC_REVIEWER", "PROJECT_LEADER"] }] } as any;
const stage = (role: string, level: number, runtimeRevision: number, action = "complete_phase", policyFingerprint = "frozen") =>
  ({ action: "policy_stage_approved", phaseId: "phase", evidence: { role, level, runtimeRevision, action, policyFingerprint } });
assert.equal(workflowPolicyApprovalProgress(hierarchy, "frozen", "phase", true, []).next?.role, "QC_REVIEWER");
assert.equal(workflowPolicyApprovalProgress(hierarchy, "frozen", "phase", true, [stage("PROJECT_LEADER",2,1)]).approved, 0);
const chain = [stage("QC_REVIEWER",1,2),stage("PROJECT_LEADER",2,3),stage("CEO",1,4,"complete_deliverable")];
assert.equal(workflowPolicyApprovalProgress(hierarchy, "frozen", "phase", true, chain).complete, true);
assert.equal(workflowPolicyApprovalProgress(hierarchy, "other-version", "phase", true, chain).approved, 0);
assert.equal(workflowPolicyApprovalProgress(hierarchy, "frozen", "phase", true,
  [...chain,{action:"evidence_linked",phaseId:"phase",evidence:{runtimeRevision:5}}]).approved, 0);
assert.equal(workflowPolicyApprovalProgress(hierarchy, "frozen", "phase", true,
  [...chain,{action:"phase_reopened",phaseId:"prior",evidence:{runtimeRevision:5,resetPhases:["phase"]}}]).approved, 0);
const client = new Client({ host: "127.0.0.1", port: 55469, user: "postgres", database: "bimlog_rfi_test", connectionTimeoutMillis: 3000 });
await client.connect();
try {
  // Connection-local temporary relations: no production or persistent fixture rows.
  await client.query(`CREATE TEMP TABLE users(id int,company_id int,is_super_admin boolean);
    CREATE TEMP TABLE projects(id int,created_by_id int,status text);
    CREATE TEMP TABLE project_members(project_id int,user_id int,role text,status text);
    CREATE TEMP TABLE project_company_binding_versions(project_id int,company_id int,version int);
    CREATE TEMP TABLE company_master_catalog_administrators(company_id int,user_id int,state text);
    CREATE TEMP TABLE edt_operations_director_grants(id text,company_id int,project_id int,user_id int);
    CREATE TEMP TABLE edt_operations_director_revocations(grant_id text);
    CREATE TEMP TABLE company_delivery_workflow_roles(work_item_id text,user_id int,role text);
    CREATE TEMP TABLE company_delivery_workflow_work_items(work_item_id text,company_id int,project_id int);
    INSERT INTO users VALUES(1,31,false),(2,31,false),(3,35,true),(4,31,false),(5,31,false),(6,31,true);
    INSERT INTO projects VALUES(57,1,'active');
    INSERT INTO project_members VALUES(57,1,'project_admin','active'),(57,2,'member','active'),
      (57,3,'project_admin','active'),(57,4,'project_admin','inactive'),(57,5,'INVENTED_ADMIN','active'),(57,6,'member','active');
    INSERT INTO company_delivery_workflow_work_items VALUES('TEST-WI',31,57);
    INSERT INTO company_delivery_workflow_roles VALUES('TEST-WI',2,'review');
    INSERT INTO company_master_catalog_administrators VALUES(31,1,'active');
    INSERT INTO edt_operations_director_grants VALUES('grant',31,57,1);`);
  const scope = { companyId: 31, projectId: 57, workItemId: "TEST-WI" };
  const resolve = (actorUserId: number) => workflowGovernanceActorRoles(client, { ...scope, actorUserId });
  assert.deepEqual(await resolve(1), ["PROJECT_LEADER", "PMO", "OPERATIONS_DIRECTOR"]);
  assert.deepEqual(await resolve(2), ["DRAFTER", "QC_REVIEWER"]);
  await assert.rejects(resolve(3), { code: "WORKFLOW_POLICY_COMPANY_REQUIRED" });
  await assert.rejects(resolve(4), { code: "WORKFLOW_POLICY_PROJECT_MEMBER_REQUIRED" });
  assert.deepEqual(await resolve(5), []);
  assert.deepEqual(await resolve(6), ["DRAFTER", "CEO"]);
  const policy = { permissions: [{ role: "PROJECT_LEADER", actions: ["view", "approve"] },
    { role: "QC_REVIEWER", actions: ["view", "approve"] }, { role: "INVENTED_ADMIN", actions: ["view", "approve"] }] } as any;
  requireWorkflowPolicyRole(policy, await resolve(1), "PROJECT_LEADER", "approve");
  requireWorkflowPolicyRole(policy, await resolve(2), "QC_REVIEWER", "approve");
  assert.throws(() => requireWorkflowPolicyRole(policy, ["CEO"], "PROJECT_LEADER", "approve"), { code: "WORKFLOW_POLICY_ROLE_REQUIRED" });
  assert.throws(() => requireWorkflowPolicyRole(policy, [], "INVENTED_ADMIN", "approve"), { code: "WORKFLOW_POLICY_ROLE_REQUIRED" });
  await client.query("INSERT INTO edt_operations_director_revocations VALUES('grant')");
  assert.deepEqual(await resolve(1), ["PROJECT_LEADER", "PMO"]);
  await client.query("UPDATE project_members SET status='inactive' WHERE user_id=2");
  await assert.rejects(resolve(2), { code: "WORKFLOW_POLICY_PROJECT_MEMBER_REQUIRED" });
  await client.query("INSERT INTO project_company_binding_versions VALUES(57,35,1)");
  await assert.rejects(resolve(1), { code: "WORKFLOW_POLICY_COMPANY_REQUIRED" });
  await client.query(`CREATE TEMP TABLE job_intakes(id text,company_id int);
    CREATE TEMP TABLE job_activation_work_items(id text,intake_id text,project_id int,contract_version_id text,stable_scope_item_id text);
    CREATE TEMP TABLE job_activation_contract_item_baselines(intake_id text,project_id int,contract_version_id text,stable_line_id text,budget_account_id text,pricing_snapshot jsonb,snapshot_fingerprint text);
    CREATE TEMP TABLE job_activation_budget_accounts(id text,intake_id text,project_id int,currency text);
    INSERT INTO job_intakes VALUES('intake',31);
    INSERT INTO job_activation_work_items VALUES('TEST-WI','intake',57,'contract-v1','scope-1');
    INSERT INTO job_activation_budget_accounts VALUES('budget','intake',57,'USD');`);
  const pricing = { contractValue: "25000.01" };
  await client.query("INSERT INTO job_activation_contract_item_baselines VALUES('intake',57,'contract-v1','scope-1','budget',$1,$2)",
    [JSON.stringify(pricing),activationFingerprint(pricing)]);
  const money = await frozenWorkflowMoney(client,"TEST-WI",31,57);
  assert.deepEqual(money,{amount:"25000.01",currency:"USD"});
  assert.equal(governanceThresholdApplies(usd,money),true);
  await assert.rejects(frozenWorkflowMoney(client,"TEST-WI",35,57),{code:"WORKFLOW_POLICY_AMOUNT_REQUIRED"});
  await assert.rejects(frozenWorkflowMoney(client,"TEST-WI",31,58),{code:"WORKFLOW_POLICY_AMOUNT_REQUIRED"});
  await client.query("UPDATE job_activation_contract_item_baselines SET snapshot_fingerprint='mismatch'");
  await assert.rejects(frozenWorkflowMoney(client,"TEST-WI",31,57),{code:"WORKFLOW_POLICY_AMOUNT_MISMATCH"});
  console.log("C006 role authority: PASS (real PostgreSQL, company isolation, inactive membership, unknown role, explicit QC assignment, grant revocation, binding change, no super-admin role substitution).");
} finally { await client.end(); await pool.end(); }
