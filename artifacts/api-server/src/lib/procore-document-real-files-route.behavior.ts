import assert from "node:assert/strict";
import express from "express";
import {randomUUID,createHash} from "node:crypto";
import path from "node:path";
const target=new URL(process.env.PROD_DATABASE_URL??"postgres://invalid/invalid");if(target.hostname!=="127.0.0.1"||target.port!=="55439"||target.pathname!=="/bimlog_rfi_restore_test")throw Error("Owned restored fixture required");
const marker='procore-real-files-'+randomUUID();process.env.JWT_SECRET='procore-real-files-fixture-only';process.env.BIMLOG_FEEDBACK_STORAGE_BACKEND='local-test';process.env.BIMLOG_FEEDBACK_UPLOAD_ROOT=path.join('C:/Users/soporte/Documents/Codex/2026-10-27/bimlog-main-04-06/outputs',marker);
const {pool}=await import('@workspace/db'),{default:router}=await import('../routes/files'),{signToken}=await import('../middlewares/auth');
const company=Number((await pool.query('INSERT INTO companies(name) VALUES($1) RETURNING id',[marker])).rows[0].id);
const actor=(await pool.query("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'unused',$2,$3) RETURNING id,email",[marker+'@example.test',marker,company])).rows[0];
const project=Number((await pool.query("INSERT INTO projects(code,name,status,created_by_id) VALUES($1,$1,'active',$2) RETURNING id",[marker,actor.id])).rows[0].id);
await pool.query("INSERT INTO config_options(category,value,label,label_es,meta) VALUES('member_role',$1,$1,$1,'{\"permission\":\"write\"}')",[marker]);await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active')",[project,actor.id,marker]);await pool.query("INSERT INTO config_options(category,value,label,label_es) SELECT 'file_status','fixture-imported','Fixture imported','Prueba importada' WHERE NOT EXISTS(SELECT 1 FROM config_options WHERE category='file_status')");
await pool.query("INSERT INTO project_company_binding_versions(id,project_id,company_id,version,bound_by_id,reason_code,explanation_en,explanation_es,audit_evidence) VALUES($1,$2,$3,1,$4,'AUTHENTICATED_PROJECT_CREATION','Controlled import fixture','Prueba','{}')",[randomUUID(),project,company,actor.id]);
await pool.query("INSERT INTO company_provider_approval_events(event_key,company_id,provider_key,operation,enabled,reason,source) VALUES($1,$2,'procore','*',true,'Controlled real router import','owner_instruction')",[marker,company]);
await pool.query("INSERT INTO user_connections(user_id,provider,kind,status,credentials) VALUES($1,'procore','file_source','connected',$2::jsonb)",[actor.id,JSON.stringify({accessToken:'synthetic-actor-token'})]);
const convention=Number((await pool.query("INSERT INTO naming_conventions(project_id,separator,is_active) VALUES($1,'-',true) RETURNING id",[project])).rows[0].id);await pool.query("INSERT INTO naming_fields(convention_id,label,field_order,allowed_values) VALUES($1,'Prefix',1,'[\"FIX\"]'::json)",[convention]);
const bytes=Buffer.from('governed exact source bytes '+marker),sha=createHash('sha256').update(bytes).digest('hex');let providerRequests=0;const nativeFetch=globalThis.fetch;
globalThis.fetch=(async(url:any,init:any)=>{const value=String(url);if(value.startsWith('http://127.0.0.1:'))return nativeFetch(url,init);providerRequests++;const h=new Headers(init?.headers);if(value.startsWith('https://api.procore.com/')){assert.equal(h.get('Authorization'),'Bearer synthetic-actor-token');assert.equal(h.get('Procore-Company-Id'),'31');}
 if(value==='https://api.procore.com/rest/v1.0/files/120?project_id=700')return Response.json({id:120,project_id:700,name:'Original.txt',mime_type:'text/plain',file_versions:[{id:13},{id:12}]});
 if(value==='https://api.procore.com/rest/v1.0/file_versions/12?project_id=700')return Response.json({id:12,file_id:120,size:bytes.length,url:'https://files.procore.com/exact'});
 if(value==='https://files.procore.com/exact'){assert.equal(h.get('Authorization'),'Bearer synthetic-actor-token');return new Response(null,{status:302,headers:{location:'https://signed.example.test/source'}});}
 if(value==='https://signed.example.test/source'){assert.equal(h.has('Authorization'),false);return new Response(bytes);}
 throw Error('UNPLANNED_PROVIDER_REQUEST');}) as typeof fetch;
const app=express();app.use(express.json());app.use('/api/v1',router);let server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));let port=(server.address() as any).port;
const jwt=signToken({userId:actor.id,email:actor.email,companyId:company,companyName:marker,fullName:marker});
const request=async(suffix:string,body?:any)=>{const res=await fetch(`http://127.0.0.1:${port}/api/v1/projects/${project}/files/${suffix}`,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return res;};
try{
 const input={requestId:randomUUID(),sourceCompanyId:'31',ref:'file:700:120',versionId:'12',sourceName:'Original.txt',fileName:'Wrong.txt',relationship:'reference'};
 assert.equal((await request('procore/preview',input)).status,422);assert.equal(providerRequests,0,'Real naming rejection must precede provider retrieval');input.fileName='FIX.txt';
 const preview=await request('procore/preview',input);assert.equal(preview.status,200);const plan=await preview.json() as any;assert.equal(plan.preview.sha256,sha);assert.equal(providerRequests,4);
 const imported=await request('procore/import',{...input,expectedSha256:sha,confirmed:true});assert.equal(imported.status,201);const result=await imported.json() as any;assert.equal(providerRequests,8);
 const stored=(await pool.query('SELECT content_verification_result,file_hash FROM files WHERE id=$1',[result.receipt.fileId])).rows[0];assert.equal(stored.content_verification_result,'match');assert.equal(stored.file_hash,sha);
 const listing=await fetch(`http://127.0.0.1:${port}/api/v1/projects/${project}/files`,{headers:{Authorization:'Bearer '+jwt}});assert.equal(listing.status,200);const list=await listing.json() as any[];assert.ok(list.some(file=>file.id===result.receipt.fileId&&file.fileName==='FIX.txt'));assert.equal(JSON.stringify(list).includes(process.env.BIMLOG_FEEDBACK_UPLOAD_ROOT!),false);
 await new Promise<void>(r=>server.close(()=>r()));server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));port=(server.address() as any).port;
 const saved=await request(`procore/receipts/${input.requestId}`);assert.equal(saved.status,200);assert.equal(((await saved.json()) as any).receipt.fileId,result.receipt.fileId);
 const binary=await request(`${result.receipt.fileId}/download`);assert.equal(binary.status,200);assert.deepEqual(Buffer.from(await binary.arrayBuffer()),bytes);assert.equal(providerRequests,8,'Reopen and saved download never redownload from provider');
 console.log(JSON.stringify({suite:'procore-full-files-router-http',realNamingEnforced:true,currentActorConnection:true,exactOlderVersion:true,protectedTokenRedirectIsolation:true,realStorage:true,realFileProcessingCvrMatch:true,realDocumentsRegister:true,privateStorageExcluded:true,receiptReopen:true,authenticatedRealDownload:true,noProviderOnReopen:true,externalCalls:0}));
}finally{globalThis.fetch=nativeFetch;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await pool.end();}
