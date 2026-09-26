import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
const {Client}=createRequire(import.meta.url)("pg");
const schema="invitation_test_"+randomUUID().replaceAll("-","");
const admin=new Client({host:"127.0.0.1",port:55469,user:"postgres",database:"bimlog_rfi_test",connectionTimeoutMillis:3000});
await admin.connect();
await admin.query(`CREATE SCHEMA ${schema}`);
await admin.query(`SET search_path TO ${schema}`);
for(const table of ["companies","users","projects","project_members","project_invitations","config_options","company_master_catalog_administrators","activity_log"])
  await admin.query(`CREATE TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
process.env.PROD_DATABASE_URL=`postgresql://postgres@127.0.0.1:55469/bimlog_rfi_test?options=${encodeURIComponent('-csearch_path='+schema)}`;
const {pool}=await import("@workspace/db");
const {inviteOrAddProjectMember}=await import("../src/lib/project-invitation-service");
try {
  await admin.query(`INSERT INTO config_options(category,value,label,label_es,meta) VALUES
    ('member_role','project_admin','Admin','Admin','{"permission":"admin"}'),('member_role','read_only','Read','Lectura','{"permission":"read"}')`);
  const company=(await admin.query("INSERT INTO companies(name) VALUES('TEST invitation owner') RETURNING id")).rows[0].id;
  const owner=(await admin.query("INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES('owner@example.test','unused','TEST owner',$1,true) RETURNING id",[company])).rows[0].id;
  const ordinary=(await admin.query("INSERT INTO users(email,password_hash,full_name,company_id) VALUES('ordinary@example.test','unused','TEST ordinary',$1) RETURNING id",[company])).rows[0].id;
  const project=(await admin.query("INSERT INTO projects(name,code,status,created_by_id) VALUES('TEST invitations','TEST-INV','active',$1) RETURNING id",[owner])).rows[0].id;
  await assert.rejects(inviteOrAddProjectMember({projectId:project,invitedByUserId:ordinary,email:'recipient@example.test',role:'project_admin'}),/AUTHORITY_DENIED/);
  await assert.rejects(inviteOrAddProjectMember({projectId:project,invitedByUserId:owner,email:'recipient@example.test',role:'invented'}),/ROLE_INVALID/);
  const input={projectId:project,invitedByUserId:owner,email:'Recipient@example.test',role:'read_only',purpose:'company_join' as const};
  const first=await inviteOrAddProjectMember(input); assert.equal(first.kind,'invited'); if(first.kind!=='invited')throw new Error('fixture');
  const second=await inviteOrAddProjectMember(input); if(second.kind!=='invited')throw new Error('fixture');
  assert.equal(second.row.id,first.row.id);assert.notEqual(second.token,first.token);assert.notEqual(second.row.tokenHash,first.row.tokenHash);
  assert.equal(second.row.purpose,'company_join');assert.equal(second.row.deliveryStatus,'not_sent');
  assert.equal((await admin.query('SELECT count(*)::int n FROM project_members')).rows[0].n,0);
  console.log('I007 PostgreSQL: current inviter authority, invalid role denial, normalized recipient, resend rotation, no premature membership PASS');
} finally {
  await pool.end();
  await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();
}
