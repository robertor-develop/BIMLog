import assert from "node:assert/strict";
import express from "express";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { writeFileSync } from "node:fs";
const url = new URL(process.env.PROD_DATABASE_URL ?? "postgres://invalid/invalid");
if(url.hostname!=="127.0.0.1"||url.port!=="55439"||url.pathname!=="/bimlog_p150_fixture_02")throw Error("Full isolated local fixture required");
process.env.JWT_SECRET="p176-fixture-only";
const {pool}=await import("@workspace/db");
const {default:router}=await import("../routes/meeting_minutes");
const {signToken}=await import("../middlewares/auth");
const mark="p176-"+randomUUID();
const insert=async(sql:string,args:unknown[])=>Number((await pool.query(sql,args)).rows[0].id);
const company=await insert("INSERT INTO companies(name) VALUES($1) RETURNING id",[mark]);
const foreignCompany=await insert("INSERT INTO companies(name) VALUES($1) RETURNING id",[mark+"-foreign"]);
const user=async(name:string,cid=company)=>{const row=(await pool.query("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'unused',$2,$3) RETURNING id,email",[mark+name+"@example.test",name,cid])).rows[0];return {...row,companyId:cid};};
const owner=await user("owner"),foreign=await user("foreign",foreignCompany);
const project=await insert("INSERT INTO projects(code,name,status,created_by_id) VALUES($1,$1,'active',$2) RETURNING id",[mark,owner.id]);
const other=await insert("INSERT INTO projects(code,name,status,created_by_id) VALUES($1,$1,'active',$2) RETURNING id",[mark+"other",owner.id]);
const meeting=await insert("INSERT INTO meeting_minutes(project_id,title,meeting_date,notes,created_by_id) VALUES($1,$2,'2026-09-10','=HYPERLINK(known-text)',$3) RETURNING id",[project,"Coordinación ñ "+mark,owner.id]);
await pool.query("INSERT INTO meeting_minutes(project_id,title,meeting_date,created_by_id,deleted_at) VALUES($1,'Deleted secret','2026-09-11',$2,now()),($3,'Other project secret','2026-09-11',$2,NULL)",[project,owner.id,other]);
await pool.query("INSERT INTO action_items(project_id,meeting_id,description,status) VALUES($1,$2,'Open review ñ','open'),($1,$2,'Cancelled secret','cancelled')",[project,meeting]);
await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'member','active')",[project,foreign.id]);
const jwt=(u:typeof owner)=>signToken({userId:u.id,email:u.email,companyId:u.companyId,companyName:mark,fullName:"Fixture"});
const app=express();app.use("/api/v1",router);
const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));const port=(server.address() as any).port;
const get=(format:string,token?:string,query="",pid=project)=>fetch(`http://127.0.0.1:${port}/api/v1/projects/${pid}/meetings/current-view/${format}?${query}`,{headers:token?{Authorization:`Bearer ${token}`}:{}});
try{
 for(const format of ["pdf","xlsx"]){assert.equal((await get(format)).status,401);assert.equal((await get(format,jwt(foreign))).status,403,"Active membership from foreign company must not export "+format);}
 for(const role of ["member","finance","project_admin","company_admin"]){const actor=await user(role);await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active')",[project,actor.id,role]);for(const format of ["pdf","xlsx"]){const res=await get(format,jwt(actor));assert.equal(res.status,200,role+" "+format);assert.equal(res.headers.get("cache-control"),"private, no-store");assert.equal(res.headers.get("x-bimlog-project-id"),String(project));const bytes=Buffer.from(await res.arrayBuffer());if(format==="pdf"){assert.equal(bytes.subarray(0,5).toString(),"%PDF-");if(process.env.MEETING_EXPORT_EVIDENCE_DIR)writeFileSync(process.env.MEETING_EXPORT_EVIDENCE_DIR+"/meetings.pdf",bytes);}else{const book=XLSX.read(bytes,{type:"buffer",cellFormula:true});assert.deepEqual(book.SheetNames,["Meetings","Actions","Activity History"]);const data=XLSX.utils.sheet_to_json<any[]>(book.Sheets.Meetings,{header:1});assert.equal(data.length,3);assert.equal(data[2][1],"Coordinación ñ "+mark);assert.equal(book.Sheets.Meetings.D3.f,undefined);assert.equal(book.Sheets.Meetings.D3.t,"s");assert.equal(XLSX.utils.sheet_to_json(book.Sheets.Actions,{header:1}).length,3);if(process.env.MEETING_EXPORT_EVIDENCE_DIR)writeFileSync(process.env.MEETING_EXPORT_EVIDENCE_DIR+"/meetings.xlsx",bytes);}assert.equal((await get(format,jwt(actor),"",other)).status,403);assert.equal((await get(format,jwt(actor),"from=2026-10-01&to=2026-09-01")).status,400);}
 const empty=await get("xlsx",jwt(actor),"q=NO_MATCH");const emptyBook=XLSX.read(Buffer.from(await empty.arrayBuffer()),{type:"buffer"});assert.equal(XLSX.utils.sheet_to_json(emptyBook.Sheets.Meetings,{header:1}).length,2);
 await pool.query("UPDATE project_members SET status='inactive' WHERE project_id=$1 AND user_id=$2",[project,actor.id]);for(const format of ["pdf","xlsx"])assert.equal((await get(format,jwt(actor))).status,403);
 }
 assert.equal(Number((await pool.query("SELECT count(*) FROM meeting_minutes WHERE project_id=$1",[project])).rows[0].count),2);
 console.log(JSON.stringify({suite:"P176-real-http",roles:4,formats:2,foreignCompanyDenied:true,inactiveDenied:true,otherProjectDenied:true,exactNativeArtifacts:true,literalFormulaSafe:true,unicode:true,filtersAndEmpty:true,noMutation:true}));
}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
