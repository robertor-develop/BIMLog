import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const target=new URL(process.env.PROD_DATABASE_URL??"postgres://invalid/invalid");
if(target.hostname!=="127.0.0.1"||target.port!=="55439"||target.pathname!=="/bimlog_rfi_restore_test")throw Error("Owned restored fixture required");
const {pool}=await import("@workspace/db");
const {downloadCloud,browseCloud,getProcoreFileVersions}=await import("./cloud-files");
const marker="secure-download-"+randomUUID();
const company=Number((await pool.query("INSERT INTO companies(name) VALUES($1) RETURNING id",[marker])).rows[0].id);
const user=Number((await pool.query("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'unused',$2,$3) RETURNING id",[marker+"@example.test",marker,company])).rows[0].id);
const token="synthetic-download-fixture";
await pool.query("INSERT INTO user_connections(user_id,provider,kind,status,credentials) VALUES($1,'procore','file_source','connected',$2::jsonb)",[user,JSON.stringify({accessToken:token})]);
const original=globalThis.fetch;let calls=0,expectCompanyHeader=false;
try{
 globalThis.fetch=(async(url:any,init:any)=>{
  calls++;
  const value=String(url),auth=new Headers(init?.headers).get('authorization');
  if(value.startsWith("https://api.procore.com/")&&expectCompanyHeader)assert.equal(new Headers(init?.headers).get("Procore-Company-Id"),"31");
  if(value==="https://api.procore.com/rest/v1.0/projects?company_id=31")return Response.json([{id:700,name:"Project"}]);
  if(value==="https://api.procore.com/rest/v1.0/folders?project_id=700")return Response.json({folders:[{id:55,name:"Folder"}],files:[]});
  if(value==="https://api.procore.com/rest/v1.0/folders?project_id=700&folder_id=55")return Response.json({folders:[],files:[{id:120,name:"Fixture.pdf",file_versions:[{id:12}]}]});
  if(value==='https://api.procore.com/rest/v1.0/files/120?project_id=700'){
   assert.equal(auth,'Bearer '+token);return Response.json({id:120,project_id:700,name:"Fixture.pdf",file_versions:[{id:12,url:'https://files.procore.com/protected'}]});
  }
  if(value==='https://files.procore.com/protected'){
   assert.equal(auth,'Bearer '+token,'Protected Procore content requires the current actor token');assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://blob.example.test/signed'}});
  }
  if(value==='https://blob.example.test/signed'){
   assert.equal(auth,null,'No actor token may be forwarded outside Procore');return new Response('retained source bytes');
  }
  throw Error('UNPLANNED_EXTERNAL_REQUEST');
 }) as typeof fetch;
 const result=await downloadCloud(user,'procore','file:700:120');assert.equal(result.buffer.toString(),'retained source bytes');assert.equal(calls,3);
 expectCompanyHeader=true;
 assert.equal((await browseCloud(user,'procore','company:31','')).items[0].ref,'project:31:700');
 assert.equal((await browseCloud(user,'procore','project:31:700','')).items[0].ref,'folder:31:700:55');
 assert.equal((await browseCloud(user,'procore','folder:31:700:55','')).items[0].ref,'file:700:120');
 assert.equal((await getProcoreFileVersions(user,'file:700:120','31')).versions[0].id,'12');
 const beforeInvalid=calls;await assert.rejects(getProcoreFileVersions(user,'file:700:120','bad'),/SOURCE_COMPANY_INVALID/);assert.equal(calls,beforeInvalid);
 const count=Number((await pool.query('SELECT count(*) n FROM files WHERE uploaded_by_id=$1',[user])).rows[0].n);assert.equal(count,0,'Download does not claim or create canonical imports');
 console.log(JSON.stringify({suite:'procore-download-real-dispatch',currentActorConnection:true,metadataAuthorized:true,companyProjectFolderHeaders:true,opaqueFolderCompanyContext:true,versionLookupCompanyHeader:true,protectedDownloadAuthorized:true,redirectTokenIsolated:true,sourceBytesExact:true,canonicalWrites:0,externalCalls:0}));
}finally{globalThis.fetch=original;await pool.end();}
