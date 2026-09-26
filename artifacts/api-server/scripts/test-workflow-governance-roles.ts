import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { Client } = createRequire(import.meta.url)("pg");
process.env.PROD_DATABASE_URL = "postgresql://postgres@127.0.0.1:55469/bimlog_rfi_test";
const { workflowGovernanceActorRoles, requireWorkflowPolicyRole } = await import("../src/lib/workflow-governance-role-authority");
const { pool } = await import("@workspace/db");
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
  console.log("C006 role authority: PASS (real PostgreSQL, company isolation, inactive membership, unknown role, explicit QC assignment, grant revocation, binding change, no super-admin role substitution).");
} finally { await client.end(); await pool.end(); }
