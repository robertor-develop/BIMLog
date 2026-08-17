import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FilesystemReceiverNonceAuthority, type ReceiverNonceAuthority } from "./receiver-service.js";

type Binding=Parameters<ReceiverNonceAuthority["reserve"]>[0];
const script=fileURLToPath(import.meta.url);
if(process.argv[2]==="--nonce-child"){
  const root=process.argv[3],binding=JSON.parse(Buffer.from(process.argv[4],"base64url").toString("utf8")) as Binding;
  const authority=new FilesystemReceiverNonceAuthority(root),reservation=await authority.reserve(binding);
  if(!reservation)throw new Error("nonce reservation denied");
  await authority.commit(reservation.token);
  process.stdout.write(JSON.stringify({status:reservation.status}));
  process.exit(0);
}

const disposable=path.join("F:\\BIMLog\\.disposable\\feedback-receiver-v2-tests",randomUUID()),root=path.join(disposable,"nonces");
fs.mkdirSync(root,{recursive:true});
const binding:Binding={audience:"receiver",keyId:"sender-key",nonce:"same-nonce",timestamp:"2026-08-17T15:00:00.000Z",requestId:"request-1",companyId:"company-1",projectId:"project-1",requestSha256:"a".repeat(64)};
let passed=0;
const check=async(name:string,work:()=>unknown|Promise<unknown>)=>{await work();passed++;console.log(`PASS ${passed}: ${name}`);};
const runChild=()=>new Promise<{status:string}>((resolve,reject)=>{const child=spawn(process.execPath,["--import","tsx",script,"--nonce-child",root,Buffer.from(JSON.stringify(binding)).toString("base64url")],{stdio:["ignore","pipe","pipe"]});const out:Buffer[]=[],err:Buffer[]=[];child.stdout.on("data",v=>out.push(v));child.stderr.on("data",v=>err.push(v));child.once("exit",code=>code===0?resolve(JSON.parse(Buffer.concat(out).toString("utf8"))):reject(new Error(Buffer.concat(err).toString("utf8")||`child exit ${code}`)));});

await check("20 processes serialize one canonical nonce identity",async()=>{
  const results=await Promise.all(Array.from({length:20},runChild));
  assert.equal(results.filter(value=>value.status==="new").length,1);
  assert.equal(results.filter(value=>value.status==="identical-retry").length,19);
  const records=fs.readdirSync(root).filter(name=>name.endsWith(".json"));assert.equal(records.length,1);
  const record=JSON.parse(fs.readFileSync(path.join(root,records[0]),"utf8"));assert.equal(record.version,2);assert.equal(record.state,"committed");assert.equal("token" in record,false);assert.match(record.tokenSha256,/^[a-f0-9]{64}$/);
});

await check("ownerless nonce lock is atomically quarantined and replaced",async()=>{
  const divergent={...binding,nonce:"ownerless",requestId:"request-ownerless",requestSha256:"b".repeat(64)},key=(new FilesystemReceiverNonceAuthority(root) as any).key(divergent) as string;
  fs.mkdirSync(path.join(root,`${key}.lock`));
  const authority=new FilesystemReceiverNonceAuthority(root),reservation=await authority.reserve(divergent);assert.ok(reservation);await authority.commit(reservation.token);assert.equal(fs.existsSync(path.join(root,`${key}.lock`)),false);
});

await check("stale fence substitution aborts the prior nonce owner",async()=>{
  const authority=new FilesystemReceiverNonceAuthority(root) as any,key="c".repeat(64);let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
  const operation=authority.locked(key,async(lease:{assertCurrent():void})=>{await held;lease.assertCurrent();});
  const ownerPath=path.join(root,`${key}.lock`,`owner.json`);while(!fs.existsSync(ownerPath))await new Promise(resolve=>setTimeout(resolve,2));const owner=JSON.parse(fs.readFileSync(ownerPath,"utf8"));owner.fence="d".repeat(64);fs.writeFileSync(ownerPath,JSON.stringify(owner));release();
  await assert.rejects(operation,(error:any)=>error?.code==="FEEDBACK_RECEIVER_FENCE_LOST");
});

fs.rmSync(disposable,{recursive:true,force:false});
console.log(`feedback receiver v2 process behavior: ${passed}/${passed}`);
