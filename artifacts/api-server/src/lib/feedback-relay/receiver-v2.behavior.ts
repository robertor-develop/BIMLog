import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FeedbackReceiverCustodyService,FilesystemReceiverNonceAuthority, type ReceiverNonceAuthority,type ReceiverFaultHooks } from "./receiver-service.js";
import {sha256,signRequest,type RelayKeyRing,type RequestContract} from "./protocol.js";

type Binding=Parameters<ReceiverNonceAuthority["reserve"]>[0];
const script=fileURLToPath(import.meta.url);
if(process.argv[2]==="--nonce-child"){
  const root=process.argv[3],binding=JSON.parse(Buffer.from(process.argv[4],"base64url").toString("utf8")) as Binding;
  const authority=new FilesystemReceiverNonceAuthority(root);let reservation;
  for(let attempt=0;attempt<1_000&&!reservation;attempt++){reservation=await authority.reserve(binding);if(!reservation)await new Promise(resolve=>setTimeout(resolve,2));}
  if(!reservation)throw new Error("nonce reservation denied");
  await authority.commit(reservation.token);
  process.stdout.write(JSON.stringify({status:reservation.status}));
  process.exit(0);
}
const now=new Date("2026-08-17T15:00:00.000Z"),ring=(id:string,secret:string):RelayKeyRing=>({activeKeyId:id,keys:[{id,secret:Buffer.from(secret),status:"active",notBefore:new Date("2026-01-01T00:00:00.000Z"),notAfter:new Date("2027-01-01T00:00:00.000Z")}]}),sender=ring("sender-key","sender-0123456789abcdef0123456789"),receiver=ring("receiver-key","receiver-0123456789abcdef01234567"),deliveryBytes=Buffer.from("multiprocess crash custody bytes");
const deliveryRequest:RequestContract={version:"1",method:"PUT",path:"/v1/objects/crash",query:"",audience:"receiver",keyId:"sender-key",timestamp:now.toISOString(),nonce:"crash-nonce",requestId:"crash-request",companyId:"crash-company",projectId:"crash-project",feedbackId:"FB-CRASH",objectId:"crash-object",byteCount:deliveryBytes.length,sha256:sha256(deliveryBytes),bodySha256:sha256(deliveryBytes)};
const inspection={verdict:"clean" as const,scannerAdapter:"crash-malware-scanner",inspectedAt:now.toISOString(),inspectedMediaType:"application/pdf",mediaKind:"document" as const,byteCount:deliveryBytes.length,sha256:sha256(deliveryBytes)};
if(process.argv[2]==="--delivery-crash-child"){
  const receiverRoot=process.argv[3],nonceRoot=process.argv[4],boundary=process.argv[5] as keyof ReceiverFaultHooks,authority={canonicalRoot:receiverRoot,rootFingerprintSha256:FeedbackReceiverCustodyService.fingerprintRoot(receiverRoot),destinationId:"receiver-crash"},faults:{[key:string]:()=>never}={[boundary]:()=>process.exit(70)};
  const service=new FeedbackReceiverCustodyService(authority,sender,receiver,new FilesystemReceiverNonceAuthority(nonceRoot),30_000,faults);await service.deliver({signedRequest:signRequest(deliveryRequest,sender,now),bytes:deliveryBytes,inspection,now});if(boundary==="afterDeletionPrepared")service.purge(deliveryRequest.requestId,{policySha256:"9".repeat(64),approvedBy:"crash-operator",approvedAt:now.toISOString(),hold:false},now);process.exit(0);
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

await check("expired same-PID owner with mismatched process identity is treated as PID reuse",async()=>{
  const authority=new FilesystemReceiverNonceAuthority(root) as any,probe="e".repeat(64);let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve});const active=authority.locked(probe,async()=>{await held;});const probeOwner=path.join(root,`${probe}.lock`,`owner.json`);while(!fs.existsSync(probeOwner))await new Promise(resolve=>setTimeout(resolve,2));const owner=JSON.parse(fs.readFileSync(probeOwner,"utf8"));release();await active;
  const reused="f".repeat(64),lock=path.join(root,`${reused}.lock`);fs.mkdirSync(lock);fs.writeFileSync(path.join(lock,"owner.json"),JSON.stringify({...owner,instanceId:randomUUID(),processStartedAt:"2020-01-01T00:00:00.000Z",acquiredAt:"2020-01-01T00:00:00.000Z",heartbeatAt:"2020-01-01T00:00:00.000Z",leaseUntil:"2020-01-01T00:00:01.000Z",fence:"1".repeat(64)}));let acquired=false;await authority.locked(reused,async()=>{acquired=true;});assert.equal(acquired,true);
});

await check("expired owner with matching live process identity remains fail closed",async()=>{
  const authority=new FilesystemReceiverNonceAuthority(root) as any,probe="2".repeat(64);let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve});const active=authority.locked(probe,async()=>{await held;});const probeOwner=path.join(root,`${probe}.lock`,`owner.json`);while(!fs.existsSync(probeOwner))await new Promise(resolve=>setTimeout(resolve,2));const owner=JSON.parse(fs.readFileSync(probeOwner,"utf8"));release();await active;
  const identity="3".repeat(64),lock=path.join(root,`${identity}.lock`);fs.mkdirSync(lock);fs.writeFileSync(path.join(lock,"owner.json"),JSON.stringify({...owner,acquiredAt:"2020-01-01T00:00:00.000Z",heartbeatAt:"2020-01-01T00:00:00.000Z",leaseUntil:"2020-01-01T00:00:01.000Z"}));await assert.rejects(authority.locked(identity,async()=>undefined),(error:any)=>error?.code==="FEEDBACK_RECEIVER_LOCK_TIMEOUT");fs.rmSync(lock,{recursive:true,force:false});
});

await check("kill and restart reconciles nonce object generation and index boundaries",async()=>{
  for(const boundary of ["afterNonceReserved","afterObjectWritten","afterGenerationWritten","afterIndexWritten","afterDeletionPrepared"] as const){const caseRoot=path.join(disposable,`crash-${boundary}`),receiverRoot=path.join(caseRoot,"receiver"),nonceRoot=path.join(caseRoot,"nonces");fs.mkdirSync(receiverRoot,{recursive:true});fs.mkdirSync(nonceRoot,{recursive:true});
    const exitCode=await new Promise<number|null>((resolve,reject)=>{const child=spawn(process.execPath,["--import","tsx",script,"--delivery-crash-child",receiverRoot,nonceRoot,boundary],{stdio:["ignore","ignore","pipe"]});const errors:Buffer[]=[];child.stderr.on("data",value=>errors.push(value));child.once("error",reject);child.once("exit",code=>{if(code!==70)reject(new Error(Buffer.concat(errors).toString("utf8")||`unexpected crash exit ${code}`));else resolve(code);});});assert.equal(exitCode,70);
    const authority={canonicalRoot:receiverRoot,rootFingerprintSha256:FeedbackReceiverCustodyService.fingerprintRoot(receiverRoot),destinationId:"receiver-crash"},service=new FeedbackReceiverCustodyService(authority,sender,receiver,new FilesystemReceiverNonceAuthority(nonceRoot),30_000);const receipt=await service.deliver({signedRequest:signRequest(deliveryRequest,sender,now),bytes:deliveryBytes,inspection,now});assert.equal(receipt.payload.requestId,deliveryRequest.requestId);assert.equal((await service.readbackAsync(deliveryRequest.requestId,now)).payload.sha256,deliveryRequest.sha256);service.recover();if(boundary==="afterDeletionPrepared")assert.equal((await service.purgeAsync(deliveryRequest.requestId,{policySha256:"9".repeat(64),approvedBy:"crash-operator",approvedAt:now.toISOString(),hold:false},now)).absenceVerified,true);assert.equal(fs.readdirSync(path.join(receiverRoot,"99-System","staging")).length,0);
  }
});

await check("write fsync and rename faults leave no atomic residue and permit exact retry",async()=>{
  for(const operation of ["writeFileSync","fsyncSync","renameSync"] as const){
    const caseRoot=path.join(disposable,`io-${operation}`),receiverRoot=path.join(caseRoot,"receiver"),nonceRoot=path.join(caseRoot,"nonces");fs.mkdirSync(receiverRoot,{recursive:true});fs.mkdirSync(nonceRoot,{recursive:true});
    const request={...deliveryRequest,nonce:`${operation}-nonce`,requestId:`${operation}-request`,objectId:`${operation}-object`,path:`/v1/objects/${operation}`},signedRequest=signRequest(request,sender,now),authority={canonicalRoot:receiverRoot,rootFingerprintSha256:FeedbackReceiverCustodyService.fingerprintRoot(receiverRoot),destinationId:"receiver-io"};let armed=false,failed=false;
    const original=fs[operation] as (...args:any[])=>any;(fs as any)[operation]=(...args:any[])=>{if(armed&&!failed){failed=true;throw Object.assign(new Error(`injected ${operation}`),{code:"EIO"});}return original(...args);};
    try{const service=new FeedbackReceiverCustodyService(authority,sender,receiver,new FilesystemReceiverNonceAuthority(nonceRoot),30_000,{afterObjectWritten:()=>{armed=true;}});await assert.rejects(service.deliver({signedRequest,bytes:deliveryBytes,inspection,now}),/injected/);}finally{(fs as any)[operation]=original;}
    assert.equal(failed,true);const residues:string[]=[];const inspect=(dir:string)=>{if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const target=path.join(dir,entry.name);if(entry.isDirectory())inspect(target);else if(entry.name.startsWith(".stage-"))residues.push(target);}};inspect(receiverRoot);inspect(nonceRoot);assert.deepEqual(residues,[]);
    const retry=new FeedbackReceiverCustodyService(authority,sender,receiver,new FilesystemReceiverNonceAuthority(nonceRoot),30_000),receipt=await retry.deliver({signedRequest,bytes:deliveryBytes,inspection,now});assert.equal(receipt.payload.requestId,request.requestId);assert.equal((await retry.readbackAsync(request.requestId,now)).payload.sha256,request.sha256);
  }
});

await check("unlink failure preserves prepared proof and exact purge retry finalizes cleanly",async()=>{
  const caseRoot=path.join(disposable,"io-unlinkSync"),receiverRoot=path.join(caseRoot,"receiver"),nonceRoot=path.join(caseRoot,"nonces");fs.mkdirSync(receiverRoot,{recursive:true});fs.mkdirSync(nonceRoot,{recursive:true});const request={...deliveryRequest,nonce:"unlink-nonce",requestId:"unlink-request",objectId:"unlink-object",path:"/v1/objects/unlink"},authority={canonicalRoot:receiverRoot,rootFingerprintSha256:FeedbackReceiverCustodyService.fingerprintRoot(receiverRoot),destinationId:"receiver-io"},service=new FeedbackReceiverCustodyService(authority,sender,receiver,new FilesystemReceiverNonceAuthority(nonceRoot),30_000);await service.deliver({signedRequest:signRequest(request,sender,now),bytes:deliveryBytes,inspection,now});
  const original=fs.unlinkSync,objectPath=path.join(receiverRoot,"01-Active",sha256(request.companyId).slice(0,16),sha256(request.projectId).slice(0,16),sha256(request.feedbackId).slice(0,16),sha256(request.objectId).slice(0,16),request.sha256);let failed=false;(fs as any).unlinkSync=(target:string,...args:any[])=>{if(!failed&&path.resolve(target)===path.resolve(objectPath)){failed=true;throw Object.assign(new Error("injected unlinkSync"),{code:"EIO"});}return (original as any)(target,...args);};try{await assert.rejects(service.purgeAsync(request.requestId,{policySha256:"9".repeat(64),approvedBy:"crash-operator",approvedAt:now.toISOString(),hold:false},now),/injected unlinkSync/);}finally{(fs as any).unlinkSync=original;}assert.equal(fs.existsSync(objectPath),true);assert.equal((await service.purgeAsync(request.requestId,{policySha256:"9".repeat(64),approvedBy:"crash-operator",approvedAt:now.toISOString(),hold:false},now)).absenceVerified,true);assert.equal(fs.existsSync(objectPath),false);
});

fs.rmSync(disposable,{recursive:true,force:false});
console.log(`feedback receiver v2 process behavior: ${passed}/${passed}`);
