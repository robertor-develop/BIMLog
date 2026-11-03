import assert from "node:assert/strict";
import { downloadProcoreFileBytes } from "./procore-file-download";
const calls:Array<{url:string;headers:Headers}>=[];
const fixture = (responses:Response[]) => (async(url:any, init:any)=>{
  calls.push({url:String(url),headers:new Headers(init.headers)});
  assert.equal(init.redirect,"manual");
  assert.ok(init.signal instanceof AbortSignal);
  const response=responses.shift();assert.ok(response,"No unplanned fixture request");return response;
}) as typeof fetch;
const token="synthetic-fixture-token";
const bytes=await downloadProcoreFileBytes("https://files.procore.com/one",token,fixture([
  new Response(null,{status:302,headers:{location:"/two"}}),
  new Response(null,{status:307,headers:{location:"https://storage.example.test/signed"}}),
  new Response("exact fixture bytes"),
]));
assert.equal(bytes.toString(),"exact fixture bytes");
assert.equal(calls[0].headers.get("authorization"),`Bearer ${token}`);
assert.equal(calls[1].headers.get("authorization"),`Bearer ${token}`);
assert.equal(calls[2].headers.has("authorization"),false,"Token must not leave Procore domains");
for(const host of ["procore.com.evil.test","evilprocore.com"]){
 calls.length=0;await downloadProcoreFileBytes(`https://${host}/file`,token,fixture([new Response("fixture")]));
 assert.equal(calls[0].headers.has("authorization"),false);
}
calls.length=0;
await assert.rejects(downloadProcoreFileBytes("http://files.procore.com/one",token,fixture([])),/URL_INVALID/);assert.equal(calls.length,0);
await assert.rejects(downloadProcoreFileBytes("https://user:pass@files.procore.com/one",token,fixture([])),/URL_INVALID/);
await assert.rejects(downloadProcoreFileBytes("https://files.procore.com/one",token,fixture([new Response(null,{status:302})])),/REDIRECT_INVALID/);
await assert.rejects(downloadProcoreFileBytes("https://files.procore.com/one",token,fixture(Array.from({length:6},()=>new Response(null,{status:302,headers:{location:"/loop"}})))),/REDIRECT_INVALID/);
await assert.rejects(downloadProcoreFileBytes("https://files.procore.com/one",token,fixture([new Response(null,{status:403})])),/HTTP_403/);
await assert.rejects(downloadProcoreFileBytes("https://files.procore.com/one",token,fixture([new Response("large",{headers:{"content-length":"51"}})]),50),/TOO_LARGE/);
await assert.rejects(downloadProcoreFileBytes("https://files.procore.com/one",token,fixture([new Response("123456")]),5),/TOO_LARGE/);
await assert.rejects(downloadProcoreFileBytes("https://files.procore.com/one",token,fixture([new Response("")])),/EMPTY/);
await assert.rejects(downloadProcoreFileBytes("https://files.procore.com/one",token,fixture([]),0),/LIMIT_INVALID/);
await assert.rejects(downloadProcoreFileBytes("https://files.procore.com/one",token,fixture([new Response("partial",{status:206})])),/HTTP_206/);
console.log(JSON.stringify({suite:"procore-secure-file-download",protectedInitialAndRelativeRedirect:true,externalRedirectNoToken:true,lookalikeHostNoToken:true,redirectLimit:true,unsafeUrlDenied:true,providerDenialPreserved:true,declaredAndStreamSizeBound:true,emptyDenied:true,externalCalls:0}));
