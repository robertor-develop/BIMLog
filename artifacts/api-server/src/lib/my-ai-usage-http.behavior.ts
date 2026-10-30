import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
const target=new URL(process.env.PROD_DATABASE_URL??"postgres://invalid/invalid");
if(target.hostname!=="127.0.0.1"||target.port!=="55439"||target.pathname!=="/bimlog_master_catalog_test")throw new Error("Only the task-created local AI usage fixture is permitted");
process.env.JWT_SECRET="local-ai-usage-fixture-only";
delete process.env.ANTHROPIC_API_KEY;delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
process.env.BIMLOG_INCLUDED_AI_MONTHLY_LIMIT="25";
const {pool}=await import("@workspace/db");
const {default:router}=await import("../routes/connections");
const {signToken}=await import("../middlewares/auth");
await pool.query(`CREATE TABLE IF NOT EXISTS user_connections(id serial PRIMARY KEY,user_id integer NOT NULL,provider text NOT NULL,status text NOT NULL,account_label text,credentials jsonb)`);
await pool.query(`CREATE TABLE IF NOT EXISTS ai_usage_events(id serial PRIMARY KEY,user_id integer NOT NULL,billing_mode text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`);
const marker=`ai-usage-${randomUUID()}`;
const company=(await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`,[marker])).rows[0];
const createUser=async(name:string)=>(await pool.query(`INSERT INTO users(email,full_name,company_id) VALUES($1,$2,$3) RETURNING id,email`,[`${marker}-${name}@example.test`,name,company.id])).rows[0];
const first=await createUser("first"),second=await createUser("second");
const token=(user:typeof first)=>signToken({userId:user.id,email:user.email,companyId:company.id,fullName:"Fixture",companyName:"Fixture",isSuperAdmin:false});
const app=express();app.use(express.json());app.use("/api/v1",router);
const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));
const address=server.address();if(!address||typeof address==="string")throw new Error("Fixture bind failed");
const call=async(auth?:string,query="")=>{const response=await fetch(`http://127.0.0.1:${address.port}/api/v1/me/ai-usage${query}`,{headers:auth?{Authorization:`Bearer ${auth}`}:{}});return {status:response.status,body:await response.json() as Record<string,unknown>};};
try{
  assert.equal((await call()).status,401);
  await pool.query(`INSERT INTO ai_usage_events(user_id,billing_mode,created_at) VALUES($1,'included_platform',now()),($1,'included_platform',now()),($2,'included_platform',now()),($1,'included_platform',date_trunc('month',now())-interval '1 day'),($1,'user_key',now())`,[first.id,second.id]);
  let result=await call(token(first));assert.equal(result.status,200);assert.equal(result.body.mode,"setup_required");assert.equal(result.body.includedUsed,2);assert.equal(result.body.includedRemaining,23);
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY="synthetic-config-only-no-provider-call";
  result=await call(token(first),`?userId=${second.id}`);assert.equal(result.body.mode,"included_platform");assert.equal(result.body.includedUsed,2);
  assert.equal((await call(token(second))).body.includedUsed,1);
  process.env.BIMLOG_INCLUDED_AI_MONTHLY_LIMIT="2";assert.equal((await call(token(first))).body.mode,"limit_reached");assert.equal((await call(token(first))).body.includedRemaining,0);
  await pool.query(`INSERT INTO user_connections(user_id,provider,status,account_label,credentials) VALUES($1,'anthropic','connected','Synthetic own account',$2::jsonb)`,[first.id,JSON.stringify({apiKey:"must-never-return-fixture-secret"})]);
  result=await call(token(first));assert.equal(result.body.mode,"user_key");assert.equal(result.body.providerConnected,true);assert.equal(result.body.providerLabel,"Synthetic own account");assert.doesNotMatch(JSON.stringify(result.body),/must-never-return|credentials|apiKey/);
  console.log("Personal AI usage real HTTP: auth401, own-account isolation, ignored user override, UTC month and billing filter, setup/included/limit/own-provider modes, no secret exposure; provider calls=0 PASS");
}finally{
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  await pool.query(`DELETE FROM user_connections WHERE user_id=ANY($1::integer[])`,[[first.id,second.id]]);await pool.query(`DELETE FROM ai_usage_events WHERE user_id=ANY($1::integer[])`,[[first.id,second.id]]);await pool.query(`DELETE FROM users WHERE id=ANY($1::integer[])`,[[first.id,second.id]]);await pool.query(`DELETE FROM companies WHERE id=$1`,[company.id]);await pool.end();
}
