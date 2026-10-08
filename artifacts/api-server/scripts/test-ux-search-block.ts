import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const { Client } = createRequire(import.meta.url)("pg");
const schema = `ux_search_${randomUUID().replaceAll("-", "")}`;
const fixture = new Client({host:"127.0.0.1",port:55469,user:"postgres",database:"bimlog_rfi_test",connectionTimeoutMillis:3000});
await fixture.connect();
await fixture.query(`CREATE SCHEMA ${schema}`);
await fixture.query(`SET search_path TO ${schema}`);
for (const table of ["companies","users","projects","project_members","project_directory","company_profiles","config_options","activity_log","company_master_catalog_administrators","company_master_catalog_policies","company_master_catalog_entries","project_company_binding_versions","files","rfis","submittals","transmittals","change_orders","meeting_minutes","action_items"]) {
  await fixture.query(`CREATE TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
}
await fixture.query("ALTER TABLE companies ADD COLUMN IF NOT EXISTS retired_into_company_id integer, ADD COLUMN IF NOT EXISTS retired_at timestamptz");
process.env.PROD_DATABASE_URL = `postgresql://postgres@127.0.0.1:55469/bimlog_rfi_test?options=${encodeURIComponent('-csearch_path='+schema)}`;
delete process.env.SENDGRID_API_KEY;
const {pool} = await import("@workspace/db");
const {default:express} = await import("express");
const {default:directory} = await import("../src/routes/search");
const {default:profile} = await import("../src/routes/company-profile");
const {signToken} = await import("../src/middlewares/auth");
const app=express(); app.use(express.json()); app.use(directory);
const server=app.listen(0,"127.0.0.1");
await new Promise<void>(resolve=>server.once("listening",resolve));
const address=server.address(); if (!address || typeof address === "string") throw new Error("Fixture listener missing");
const request=async(path:string,token:string,body?:unknown)=>{
  const response=await fetch(`http://127.0.0.1:${address.port}${path}`,{method:body===undefined?"GET":"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,body:await response.json()};
};
try {
  const company=(await fixture.query("INSERT INTO companies(name) VALUES('TEST UX owner') RETURNING id")).rows[0].id;
  const otherCompany=(await fixture.query("INSERT INTO companies(name) VALUES('TEST UX unrelated') RETURNING id")).rows[0].id;
  const owner=(await fixture.query("INSERT INTO users(email,password_hash,full_name,company_id) VALUES('ux-owner@example.test','unused','UX owner',$1) RETURNING id",[company])).rows[0].id;
  const outsider=(await fixture.query("INSERT INTO users(email,password_hash,full_name,company_id) VALUES('ux-outsider@example.test','unused','UX outsider',$1) RETURNING id",[otherCompany])).rows[0].id;
  const project=(await fixture.query("INSERT INTO projects(name,code,status,created_by_id) VALUES('TEST UX parties','TEST-UX-P','active',$1) RETURNING id",[owner])).rows[0].id;
  await fixture.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'project_admin','active')",[project,owner]);
  const token=signToken({userId:owner,email:"ux-owner@example.test",fullName:"UX owner",companyId:company,companyName:"TEST UX owner"});
  const outsiderToken=signToken({userId:outsider,email:"ux-outsider@example.test",fullName:"UX outsider",companyId:otherCompany,companyName:"TEST UX unrelated"});
  const result=await request("/search?q=TEST-UX-P",token); assert.equal(result.status,200,JSON.stringify(result.body)); assert.equal(result.body.projects.length,1); assert.equal(result.body.projects[0].id,project);
  const unrelated=await request("/search?q=TEST-UX-P",outsiderToken); assert.equal(unrelated.body.projects.length,0);
  assert.equal((await request("/search?q=TEST&projectId=-1",token)).status,400);
  assert.equal((await request("/search?q=TEST&projectId=999999",token)).body.projects.length,0);
  await fixture.query("UPDATE project_members SET status='inactive' WHERE user_id=$1",[owner]);
  const inactive=await request("/search?q=TEST-UX-P",token); assert.equal(inactive.body.projects.length,0); assert.equal(inactive.body.people.length,0);
  console.log(`UX_SEARCH_API=PASS schema=${schema}: project code, active scope, outsider denial, invalid scope and revoked membership`);
} finally { await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve())); await pool.end(); await fixture.end(); }
