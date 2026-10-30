import assert from "node:assert/strict";
import express from "express";
import {randomUUID} from "node:crypto";
const target=new URL(process.env.PROD_DATABASE_URL??"postgres://invalid/invalid");
if(target.hostname!=="127.0.0.1"||target.port!=="55439"||target.pathname!=="/bimlog_master_catalog_test")throw new Error("Only guarded task fixture permitted");
process.env.JWT_SECRET="local-connections-fixture-only";
const {pool}=await import("@workspace/db"),{default:router}=await import("../routes/connections"),{signToken}=await import("../middlewares/auth");
await pool.query(`ALTER TABLE user_connections ADD COLUMN IF NOT EXISTS kind text,ADD COLUMN IF NOT EXISTS metadata jsonb,ADD COLUMN IF NOT EXISTS last_error text,ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now(),ADD COLUMN IF NOT EXISTS updated_at timestamp NOT NULL DEFAULT now()`);
const marker=`connection-${randomUUID()}`,company=(await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`,[marker])).rows[0];
const make=async(name:string)=>(await pool.query(`INSERT INTO users(email,full_name,company_id) VALUES($1,$2,$3) RETURNING id,email`,[`${marker}-${name}@example.test`,name,company.id])).rows[0];
const first=await make("first"),second=await make("second");
const jwt=(user:typeof first)=>signToken({userId:user.id,email:user.email,companyId:company.id,fullName:"Fixture",companyName:"Fixture",isSuperAdmin:false});
const app=express();app.use(express.json());app.use("/api/v1",router);const server=app.listen(0,"127.0.0.1");await new Promise<void>(resolve=>server.once("listening",resolve));const address=server.address();if(!address||typeof address==="string")throw new Error("Fixture bind failed");
const originalFetch=globalThis.fetch;let providerRequests=0,providerFailure=false;
globalThis.fetch=async(input,init)=>{const url=new URL(String(input));if(url.hostname==="www.googleapis.com"){providerRequests++;assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer synthetic-first-user-only");assert.equal(url.searchParams.get("pageSize"),"25");assert.match(url.searchParams.get("q")??"",/name contains/);return providerFailure?new Response("fixture unavailable",{status:503}):Response.json({files:[{id:"fixture-source",name:"Fixture source",mimeType:"application/pdf"}]});}if(url.hostname!=="127.0.0.1")throw new Error("No real external requests allowed");return originalFetch(input,init);};
const call=async(path:string,user=first,method="GET",body?:unknown)=>{const response=await fetch(`http://127.0.0.1:${address.port}/api/v1${path}`,{method,headers:{Authorization:`Bearer ${jwt(user)}`,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json() as Record<string,unknown>};};
try{
  assert.equal((await call("/me/connections/google-drive/files")).status,428);assert.equal(providerRequests,0);
  await pool.query(`INSERT INTO user_connections(user_id,provider,status,credentials) VALUES($1,'google_drive','connected',$2::jsonb)`,[first.id,JSON.stringify({accessToken:"synthetic-first-user-only"})]);
  const result=await call("/me/connections/google-drive/files?q=O%27Brien");assert.equal(result.status,200);assert.equal((result.body.files as unknown[]).length,1);assert.doesNotMatch(JSON.stringify(result.body),/synthetic-first|credentials|accessToken/);
  assert.equal((await call(`/me/connections/google-drive/files?userId=${first.id}`,second)).status,428);assert.equal(providerRequests,1);
  providerFailure=true;assert.equal((await call("/me/connections/google-drive/files?q=retry")).status,502);
  assert.equal((await call("/me/connections/anthropic",first,"PUT",{apiKey:"synthetic-rejected-only"})).status,410);
  const saved=await pool.query(`SELECT count(*)::integer n FROM user_connections WHERE user_id=$1 AND provider='anthropic'`,[first.id]);assert.equal(saved.rows[0].n,0);
  console.log("Own connections real HTTP with intercepted provider: unconnected428, exact own credentials only, user override denied, bound25, Google failure502, legacyAnthropic410/no key saved; real provider calls=0 PASS");
}finally{globalThis.fetch=originalFetch;await new Promise<void>(resolve=>server.close(()=>resolve()));await pool.query(`DELETE FROM user_connections WHERE user_id=ANY($1::integer[])`,[[first.id,second.id]]);await pool.query(`DELETE FROM users WHERE id=ANY($1::integer[])`,[[first.id,second.id]]);await pool.query(`DELETE FROM companies WHERE id=$1`,[company.id]);await pool.end();}
