import assert from "node:assert/strict";
import pg from "pg";
import {reconcileCompanyBindings} from "./company-identity-reconciliation";
const c=new pg.Client({host:"127.0.0.1",port:55469,user:"postgres",database:"postgres",connectionTimeoutMillis:3000});
await c.connect();
try {
  await c.query(`CREATE TEMP TABLE companies(id integer PRIMARY KEY,retired_into_company_id integer,retired_at timestamptz,is_public_profile boolean DEFAULT false);
    CREATE TEMP TABLE users(id integer PRIMARY KEY,email text,is_super_admin boolean,company_id integer);
    CREATE TEMP TABLE project_company_binding_versions(id text PRIMARY KEY,project_id integer,company_id integer,version integer,bound_by_id integer,reason_code text,explanation_en text,explanation_es text,supersedes_binding_id text,audit_evidence jsonb,UNIQUE(project_id,version));
    CREATE TEMP TABLE admin_actions_log(admin_user_id integer,admin_email text,action text,target_type text,target_id text,details jsonb);
    INSERT INTO companies(id) VALUES(31),(35),(38);
    INSERT INTO users VALUES(18,'test@example.test',true,31),(25,'member@example.test',false,31);
    INSERT INTO project_company_binding_versions(id,project_id,company_id,version) VALUES('original',36,35,1),('untouched',28,31,1);`);
  const plan={sourceCompanyId:35,targetCompanyId:31,actorId:18,reason:"TEST reconciliation",bindings:[{projectId:36,bindingId:"original",version:1}]};
  await assert.rejects(reconcileCompanyBindings(c,{...plan,actorId:25},true),/AUTHORITY/);
  await assert.rejects(reconcileCompanyBindings(c,{...plan,bindings:[{projectId:36,bindingId:"stale",version:1}]},true),/CHANGED/);
  assert.deepEqual((await reconcileCompanyBindings(c,plan)).changedProjectIds,[36]);
  assert.equal((await c.query('SELECT count(*)::int n FROM project_company_binding_versions')).rows[0].n,2);
  assert.deepEqual((await reconcileCompanyBindings(c,plan,true)).changedProjectIds,[36]);
  assert.deepEqual((await reconcileCompanyBindings(c,plan,true)).changedProjectIds,[]);
  assert.equal((await c.query('SELECT count(*)::int n FROM admin_actions_log')).rows[0].n,1);
  assert.equal((await c.query("SELECT company_id FROM project_company_binding_versions WHERE id='original'")).rows[0].company_id,35);
  assert.equal((await c.query("SELECT company_id FROM project_company_binding_versions WHERE id='untouched'")).rows[0].company_id,31);
  assert.equal((await c.query('SELECT retired_into_company_id FROM companies WHERE id=38')).rows[0].retired_into_company_id,null);
  console.log('I003 PostgreSQL: denial, stale guard, dry-run rollback, append-only correction, replay, untouched project/company PASS');
} finally {await c.end();}
