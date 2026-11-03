import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {downloadExactProcoreSource} from "./procore-version-source";
const selected={companyId:"31",ref:"file:700:120",versionId:"12",name:"Fixture.pdf"};
const bytes="old exact selected version";let calls:string[]=[];
let file:any={id:120,project_id:700,name:"Fixture.pdf",mime_type:"application/pdf",file_versions:[{id:13,url:"https://files.procore.com/latest"},{id:12}]};
let version:any={id:12,file_id:120,size:Buffer.byteLength(bytes),url:"https://files.procore.com/exact"};
const deps={token:async(userId:number,key:any)=>{assert.equal(userId,20);assert.equal(key,"procore");return "synthetic-token";},fetch:(async(url:any,init:any)=>{
 const value=String(url);calls.push(value);const headers=new Headers(init.headers);
 assert.equal(headers.get("authorization"),"Bearer synthetic-token");
 if(value.startsWith('https://api.procore.com/'))assert.equal(headers.get('Procore-Company-Id'),'31');
 if(value==='https://api.procore.com/rest/v1.0/files/120?project_id=700')return Response.json(file);
 if(value==='https://api.procore.com/rest/v1.0/file_versions/12?project_id=700')return Response.json(version);
 if(value==='https://files.procore.com/exact')return new Response(bytes);
 throw Error('UNPLANNED_REQUEST');
}) as typeof fetch};
const result=await downloadExactProcoreSource(20,selected,deps);assert.equal(result.buffer.toString(),bytes);assert.equal(result.versionId,'12');assert.equal(result.sha256,createHash('sha256').update(bytes).digest('hex'));assert.equal(calls.length,3);assert.equal(calls.some(v=>v.includes('latest')),false);
for(const patch of [{ref:'file:700:120:other'},{companyId:'bad'},{versionId:'bad'}]){calls=[];await assert.rejects(downloadExactProcoreSource(20,{...selected,...patch},deps),/EXACT_SELECTION_INVALID/);assert.equal(calls.length,0);}
for(const patch of [{id:121},{project_id:701},{name:'Changed.pdf'}]){const original=file;file={...file,...patch};await assert.rejects(downloadExactProcoreSource(20,selected,deps),/SOURCE_CHANGED/);file=original;}
const originalFile=file;file={...file,file_versions:[{id:13}]};await assert.rejects(downloadExactProcoreSource(20,selected,deps),/VERSION_UNAVAILABLE/);file=originalFile;
for(const patch of [{id:13},{file_id:121},{project_id:701}]){const original=version;version={...version,...patch};await assert.rejects(downloadExactProcoreSource(20,selected,deps),/VERSION_IDENTITY_MISMATCH/);version=original;}
version={...version,size:1};await assert.rejects(downloadExactProcoreSource(20,selected,deps),/VERSION_SIZE_MISMATCH/);
const validFile=file;file=null;await assert.rejects(downloadExactProcoreSource(20,selected,deps),/SOURCE_METADATA_INVALID/);file=validFile;
version=null;await assert.rejects(downloadExactProcoreSource(20,selected,deps),/SOURCE_METADATA_INVALID/);
await assert.rejects(downloadExactProcoreSource(20,selected,{...deps,fetch:async()=>new Response(null,{status:403})}),/SOURCE_HTTP_403/);
console.log(JSON.stringify({suite:'procore-exact-version-source',authorizedCompanyHeader:true,currentFileIdentity:true,selectedOlderVersion:true,noLatestSubstitution:true,exactBytesAndSha:true,changedAndMissingDenied:true,versionIdentityDenied:true,sizeMismatchDenied:true,canonicalWrites:0,externalCalls:0}));
