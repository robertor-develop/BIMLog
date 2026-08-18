import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  RelayProtocolError,
  canonicalRequest,
  canonicalReceipt,
  canonicalReadback,
  sha256,
  signReadback,
  signDeletionReceipt,
  signReceipt,
  verifyReceiptDurably,
  verifyDeletionReceiptDurably,
  verifyRequest,
  type NonceAuthority,
  type ReadbackContract,
  type DeletionReceiptContract,
  type ReceiptContract,
  type RelayKeyRing,
  type RequestContract,
  type Signed,
} from "./protocol.js";

export type ReceiverRootAuthority = {
  canonicalRoot: string;
  rootFingerprintSha256: string;
  destinationId: string;
};
export type ReceiverMediaKind =
  | "screenshot"
  | "audio"
  | "document"
  | "transcript"
  | "original";
export type ScannerInspection = {
  verdict: "clean";
  scannerAdapter: string;
  inspectedAt: string;
  inspectedMediaType: string;
  mediaKind: ReceiverMediaKind;
  byteCount: number;
  sha256: string;
};
export type StoredDelivery = {
  authorityVersion:3;
  requestHash: string;
  requestSignature: string;
  objectRelativePath: string;
  inspection: ScannerInspection;
  receipt: Signed<ReceiptContract>;
  directoryDurability: "fsync" | "rename-recovery";
  nonceRecovery?:{key:string;proofSha256:string};
  generation:number;
  authentication:{keyId:string;canonicalSha256:string;hmacSha256:string};
};
export type PurgeAuthority = {
  policySha256: string;
  approvedBy: string;
  approvedAt: string;
  hold: boolean;
};
export interface ReceiverPurgeCommandAuthority<TCommand>{verifyAndRevalidate(input:{requestId:string;command:TCommand;requestIndex:StoredDelivery;now:Date}):Promise<PurgeAuthority>;}
export type DeletionReceipt = {
  deletedAt: string;
  objectSha256: string;
  byteCount: number;
  policySha256: string;
  approvedBy: string;
  absenceVerified: true;
  absenceVerifiedAt:string;
  journalSha256:string;
  deliveryReceiptSha256:string;
  readbackSha256:string;
  signed: Signed<DeletionReceiptContract>;
};
type PreparedDeletion = Omit<DeletionReceipt, "absenceVerified"|"absenceVerifiedAt"|"deletedAt"|"signed"> & {
  absenceVerified: false;
  requestId:string;companyId:string;projectId:string;feedbackId:string;objectId:string;destinationId:string;approvedAt:string;
};
type DeletionJournal =
  | {
      state: "prepared";
      authorityVersion:3;
      requestId: string;
      objectRelativePath: string;
      receipt: PreparedDeletion;
      generation:number;
      authentication:{keyId:string;canonicalSha256:string;hmacSha256:string};
    }
  | {
      state: "finalized";
      authorityVersion:3;
      requestId: string;
      objectRelativePath: string;
      receipt: DeletionReceipt;
      generation:number;
      authentication:{keyId:string;canonicalSha256:string;hmacSha256:string};
    };
export type BackupInventory = {
  createdAt: string;
  sourceRootFingerprintSha256: string;
  objects: readonly {
    relativePath: string;
    byteCount: number;
    sha256: string;
  }[];
  inventorySha256: string;
};
export type SignedBackupManifestV2={version:2;createdAt:string;sourceRootFingerprintSha256:string;generation:number;objects:BackupInventory["objects"];manifestSha256:string;authentication:{keyId:string;hmacSha256:string}};
export type NonceReservation = {
  token: string;
  status: "new" | "identical-retry";
};
export interface ReceiverNonceAuthority {
  reserve(input: {
    audience: string;
    keyId: string;
    nonce: string;
    timestamp: string;
    requestId: string;
    companyId: string;
    projectId: string;
    requestSha256: string;
  }): Promise<NonceReservation | null>;
  commit(token: string): Promise<void>;
  rollback(token: string): Promise<void>;
  recover?(input:{key:string;proofSha256:string}):Promise<boolean>;
}
type DurableNonceRecord={version:2;binding:{audience:string;keyId:string;nonce:string;timestamp:string;requestId:string;companyId:string;projectId:string;requestSha256:string};state:"reserved"|"committed";tokenSha256:string;owner?:LockOwnerV2};
export class FilesystemReceiverNonceAuthority implements ReceiverNonceAuthority{
  private readonly root:string;
  constructor(root:string){this.root=canonicalRoot(root);if(!fs.existsSync(this.root)||!fs.statSync(this.root).isDirectory())fail("FEEDBACK_RECEIVER_NONCE_ROOT_REQUIRED","Nonce authority root must already exist");assertNoLinks(this.root,this.root);if(fs.lstatSync(this.root).isSymbolicLink())fail("FEEDBACK_RECEIVER_REPARSE_DENIED","Nonce authority root cannot be a link");}
  private key(input:DurableNonceRecord["binding"]){return sha256(JSON.stringify([input.audience,input.keyId,input.nonce,input.companyId,input.projectId]));}
  private async locked<T>(key:string,work:(lease:{assertCurrent():void;fence:string})=>T|Promise<T>){return fencedDirectoryLock(this.root,path.join(this.root,`${key}.lock`),`nonce:${key}`,work);}
  async reserve(input:DurableNonceRecord["binding"]){const key=this.key(input),file=path.join(this.root,`${key}.json`);assertNoLinks(this.root,file);return this.locked(key,lease=>{lease.assertCurrent();const token=`${key}.${randomUUID()}`;if(fs.existsSync(file)){const known=readJson<DurableNonceRecord>(this.root,file);if(known.version!==2||!HEX64.test(known.tokenSha256))fail("FEEDBACK_RECEIVER_NONCE_SCHEMA_INVALID","Nonce record schema is invalid");if(known.binding.requestSha256!==input.requestSha256||known.binding.requestId!==input.requestId)return null;if(known.state==="reserved"){if(!known.owner||!ownerIsProvablyDead(known.owner))return null;const recovered={...known,tokenSha256:sha256(token),owner:currentOwner(`nonce:${key}`,300_000)};lease.assertCurrent();atomicJson(this.root,file,recovered);return{token,status:"new" as const};}return{token,status:"identical-retry" as const};}const record:DurableNonceRecord={version:2,binding:input,state:"reserved",tokenSha256:sha256(token),owner:currentOwner(`nonce:${key}`,300_000)};lease.assertCurrent();atomicJson(this.root,file,record);return{token,status:"new" as const};});}
  async commit(token:string){const key=token.split(".")[0];if(!HEX64.test(key))fail("FEEDBACK_RECEIVER_NONCE_TOKEN_INVALID","Nonce token is invalid");await this.locked(key,lease=>{lease.assertCurrent();const file=path.join(this.root,`${key}.json`),record=readJson<DurableNonceRecord>(this.root,file);if(record.version!==2||!HEX64.test(record.tokenSha256))fail("FEEDBACK_RECEIVER_NONCE_TOKEN_INVALID","Nonce token is invalid");if(record.state==="committed")return;if(!timingSafeEqual(Buffer.from(record.tokenSha256,"hex"),Buffer.from(sha256(token),"hex")))fail("FEEDBACK_RECEIVER_NONCE_TOKEN_INVALID","Nonce token is invalid");lease.assertCurrent();atomicJson(this.root,file,{...record,state:"committed"});});}
  async rollback(token:string){const key=token.split(".")[0];if(!HEX64.test(key))return;await this.locked(key,lease=>{lease.assertCurrent();const file=path.join(this.root,`${key}.json`);if(!fs.existsSync(file))return;const record=readJson<DurableNonceRecord>(this.root,file);if(record.version===2&&record.tokenSha256===sha256(token)&&record.state==="reserved"){lease.assertCurrent();fs.unlinkSync(file);syncDirectory(this.root);}});}
  async recover(input:{key:string;proofSha256:string}){if(!HEX64.test(input.key)||!HEX64.test(input.proofSha256))return false;return this.locked(input.key,lease=>{lease.assertCurrent();const file=path.join(this.root,`${input.key}.json`);if(!fs.existsSync(file))return false;const record=readJson<DurableNonceRecord>(this.root,file);if(record.version!==2)return false;if(record.state==="committed")return true;if(record.tokenSha256!==input.proofSha256)return false;lease.assertCurrent();atomicJson(this.root,file,{...record,state:"committed"});return true;});}
}
export type ReceiverFaultHooks = {
  afterNonceReserved?: () => void;
  afterObjectWritten?: () => void;
  afterGenerationWritten?: () => void;
  afterIndexWritten?: () => void;
  afterDeletionPrepared?: () => void;
};

const HEX64 = /^[a-f0-9]{64}$/;
const fail = (code: string, message: string): never => {
  throw new RelayProtocolError(code, message);
};
const canonicalRoot = (value: string) => path.resolve(value);
const PROCESS_INSTANCE_ID = randomUUID();
const PROCESS_STARTED_AT = new Date(Date.now() - process.uptime() * 1000).toISOString();
function operatingSystemBootId(){
  const configured=process.env.BIMLOG_FEEDBACK_OS_BOOT_ID;
  if(configured){if(!HEX64.test(configured))fail("FEEDBACK_RECEIVER_BOOT_ID_INVALID","Configured OS boot identity is invalid");return configured;}
  if(process.platform==="linux"){
    const value=fs.readFileSync("/proc/sys/kernel/random/boot_id","utf8").trim();
    if(!/^[a-f0-9-]{36}$/i.test(value))fail("FEEDBACK_RECEIVER_BOOT_ID_UNAVAILABLE","Linux boot identity is unavailable");
    return sha256(`linux\n${value.toLowerCase()}`);
  }
  if(process.platform==="win32"){
    try{
      const value=execFileSync("powershell.exe",["-NoProfile","-NonInteractive","-Command","(Get-CimInstance Win32_OperatingSystem).LastBootUpTime.ToUniversalTime().ToString('o')"],{encoding:"utf8",windowsHide:true,timeout:10_000}).trim();
      const parsed=new Date(value);if(Number.isNaN(parsed.getTime()))throw new Error("invalid boot time");
      return sha256(`windows\n${os.hostname().toLowerCase()}\n${parsed.toISOString()}`);
    }catch{return fail("FEEDBACK_RECEIVER_BOOT_ID_UNAVAILABLE","Stable Windows boot identity is unavailable");}
  }
  return fail("FEEDBACK_RECEIVER_BOOT_ID_UNAVAILABLE","Stable OS boot identity is unavailable");
}
const OS_BOOT_ID = operatingSystemBootId();
type LockOwnerV2 = {
  version: 2;
  instanceId: string;
  pid: number;
  processStartedAt: string;
  osBootId: string;
  fence: string;
  acquiredAt: string;
  heartbeatAt: string;
  leaseUntil: string;
};
function currentOwner(identity:string,leaseMs:number):LockOwnerV2{const now=new Date();return{version:2,instanceId:PROCESS_INSTANCE_ID,pid:process.pid,processStartedAt:PROCESS_STARTED_AT,osBootId:OS_BOOT_ID,fence:sha256(`${identity}\n${randomUUID()}\n${now.toISOString()}`),acquiredAt:now.toISOString(),heartbeatAt:now.toISOString(),leaseUntil:new Date(now.getTime()+leaseMs).toISOString()};}
function parseLockOwner(value: unknown): LockOwnerV2 | null {
  if (!value || typeof value !== "object") return null;
  const owner = value as Record<string, unknown>;
  if (owner.version !== 2 || typeof owner.instanceId !== "string" ||
      !Number.isSafeInteger(owner.pid) || typeof owner.processStartedAt !== "string" ||
      !HEX64.test(String(owner.osBootId)) || !HEX64.test(String(owner.fence)) ||
      typeof owner.acquiredAt !== "string" || typeof owner.heartbeatAt !== "string" ||
      typeof owner.leaseUntil !== "string") return null;
  for (const field of ["processStartedAt", "acquiredAt", "heartbeatAt", "leaseUntil"] as const) {
    const date = new Date(String(owner[field]));
    if (Number.isNaN(date.getTime()) || date.toISOString() !== owner[field]) return null;
  }
  return owner as LockOwnerV2;
}
function processIsAlive(pid: number) {
  if(process.platform==="win32"){try{const output=execFileSync("tasklist.exe",["/FI",`PID eq ${pid}`,"/FO","CSV","/NH"],{encoding:"utf8",windowsHide:true,timeout:5_000});return new RegExp(`"${pid}"`).test(output);}catch{return true;}}
  try { process.kill(pid, 0); return true; } catch (error) {
    if((error as NodeJS.ErrnoException).code!=="EPERM")return false;
    return true;
  }
}
function processMatchesOwner(owner:LockOwnerV2){if(process.platform!=="win32")return processIsAlive(owner.pid);try{const value=execFileSync("powershell.exe",["-NoProfile","-NonInteractive","-Command",`$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${owner.pid}' -ErrorAction SilentlyContinue;if($p){$p.CreationDate.ToUniversalTime().ToString('o')}`],{encoding:"utf8",windowsHide:true,timeout:10_000}).trim();if(!value)return false;const actual=new Date(value).getTime(),expected=new Date(owner.processStartedAt).getTime();return Number.isFinite(actual)&&Math.abs(actual-expected)<2_000;}catch{return true;}}
function ownerIsProvablyDead(owner: LockOwnerV2, now = new Date()) {
  if (owner.osBootId !== OS_BOOT_ID) return true;
  if(owner.pid===process.pid)return owner.instanceId!==PROCESS_INSTANCE_ID||owner.processStartedAt!==PROCESS_STARTED_AT;
  if (!processMatchesOwner(owner)) return true;
  if (new Date(owner.leaseUntil).getTime() >= now.getTime()) return false;
  // A foreign live PID cannot be taken over without an external process-start proof.
  return false;
}
function ownerlessLockExpired(lock:string,now=Date.now()){try{return now-fs.statSync(lock).mtimeMs>=1_000;}catch{return false;}}
async function fencedDirectoryLock<T>(root:string,lock:string,identity:string,work:(lease:{assertCurrent():void;fence:string})=>T|Promise<T>):Promise<T>{
  const ownerPath=path.join(lock,"owner.json"),leaseMs=5_000;
  for(let attempt=0;attempt<1_000;attempt++){
    try{
      fs.mkdirSync(lock);const acquiredAt=new Date(),fence=sha256(`${identity}\n${randomUUID()}\n${acquiredAt.toISOString()}`);
      const makeOwner=():LockOwnerV2=>({version:2,instanceId:PROCESS_INSTANCE_ID,pid:process.pid,processStartedAt:PROCESS_STARTED_AT,osBootId:OS_BOOT_ID,fence,acquiredAt:acquiredAt.toISOString(),heartbeatAt:new Date().toISOString(),leaseUntil:new Date(Date.now()+leaseMs).toISOString()});
      atomicWrite(lock,ownerPath,Buffer.from(JSON.stringify(makeOwner()),"utf8"));let lost=false;
      const assertCurrent=()=>{if(lost)fail("FEEDBACK_RECEIVER_FENCE_LOST","Receiver mutation fence was lost");let current:LockOwnerV2|null=null;try{current=parseLockOwner(JSON.parse(fs.readFileSync(ownerPath,"utf8")));}catch{}
        if(!current||current.fence!==fence||new Date(current.leaseUntil).getTime()<Date.now()){lost=true;fail("FEEDBACK_RECEIVER_FENCE_LOST","Receiver mutation fence was lost");}};
      const heartbeat=setInterval(()=>{try{assertCurrent();atomicWrite(lock,ownerPath,Buffer.from(JSON.stringify(makeOwner()),"utf8"));}catch{lost=true;}},Math.floor(leaseMs/3));heartbeat.unref();
      try{assertCurrent();return await work({assertCurrent,fence});}finally{clearInterval(heartbeat);let current:LockOwnerV2|null=null;try{current=parseLockOwner(JSON.parse(fs.readFileSync(ownerPath,"utf8")));}catch{}if(current?.fence===fence)fs.rmSync(lock,{recursive:true,force:false});}
    }catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;let owner:LockOwnerV2|null=null;try{owner=parseLockOwner(JSON.parse(fs.readFileSync(ownerPath,"utf8")));}catch{}
      if((!owner&&ownerlessLockExpired(lock))||(owner&&ownerIsProvablyDead(owner))){const quarantine=`${lock}.stale-${randomUUID()}`;try{fs.renameSync(lock,quarantine);syncDirectory(path.dirname(lock));fs.rmSync(quarantine,{recursive:true,force:false});continue;}catch(renameError){if((renameError as NodeJS.ErrnoException).code!=="ENOENT")await new Promise(resolve=>setTimeout(resolve,2));}}
      else await new Promise(resolve=>setTimeout(resolve,2));
    }
  }
  return fail("FEEDBACK_RECEIVER_LOCK_TIMEOUT","Receiver authority is already being processed");
}
const rootFingerprint = (root: string) =>
  sha256(
    `bimlog-feedback-receiver-root-v1\n${root.replaceAll("\\", "/").toLowerCase()}`,
  );
function contained(root: string, target: string) {
  const relative = path.relative(root, target);
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}
function assertNoLinks(root: string, target: string) {
  if (!contained(root, target))
    fail(
      "FEEDBACK_RECEIVER_CONTAINMENT_DENIED",
      "Receiver path escaped its authorized root",
    );
  let current = root;
  for (const part of path
    .relative(root, target)
    .split(path.sep)
    .filter(Boolean)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) break;
    if (fs.lstatSync(current).isSymbolicLink())
      fail(
        "FEEDBACK_RECEIVER_REPARSE_DENIED",
        "Receiver custody contains a link or reparse point",
      );
  }
}
function assertTreeNoLinks(root: string, dir = root) {
  assertNoLinks(root, dir);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (fs.lstatSync(target).isSymbolicLink())
      fail(
        "FEEDBACK_RECEIVER_REPARSE_DENIED",
        "Receiver custody contains a link or reparse point",
      );
    if (entry.isDirectory()) assertTreeNoLinks(root, target);
  }
}
function mkdirSafe(root: string, target: string) {
  assertNoLinks(root, target);
  fs.mkdirSync(target, { recursive: true });
  assertNoLinks(root, target);
}
function syncDirectory(dir: string) {
  try {
    const fd = fs.openSync(dir, "r");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return "fsync" as const;
  } catch {
    return "rename-recovery" as const;
  }
}
function fileIdentity(file:string){const fd=fs.openSync(file,"r"),hash=createHash("sha256"),chunk=Buffer.allocUnsafe(64*1024);let byteCount=0;try{for(;;){const read=fs.readSync(fd,chunk,0,chunk.length,null);if(!read)break;byteCount+=read;hash.update(chunk.subarray(0,read));}}finally{fs.closeSync(fd);}return{byteCount,sha256:hash.digest("hex")};}
function atomicWrite(root: string, target: string, bytes: Buffer) {
  assertNoLinks(root, target);
  mkdirSafe(root, path.dirname(target));
  const staging = path.join(root, "99-System", "staging"),
    temporary =
      fs.existsSync(staging) && !contained(staging, target)
        ? path.join(staging, `.stage-${randomUUID()}`)
        : path.join(path.dirname(target), `.stage-${randomUUID()}`);
  const fd = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(temporary, target);
    return syncDirectory(path.dirname(target));
  } catch (error) {
    try {
      fs.unlinkSync(temporary);
    } catch {}
    throw error;
  }
}
function atomicJson(root: string, target: string, value: unknown) {
  return atomicWrite(root, target, Buffer.from(JSON.stringify(value), "utf8"));
}
function readJson<T>(root: string, file: string): T {
  assertNoLinks(root, file);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}
function canonicalJson(value:unknown):string{
  if(value===null||typeof value==="string"||typeof value==="boolean")return JSON.stringify(value);
  if(typeof value==="number"){if(!Number.isSafeInteger(value))fail("FEEDBACK_RECEIVER_SCHEMA_INVALID","Authority record contains an unsafe number");return JSON.stringify(value);}
  if(Array.isArray(value))return `[${value.map(canonicalJson).join(",")}]`;
  if(typeof value==="object"){const record=value as Record<string,unknown>;return `{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;}
  return fail("FEEDBACK_RECEIVER_SCHEMA_INVALID","Authority record contains an unsupported value");
}
const MEDIA_KIND: Readonly<Record<string, ReceiverMediaKind>> = {
  "image/png": "screenshot",
  "image/jpeg": "screenshot",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/webm": "audio",
  "application/pdf": "document",
  "text/plain": "transcript",
  "application/octet-stream": "original",
};
function verifiedInspection(
  input: ScannerInspection,
  request: RequestContract,
  clientDeclared?: { mediaType: string; mediaKind: ReceiverMediaKind },
) {
  if (input.verdict !== "clean")
    fail(
      "FEEDBACK_RECEIVER_SCANNER_CLEAN_REQUIRED",
      "Only scanner-clean bytes may enter receiver custody",
    );
  if (
    !/^[A-Za-z0-9._-]{1,80}$/.test(input.scannerAdapter) ||
    /precheck|evidence.?contract/i.test(input.scannerAdapter)
  )
    fail(
      "FEEDBACK_RECEIVER_SCANNER_AUTHORITY_INVALID",
      "A governed malware scanner adapter is required",
    );
  const inspectedAt = new Date(input.inspectedAt);
  if (
    Number.isNaN(inspectedAt.getTime()) ||
    inspectedAt.toISOString() !== input.inspectedAt ||
    input.byteCount !== request.byteCount ||
    input.sha256 !== request.sha256
  )
    fail(
      "FEEDBACK_RECEIVER_INSPECTION_MISMATCH",
      "Scanner inspection does not bind the signed bytes",
    );
  const mediaType = input.inspectedMediaType.trim().toLowerCase();
  if (MEDIA_KIND[mediaType] !== input.mediaKind)
    fail(
      "FEEDBACK_RECEIVER_MEDIA_KIND_MISMATCH",
      "Inspected media type and media kind are inconsistent",
    );
  if (
    clientDeclared &&
    (clientDeclared.mediaType.trim().toLowerCase() !== mediaType ||
      clientDeclared.mediaKind !== input.mediaKind)
  )
    fail(
      "FEEDBACK_RECEIVER_CLIENT_MEDIA_MISMATCH",
      "Client-declared media identity differs from scanner inspection",
    );
  return { ...input, inspectedMediaType: mediaType };
}
function sameSignature(a: string, b: string) {
  const left = Buffer.from(a, "utf8"),
    right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export class FeedbackReceiverCustodyService {
  readonly root: string;
  private readonly system: string;
  private readonly objects: string;
  constructor(
    private readonly authority: ReceiverRootAuthority,
    private readonly senderKeys: RelayKeyRing,
    private readonly receiverKeys: RelayKeyRing,
    private readonly nonces: ReceiverNonceAuthority,
    private readonly maxSkewMs: number,
    private readonly faults: ReceiverFaultHooks = {},
  ) {
    this.root = canonicalRoot(authority.canonicalRoot);
    if (!fs.existsSync(this.root) || !fs.statSync(this.root).isDirectory())
      fail(
        "FEEDBACK_RECEIVER_ROOT_REQUIRED",
        "Authorized receiver root must already exist",
      );
    const physical = fs.realpathSync.native(this.root);
    if (
      canonicalRoot(physical) !== this.root ||
      !HEX64.test(authority.rootFingerprintSha256) ||
      rootFingerprint(this.root) !== authority.rootFingerprintSha256
    )
      fail(
        "FEEDBACK_RECEIVER_ROOT_IDENTITY_MISMATCH",
        "Receiver root identity differs from authority",
      );
    assertTreeNoLinks(this.root);
    this.system = path.join(this.root, "99-System");
    this.objects = path.join(this.root, "01-Active");
    for (const dir of [
      this.system,
      this.objects,
      path.join(this.system, "requests"),
      path.join(this.system, "locks"),
      path.join(this.system, "deletions"),
      path.join(this.system, "quarantine"),
      path.join(this.system, "staging"),
    ])
      mkdirSafe(this.root, dir);
  }
  static fingerprintRoot(root: string) {
    return rootFingerprint(canonicalRoot(root));
  }
  createUploadStage() {
    const target = path.join(this.system, "staging", `.upload-${randomUUID()}`);
    assertNoLinks(this.root, target);
    const descriptor = fs.openSync(target, "wx", 0o600);
    fs.closeSync(descriptor);
    const acquiredAt=new Date(),owner:LockOwnerV2={version:2,instanceId:PROCESS_INSTANCE_ID,pid:process.pid,processStartedAt:PROCESS_STARTED_AT,osBootId:OS_BOOT_ID,fence:sha256(`${target}\n${randomUUID()}`),acquiredAt:acquiredAt.toISOString(),heartbeatAt:acquiredAt.toISOString(),leaseUntil:new Date(acquiredAt.getTime()+300_000).toISOString()};
    atomicJson(this.root,`${target}.owner.json`,owner);
    return target;
  }
  async discardUploadStage(target: string) {
    assertNoLinks(this.root, target);
    if (!contained(path.join(this.system, "staging"), target))
      fail(
        "FEEDBACK_RECEIVER_STAGING_AUTHORITY_DENIED",
        "Upload staging path escaped receiver authority",
      );
    await fs.promises.rm(target, { force: true });
    await fs.promises.rm(`${target}.owner.json`,{force:true});
  }
  async deliverStaged(input: {
    signedRequest: Signed<RequestContract>;
    stagedPath: string;
    inspection: ScannerInspection;
    clientDeclared?: { mediaType: string; mediaKind: ReceiverMediaKind };
    now?: Date;
    signal?:AbortSignal;
  }) {
    if(input.signal?.aborted)fail("FEEDBACK_RECEIVER_ABORTED","Receiver delivery was aborted");
    assertNoLinks(this.root, input.stagedPath);
    if (!contained(path.join(this.system, "staging"), input.stagedPath))
      fail(
        "FEEDBACK_RECEIVER_STAGING_AUTHORITY_DENIED",
        "Upload staging path escaped receiver authority",
      );
    const request=input.signedRequest.payload,now=input.now??new Date(),requestHash=sha256(canonicalRequest(request)),inspection=verifiedInspection(input.inspection,request,input.clientDeclared),identity=fileIdentity(input.stagedPath);
    if(identity.byteCount!==request.byteCount||identity.sha256!==request.sha256||request.bodySha256!==request.sha256)fail("FEEDBACK_RECEIVER_OBJECT_MISMATCH","Staged bytes do not match the signed request");
    try{return await this.lock(request.requestId,async lease=>{lease.assertCurrent();const index=this.indexPath(request.requestId);if(fs.existsSync(index)){await this.authorizeHeader(input.signedRequest,now);lease.assertCurrent();const stored=this.readStored(index),object=path.join(this.root,stored.objectRelativePath),current=fileIdentity(object);if(stored.requestHash!==requestHash||!sameSignature(stored.requestSignature,input.signedRequest.signature)||current.byteCount!==identity.byteCount||current.sha256!==identity.sha256)fail("FEEDBACK_RECEIVER_REPLAY_READBACK_MISMATCH","Replay bytes do not match current custody");return stored.receipt;}
      if(input.signal?.aborted)fail("FEEDBACK_RECEIVER_ABORTED","Receiver delivery was aborted");let reservation:NonceReservation|undefined;const nonceAdapter:NonceAuthority={consume:async details=>{lease.assertCurrent();reservation=(await this.nonces.reserve(details))??undefined;return Boolean(reservation);}};await verifyRequest(input.signedRequest,this.senderKeys,nonceAdapter,{now,maxSkewMs:this.maxSkewMs});lease.assertCurrent();if(!reservation)fail("FEEDBACK_RECEIVER_NONCE_DENIED","Nonce authority denied request");const accepted=reservation as NonceReservation;let committed=false,indexed=false,moved=false;const object=this.objectPath(request);try{this.faults.afterNonceReserved?.();lease.assertCurrent();assertNoLinks(this.root,object);if(fs.existsSync(object)){const current=fileIdentity(object);if(current.byteCount!==identity.byteCount||current.sha256!==identity.sha256)fail("FEEDBACK_RECEIVER_OBJECT_CONFLICT","Existing custody object differs from request");}else{if(input.signal?.aborted)fail("FEEDBACK_RECEIVER_ABORTED","Receiver delivery was aborted");lease.assertCurrent();mkdirSafe(this.root,path.dirname(object));const stagedFd=fs.openSync(input.stagedPath,"r+");try{fs.fsyncSync(stagedFd);}finally{fs.closeSync(stagedFd);}lease.assertCurrent();fs.renameSync(input.stagedPath,object);syncDirectory(path.dirname(input.stagedPath));syncDirectory(path.dirname(object));moved=true;}this.faults.afterObjectWritten?.();lease.assertCurrent();const receipt=signReceipt({version:"1",requestId:request.requestId,companyId:request.companyId,projectId:request.projectId,feedbackId:request.feedbackId,objectId:request.objectId,byteCount:request.byteCount,sha256:request.sha256,destinationId:this.authority.destinationId,receivedAt:now.toISOString(),requestNonce:request.nonce,receiverKeyId:this.receiverKeys.activeKeyId},this.receiverKeys,now);lease.assertCurrent();const generation=this.bumpGeneration();lease.assertCurrent();const record=this.authenticateRecord("bimlog-feedback-receiver-request-index-v3",{requestHash,requestSignature:input.signedRequest.signature,objectRelativePath:path.relative(this.root,object),authorityVersion:3 as const,inspection,receipt,nonceRecovery:{key:accepted.token.split(".")[0],proofSha256:sha256(accepted.token)},generation,directoryDurability:syncDirectory(path.dirname(index))});atomicJson(this.root,index,record);indexed=true;this.faults.afterIndexWritten?.();lease.assertCurrent();await this.nonces.commit(accepted.token);lease.assertCurrent();committed=true;return receipt;}catch(error){if(!committed&&!indexed)await this.nonces.rollback(accepted.token);if(moved&&!fs.existsSync(index)&&fs.existsSync(object)){lease.assertCurrent();fs.unlinkSync(object);}throw error;}});}finally{if(fs.existsSync(input.stagedPath))await this.discardUploadStage(input.stagedPath);}
  }
  private indexPath(requestId: string) {
    return path.join(this.system, "requests", `${sha256(requestId)}.json`);
  }
  private deletionPath(requestId: string) {
    return path.join(this.system, "deletions", `${sha256(requestId)}.json`);
  }
  private objectPath(request: RequestContract) {
    return path.join(
      this.objects,
      sha256(request.companyId).slice(0, 16),
      sha256(request.projectId).slice(0, 16),
      sha256(request.feedbackId).slice(0, 16),
      sha256(request.objectId).slice(0, 16),
      request.sha256,
    );
  }
  private authenticateRecord<T extends Record<string,unknown>>(domain:string,value:T){
    const key=this.receiverKeys.keys.find(candidate=>candidate.id===this.receiverKeys.activeKeyId&&candidate.status==="active");
    if(!key||key.secret.length<32)fail("FEEDBACK_RECEIVER_RECORD_KEY_INVALID","Receiver record authentication key is unavailable");
    const signingKey=key!,canonical=canonicalJson({domain,...value}),canonicalSha256=sha256(canonical),hmacSha256=createHmac("sha256",signingKey.secret).update(canonical,"utf8").digest("hex");
    return {...value,authentication:{keyId:signingKey.id,canonicalSha256,hmacSha256}};
  }
  private verifyStoredRecord(value:unknown):StoredDelivery{
    if(!value||typeof value!=="object")fail("FEEDBACK_RECEIVER_REQUEST_INDEX_SCHEMA_INVALID","Request index schema is invalid");
    const record=value as Record<string,unknown>;
    if(record.authorityVersion!==3)fail("FEEDBACK_RECEIVER_REQUEST_INDEX_MIGRATION_REQUIRED","Legacy request index requires authenticated migration");
    const authentication=record.authentication as Record<string,unknown>|undefined,key=this.receiverKeys.keys.find(candidate=>candidate.id===authentication?.keyId);
    if(!authentication||!key||!HEX64.test(String(authentication.canonicalSha256))||!HEX64.test(String(authentication.hmacSha256)))fail("FEEDBACK_RECEIVER_REQUEST_INDEX_AUTH_INVALID","Request index authentication is invalid");
    const verifiedAuthentication=authentication!,verificationKey=key!,{authentication:ignored,...payload}=record,canonical=canonicalJson({domain:"bimlog-feedback-receiver-request-index-v3",...payload}),digest=sha256(canonical),mac=createHmac("sha256",verificationKey.secret).update(canonical,"utf8").digest("hex");
    if(!sameSignature(digest,String(verifiedAuthentication.canonicalSha256))||!sameSignature(mac,String(verifiedAuthentication.hmacSha256)))fail("FEEDBACK_RECEIVER_REQUEST_INDEX_AUTH_INVALID","Request index authentication is invalid");
    if(!HEX64.test(String(record.requestHash))||!HEX64.test(String(record.requestSignature))||typeof record.objectRelativePath!=="string"||path.isAbsolute(record.objectRelativePath)||!record.receipt||!record.inspection)fail("FEEDBACK_RECEIVER_REQUEST_INDEX_SCHEMA_INVALID","Request index schema is invalid");
    const stored=record as unknown as StoredDelivery;if(!Number.isSafeInteger(stored.generation)||stored.generation<1||!stored.receipt?.payload||typeof stored.receipt.signature!=="string"||!stored.inspection||stored.inspection.verdict!=="clean"||!HEX64.test(stored.inspection.sha256)||!Number.isSafeInteger(stored.inspection.byteCount)||stored.inspection.byteCount<0||(stored.nonceRecovery&&(!/^[A-Za-z0-9:_-]{1,256}$/.test(stored.nonceRecovery.key)||!HEX64.test(stored.nonceRecovery.proofSha256))))fail("FEEDBACK_RECEIVER_REQUEST_INDEX_SCHEMA_INVALID","Request index nested schema is invalid");
    verifyReceiptDurably(stored.receipt,this.receiverKeys,new Date(Math.max(Date.now(),new Date(stored.receipt.payload.receivedAt).getTime())));
    return stored;
  }
  private quarantineLegacy(file:string,kind:string){assertNoLinks(this.root,file);const quarantine=path.join(this.system,"quarantine",`${kind}-${path.basename(file)}-${randomUUID()}`);assertNoLinks(this.root,quarantine);fs.renameSync(file,quarantine);syncDirectory(path.dirname(file));syncDirectory(path.dirname(quarantine));}
  private readStored(file:string){const value=readJson<unknown>(this.root,file);try{return this.verifyStoredRecord(value);}catch(error){if(error instanceof RelayProtocolError&&error.code==="FEEDBACK_RECEIVER_REQUEST_INDEX_MIGRATION_REQUIRED")this.quarantineLegacy(file,"request-index");throw error;}}
  private verifyJournalRecord(value:unknown):DeletionJournal{
    if(!value||typeof value!=="object")fail("FEEDBACK_RECEIVER_DELETION_JOURNAL_INVALID","Deletion journal schema is invalid");
    const record=value as Record<string,unknown>;if(record.authorityVersion!==3)fail("FEEDBACK_RECEIVER_DELETION_MIGRATION_REQUIRED","Legacy deletion journal requires authenticated migration");
    const authentication=record.authentication as Record<string,unknown>|undefined,key=this.receiverKeys.keys.find(candidate=>candidate.id===authentication?.keyId);
    if(!authentication||!key||!HEX64.test(String(authentication.canonicalSha256))||!HEX64.test(String(authentication.hmacSha256)))fail("FEEDBACK_RECEIVER_DELETION_JOURNAL_INVALID","Deletion journal authentication is invalid");
    const {authentication:ignored,...payload}=record,canonical=canonicalJson({domain:"bimlog-feedback-receiver-deletion-journal-v3",...payload}),digest=sha256(canonical),mac=createHmac("sha256",key!.secret).update(canonical,"utf8").digest("hex");
    if(!sameSignature(digest,String(authentication!.canonicalSha256))||!sameSignature(mac,String(authentication!.hmacSha256))||(record.state!=="prepared"&&record.state!=="finalized")||typeof record.objectRelativePath!=="string"||path.isAbsolute(record.objectRelativePath)||!record.receipt)fail("FEEDBACK_RECEIVER_DELETION_JOURNAL_INVALID","Deletion journal authentication is invalid");
    const journal=record as unknown as DeletionJournal;if(!Number.isSafeInteger(journal.generation)||journal.generation<1||!HEX64.test(journal.receipt.objectSha256)||!HEX64.test(journal.receipt.policySha256)||!HEX64.test(journal.receipt.journalSha256)||!HEX64.test(journal.receipt.deliveryReceiptSha256)||!HEX64.test(journal.receipt.readbackSha256)||!Number.isSafeInteger(journal.receipt.byteCount)||journal.receipt.byteCount<0)return fail("FEEDBACK_RECEIVER_DELETION_JOURNAL_INVALID","Deletion journal nested schema is invalid");
    if(journal.state==="finalized")verifyDeletionReceiptDurably(journal.receipt.signed,this.receiverKeys,new Date(Math.max(Date.now(),new Date(journal.receipt.signed.payload.absenceVerifiedAt).getTime())));return journal;
  }
  private readJournal(file:string){const value=readJson<unknown>(this.root,file);try{return this.verifyJournalRecord(value);}catch(error){if(error instanceof RelayProtocolError&&error.code==="FEEDBACK_RECEIVER_DELETION_MIGRATION_REQUIRED")this.quarantineLegacy(file,"deletion-journal");throw error;}}
  private generationPath(){return path.join(this.system,"generation.json");}
  private readGeneration(){const file=this.generationPath();if(!fs.existsSync(file))return 0;const value=readJson<Record<string,unknown>>(this.root,file),authentication=value.authentication as Record<string,unknown>|undefined,key=this.receiverKeys.keys.find(candidate=>candidate.id===authentication?.keyId);
    if(value.version!==1||!Number.isSafeInteger(value.generation)||Number(value.generation)<0||!authentication||!key){return fail("FEEDBACK_RECEIVER_GENERATION_INVALID","Receiver generation authority is invalid");}
    const {authentication:ignored,...payload}=value,canonical=canonicalJson({domain:"bimlog-feedback-receiver-generation-v1",...payload}),digest=sha256(canonical),mac=createHmac("sha256",key.secret).update(canonical,"utf8").digest("hex");
    if(!sameSignature(digest,String(authentication.canonicalSha256))||!sameSignature(mac,String(authentication.hmacSha256)))return fail("FEEDBACK_RECEIVER_GENERATION_INVALID","Receiver generation authority is invalid");return Number(value.generation);}
  private bumpGeneration(){return this.lockSync("__generation__",lease=>{lease.assertCurrent();const generation=this.readGeneration()+1;if(!Number.isSafeInteger(generation))return fail("FEEDBACK_RECEIVER_GENERATION_EXHAUSTED","Receiver generation is exhausted");lease.assertCurrent();atomicJson(this.root,this.generationPath(),this.authenticateRecord("bimlog-feedback-receiver-generation-v1",{version:1 as const,generation}));this.faults.afterGenerationWritten?.();lease.assertCurrent();return generation;});}
  snapshotGeneration(){return this.readGeneration();}
  private async lock<T>(identity: string, work: (lease:{assertCurrent():void;fence:string}) => Promise<T>): Promise<T> {
    const lock = path.join(this.system, "locks", sha256(identity));
    const ownerPath = path.join(lock, "owner.json"), leaseMs = 5_000;
    for (let attempt = 0; attempt < 1_000; attempt++) {
      try {
        fs.mkdirSync(lock);
        const acquiredAt = new Date(), fence = sha256(`${identity}\n${randomUUID()}\n${acquiredAt.toISOString()}`);
        const makeOwner = (): LockOwnerV2 => ({version:2,instanceId:PROCESS_INSTANCE_ID,pid:process.pid,
          processStartedAt:PROCESS_STARTED_AT,osBootId:OS_BOOT_ID,fence,acquiredAt:acquiredAt.toISOString(),
          heartbeatAt:new Date().toISOString(),leaseUntil:new Date(Date.now()+leaseMs).toISOString()});
        atomicWrite(lock, ownerPath, Buffer.from(JSON.stringify(makeOwner()), "utf8"));
        let lost=false;
        const assertCurrent=()=>{if(lost)fail("FEEDBACK_RECEIVER_FENCE_LOST","Receiver mutation fence was lost");let current:LockOwnerV2|null=null;
          try{current=parseLockOwner(JSON.parse(fs.readFileSync(ownerPath,"utf8")));}catch{}
          if(!current||current.fence!==fence||new Date(current.leaseUntil).getTime()<Date.now()){lost=true;fail("FEEDBACK_RECEIVER_FENCE_LOST","Receiver mutation fence was lost");}};
        const heartbeat=setInterval(()=>{try{assertCurrent();atomicWrite(lock,ownerPath,Buffer.from(JSON.stringify(makeOwner()),"utf8"));}catch{lost=true;}},Math.floor(leaseMs/3));
        heartbeat.unref();
        try {
          assertCurrent();return await work({assertCurrent,fence});
        } finally {
          clearInterval(heartbeat);
          const current=fs.existsSync(ownerPath)?parseLockOwner(JSON.parse(fs.readFileSync(ownerPath,"utf8"))):null;
          if(current?.fence===fence)fs.rmSync(lock, { recursive: true, force: false });
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        let owner:LockOwnerV2|null=null;
        try{owner=parseLockOwner(JSON.parse(fs.readFileSync(ownerPath,"utf8")));}catch{}
        if((!owner&&ownerlessLockExpired(lock))||(owner&&ownerIsProvablyDead(owner))){
          const quarantine=`${lock}.stale-${randomUUID()}`;
          try{fs.renameSync(lock,quarantine);syncDirectory(path.dirname(lock));fs.rmSync(quarantine,{recursive:true,force:false});continue;}catch(renameError){if((renameError as NodeJS.ErrnoException).code!=="ENOENT")await new Promise(resolve=>setTimeout(resolve,2));}
        } else await new Promise((resolve) => setTimeout(resolve, 2));
      }
    }
    return fail(
      "FEEDBACK_RECEIVER_LOCK_TIMEOUT",
      "Receiver request is already being processed",
    );
  }
  async authenticateRequest(signed: Signed<RequestContract>, now = new Date()) {
    await verifyRequest(
      signed,
      this.senderKeys,
      { consume: async () => true },
      { now, maxSkewMs: this.maxSkewMs },
    );
    return signed.payload;
  }
  async authorizeHeader(signed: Signed<RequestContract>, now = new Date()) {
    const requestHash = sha256(canonicalRequest(signed.payload));
    const index = this.indexPath(signed.payload.requestId);
    if (fs.existsSync(index)) {
      const stored = this.readStored(index);
      if (
        stored.requestHash !== requestHash ||
        !sameSignature(stored.requestSignature, signed.signature)
      )
        fail(
          "FEEDBACK_RECEIVER_REQUEST_CONFLICT",
          "Request identity was reused with divergent authority",
        );
      if(stored.nonceRecovery&&this.nonces.recover&&!await this.nonces.recover(stored.nonceRecovery))fail("FEEDBACK_RECEIVER_NONCE_RECOVERY_DENIED","Durable nonce recovery proof was denied");
      return signed.payload;
    }
    return this.authenticateRequest(signed, now);
  }
  async deliver(input: {
    signedRequest: Signed<RequestContract>;
    bytes: Buffer;
    inspection: ScannerInspection;
    clientDeclared?: { mediaType: string; mediaKind: ReceiverMediaKind };
    now?: Date;
  }): Promise<Signed<ReceiptContract>> {
    const request = input.signedRequest.payload,
      now = input.now ?? new Date(),
      requestHash = sha256(canonicalRequest(request)),
      inspection = verifiedInspection(
        input.inspection,
        request,
        input.clientDeclared,
      );
    if (
      input.bytes.length !== request.byteCount ||
      sha256(input.bytes) !== request.sha256 ||
      request.bodySha256 !== request.sha256
    )
      fail(
        "FEEDBACK_RECEIVER_OBJECT_MISMATCH",
        "Delivered bytes do not match the signed request",
      );
    return this.lock(request.requestId, async (lease) => {
      lease.assertCurrent();
      const index = this.indexPath(request.requestId);
      if (fs.existsSync(index)) {
        await this.authorizeHeader(input.signedRequest, now);
        lease.assertCurrent();
        const stored = this.readStored(index);
        if (
          stored.requestHash !== requestHash ||
          !sameSignature(stored.requestSignature, input.signedRequest.signature)
        )
          fail(
            "FEEDBACK_RECEIVER_REQUEST_CONFLICT",
            "Request identity was reused with divergent authority",
          );
        const object = path.join(this.root, stored.objectRelativePath);
        assertNoLinks(this.root, object);
        const current = fs.readFileSync(object);
        if (
          current.length !== input.bytes.length ||
          sha256(current) !== sha256(input.bytes) ||
          !current.equals(input.bytes)
        )
          fail(
            "FEEDBACK_RECEIVER_REPLAY_READBACK_MISMATCH",
            "Replay bytes do not match current custody",
          );
        return stored.receipt;
      }
      let reservation: NonceReservation | undefined;
      const nonceAdapter: NonceAuthority = {
        consume: async (details) => {
          lease.assertCurrent();
          reservation = (await this.nonces.reserve(details)) ?? undefined;
          return Boolean(reservation);
        },
      };
      await verifyRequest(input.signedRequest, this.senderKeys, nonceAdapter, {
        now,
        maxSkewMs: this.maxSkewMs,
      });
      lease.assertCurrent();
      if (!reservation)
        fail(
          "FEEDBACK_RECEIVER_NONCE_DENIED",
          "Nonce authority denied request",
        );
      const acceptedReservation = reservation as NonceReservation;
      let committed = false,indexed=false,
        wroteObject = false;
      try {
        this.faults.afterNonceReserved?.();
        lease.assertCurrent();
        const object = this.objectPath(request);
        assertNoLinks(this.root, object);
        if (fs.existsSync(object)) {
          const existing = fs.readFileSync(object);
          if (!existing.equals(input.bytes))
            fail(
              "FEEDBACK_RECEIVER_OBJECT_CONFLICT",
              "Existing custody object differs from request",
            );
        } else {
          lease.assertCurrent();
          atomicWrite(this.root, object, input.bytes);
          wroteObject = true;
        }
        this.faults.afterObjectWritten?.();
        lease.assertCurrent();
        const receipt = signReceipt(
          {
            version: "1",
            requestId: request.requestId,
            companyId: request.companyId,
            projectId: request.projectId,
            feedbackId: request.feedbackId,
            objectId: request.objectId,
            byteCount: request.byteCount,
            sha256: request.sha256,
            destinationId: this.authority.destinationId,
            receivedAt: now.toISOString(),
            requestNonce: request.nonce,
            receiverKeyId: this.receiverKeys.activeKeyId,
          },
          this.receiverKeys,
          now,
        );
        lease.assertCurrent();
        const generation=this.bumpGeneration();lease.assertCurrent();
        const record=this.authenticateRecord("bimlog-feedback-receiver-request-index-v3",{
          requestHash,
          requestSignature: input.signedRequest.signature,
          objectRelativePath: path.relative(this.root, object),
          inspection,
          receipt,
          generation,
          directoryDurability: "rename-recovery",
          authorityVersion:3 as const,nonceRecovery:{key:acceptedReservation.token.split(".")[0],proofSha256:sha256(acceptedReservation.token)},
        });
        const directoryDurability = atomicJson(this.root, index, record);
        indexed=true;
        this.faults.afterIndexWritten?.();
        if (directoryDurability === "fsync") {
          lease.assertCurrent();
          const stored = this.readStored(index);
          stored.directoryDurability = "fsync";
          const {authentication:ignored,...payload}=stored;atomicJson(this.root,index,this.authenticateRecord("bimlog-feedback-receiver-request-index-v3",payload));
        }
        lease.assertCurrent();
        await this.nonces.commit(acceptedReservation.token);
        lease.assertCurrent();
        committed = true;
        return receipt;
      } catch (error) {
        if (!committed&&!indexed) await this.nonces.rollback(acceptedReservation.token);
        if (wroteObject && !fs.existsSync(index)) {
          const object = this.objectPath(request);
          try {
            lease.assertCurrent();
            assertNoLinks(this.root, object);
            fs.unlinkSync(object);
          } catch {}
        }
        throw error;
      }
    });
  }
  private readbackUnderFence(requestId: string, now:Date,assertCurrent:()=>void): Signed<ReadbackContract> {
    assertCurrent();
    const stored = this.readStored(this.indexPath(requestId)),
      object = path.join(this.root, stored.objectRelativePath);
    assertNoLinks(this.root, object);
    assertCurrent();
    const identity=fileIdentity(object);
    if (
      identity.byteCount !== stored.receipt.payload.byteCount ||
      identity.sha256 !== stored.receipt.payload.sha256
    )
      fail(
        "FEEDBACK_RECEIVER_READBACK_MISMATCH",
        "Custody bytes no longer match their receipt",
      );
    assertCurrent();return signReadback(
      {
        version: "1",
        requestId: stored.receipt.payload.requestId,
        companyId: stored.receipt.payload.companyId,
        projectId: stored.receipt.payload.projectId,
        feedbackId: stored.receipt.payload.feedbackId,
        objectId: stored.receipt.payload.objectId,
        byteCount: identity.byteCount,
        sha256: identity.sha256,
        destinationId: this.authority.destinationId,
        verifiedAt: now.toISOString(),
        receiptSha256: sha256(canonicalReceipt(stored.receipt.payload)),
        receiverKeyId: this.receiverKeys.activeKeyId,
      },
      this.receiverKeys,
      now,
    );
  }
  readback(requestId:string,now=new Date()):Signed<ReadbackContract>{return this.lockSync(requestId,lease=>this.readbackUnderFence(requestId,now,lease.assertCurrent));}
  async readbackAsync(requestId:string,now=new Date()):Promise<Signed<ReadbackContract>>{return this.lock(requestId,async lease=>this.readbackUnderFence(requestId,now,lease.assertCurrent));}
  recover() {
    return this.lockSync("__recovery__",recoveryLease=>{recoveryLease.assertCurrent();
    const staging = path.join(this.system, "staging");
    let removedStages = 0,
      removedStaleLocks = 0,
      finalizedDeletions = 0;
    assertNoLinks(this.root, staging);
    for (const entry of fs.readdirSync(staging)) {
      const target = path.join(staging, entry);
      assertNoLinks(this.root, target);
      if(!fs.lstatSync(target).isFile()||entry.endsWith(".owner.json"))continue;
      const ownerPath=`${target}.owner.json`;let owner:LockOwnerV2|null=null;try{if(fs.existsSync(ownerPath))owner=parseLockOwner(readJson<unknown>(this.root,ownerPath));}catch{}
      if((!owner&&ownerlessLockExpired(target))||(owner&&ownerIsProvablyDead(owner))){fs.unlinkSync(target);if(fs.existsSync(ownerPath))fs.unlinkSync(ownerPath);syncDirectory(staging);removedStages++;}
    }
    const locks = path.join(this.system, "locks");
    for (const entry of fs.readdirSync(locks)) {
      const target = path.join(locks, entry),
        ownerPath = path.join(target, "owner.json");
      assertNoLinks(this.root, target);
      if (!fs.lstatSync(target).isDirectory())
        fail("FEEDBACK_RECEIVER_LOCK_INVALID", "Receiver lock authority is not a directory");
      let owner:LockOwnerV2|null=null;
      try { if(fs.existsSync(ownerPath))owner=parseLockOwner(readJson<unknown>(this.root,ownerPath)); } catch {}
      if ((!owner&&ownerlessLockExpired(target))||(owner&&ownerIsProvablyDead(owner))) {
        const quarantine=`${target}.stale-${randomUUID()}`;
        fs.renameSync(target,quarantine);
        syncDirectory(locks);
        fs.rmSync(quarantine, { recursive: true, force: false });
        removedStaleLocks++;
      }
    }
    const deletions = path.join(this.system, "deletions");
    for (const entry of fs.readdirSync(deletions)) {
      const target = path.join(deletions, entry),
        journal = this.readJournal(target);
      if (journal.state === "prepared") {
        this.lockSync(journal.requestId,lease=>{lease.assertCurrent();const current=this.readJournal(target);if(current.state!=="prepared")return;
          const {journalSha256,...preparedBase}=current.receipt;if(current.authorityVersion!==3||sha256(JSON.stringify(preparedBase))!==journalSha256||!HEX64.test(current.receipt.policySha256)||!current.receipt.approvedBy.trim()||new Date(current.receipt.approvedAt).toISOString()!==current.receipt.approvedAt)fail("FEEDBACK_RECEIVER_DELETION_JOURNAL_INVALID","Prepared deletion journal failed authority revalidation");
          const object=path.join(this.root,current.objectRelativePath);assertNoLinks(this.root,object);lease.assertCurrent();if(!fs.existsSync(object)){
            const deletedAt=new Date().toISOString(),absenceVerifiedAt=deletedAt,signed=signDeletionReceipt({version:"1",requestId:current.receipt.requestId,companyId:current.receipt.companyId,projectId:current.receipt.projectId,feedbackId:current.receipt.feedbackId,objectId:current.receipt.objectId,byteCount:current.receipt.byteCount,objectSha256:current.receipt.objectSha256,destinationId:current.receipt.destinationId,policySha256:current.receipt.policySha256,approvedBy:current.receipt.approvedBy,approvedAt:current.receipt.approvedAt,deletedAt,absenceVerifiedAt,journalSha256:current.receipt.journalSha256,deliveryReceiptSha256:current.receipt.deliveryReceiptSha256,readbackSha256:current.receipt.readbackSha256,receiverKeyId:this.receiverKeys.activeKeyId},this.receiverKeys,new Date(absenceVerifiedAt));
            const generation=this.bumpGeneration();lease.assertCurrent();const {authentication:ignored,...journalPayload}=current;atomicJson(this.root,target,this.authenticateRecord("bimlog-feedback-receiver-deletion-journal-v3",{...journalPayload,generation,state:"finalized",receipt:{...current.receipt,absenceVerified:true,deletedAt,absenceVerifiedAt,signed}}));finalizedDeletions++;
          }});
      }
    }
    recoveryLease.assertCurrent();return { removedStages, removedStaleLocks, finalizedDeletions };
    });
  }
  private lockSync<T>(identity:string,work:(lease:{assertCurrent():void;fence:string})=>T):T{
    const lock=path.join(this.system,"locks",sha256(identity)),ownerPath=path.join(lock,"owner.json"),leaseMs=30_000;
    for(let attempt=0;attempt<1_000;attempt++){
      try{
        fs.mkdirSync(lock);const acquiredAt=new Date(),fence=sha256(`${identity}\n${randomUUID()}\n${acquiredAt.toISOString()}`);
        const owner:LockOwnerV2={version:2,instanceId:PROCESS_INSTANCE_ID,pid:process.pid,processStartedAt:PROCESS_STARTED_AT,osBootId:OS_BOOT_ID,fence,acquiredAt:acquiredAt.toISOString(),heartbeatAt:acquiredAt.toISOString(),leaseUntil:new Date(acquiredAt.getTime()+leaseMs).toISOString()};
        atomicWrite(lock,ownerPath,Buffer.from(JSON.stringify(owner),"utf8"));
        const assertCurrent=()=>{let current:LockOwnerV2|null=null;try{current=parseLockOwner(JSON.parse(fs.readFileSync(ownerPath,"utf8")));}catch{}
          if(!current||current.fence!==fence||new Date(current.leaseUntil).getTime()<Date.now())fail("FEEDBACK_RECEIVER_FENCE_LOST","Receiver mutation fence was lost");};
        try{assertCurrent();return work({assertCurrent,fence});}finally{let current:LockOwnerV2|null=null;try{current=parseLockOwner(JSON.parse(fs.readFileSync(ownerPath,"utf8")));}catch{}if(current?.fence===fence)fs.rmSync(lock,{recursive:true,force:false});}
      }catch(error){if((error as NodeJS.ErrnoException).code!=="EEXIST")throw error;let owner:LockOwnerV2|null=null;try{owner=parseLockOwner(JSON.parse(fs.readFileSync(ownerPath,"utf8")));}catch{}
        if((!owner&&ownerlessLockExpired(lock))||(owner&&ownerIsProvablyDead(owner))){const quarantine=`${lock}.stale-${randomUUID()}`;try{fs.renameSync(lock,quarantine);syncDirectory(path.dirname(lock));fs.rmSync(quarantine,{recursive:true,force:false});continue;}catch{}}
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,2);
      }
    }
    return fail("FEEDBACK_RECEIVER_LOCK_TIMEOUT","Receiver request is already being processed");
  }
  private purgeUnderLease(
    requestId: string,
    authority: PurgeAuthority,
    now: Date,
    lease:{assertCurrent():void;fence:string},
  ): DeletionReceipt {
    lease.assertCurrent();
    if (authority.hold)
      fail("FEEDBACK_RECEIVER_HOLD_ACTIVE", "Held custody cannot be purged");
    const approvedAt = new Date(authority.approvedAt);
    if (
      !HEX64.test(authority.policySha256) ||
      !authority.approvedBy.trim() ||
      Number.isNaN(approvedAt.getTime()) ||
      approvedAt.toISOString() !== authority.approvedAt
    )
      fail(
        "FEEDBACK_RECEIVER_PURGE_AUTHORITY_INVALID",
        "Purge authority is invalid",
      );
    const journalPath = this.deletionPath(requestId);
    let journal: DeletionJournal;
    if (fs.existsSync(journalPath)) {
      journal = this.readJournal(journalPath);
      lease.assertCurrent();
      if (
        journal.receipt.policySha256 !== authority.policySha256 ||
        journal.receipt.approvedBy !== authority.approvedBy
      )
        fail(
          "FEEDBACK_RECEIVER_PURGE_CONFLICT",
          "Purge receipt authority differs from immutable history",
        );
      if (journal.state === "finalized") return journal.receipt;
    } else {
      const stored = this.readStored(this.indexPath(requestId)),
        object = path.join(this.root, stored.objectRelativePath);
      lease.assertCurrent();
      assertNoLinks(this.root, object);
      const identity=fileIdentity(object);
      if (identity.byteCount!==stored.receipt.payload.byteCount||identity.sha256 !== stored.receipt.payload.sha256)
        fail(
          "FEEDBACK_RECEIVER_READBACK_MISMATCH",
          "Custody bytes changed before purge",
        );
      const readback=this.readbackUnderFence(requestId,now,lease.assertCurrent),preparedBase = {
          objectSha256: identity.sha256,
          byteCount: identity.byteCount,
          policySha256: authority.policySha256,
          approvedBy: authority.approvedBy,
          approvedAt:authority.approvedAt,
          absenceVerified: false,
          requestId,companyId:stored.receipt.payload.companyId,projectId:stored.receipt.payload.projectId,feedbackId:stored.receipt.payload.feedbackId,objectId:stored.receipt.payload.objectId,destinationId:this.authority.destinationId,
          deliveryReceiptSha256:sha256(canonicalReceipt(stored.receipt.payload)),readbackSha256:sha256(canonicalReadback(readback.payload)),
        } as const,
        receipt: PreparedDeletion = {...preparedBase,journalSha256:sha256(JSON.stringify(preparedBase))};
      const generation=this.bumpGeneration();lease.assertCurrent();const journalDraft = {
        state: "prepared",
        authorityVersion:3 as const,
        requestId,
        objectRelativePath: stored.objectRelativePath,
        receipt,
        generation,
      };
      lease.assertCurrent();
      journal=this.authenticateRecord("bimlog-feedback-receiver-deletion-journal-v3",journalDraft) as DeletionJournal;atomicJson(this.root, journalPath, journal);
      this.faults.afterDeletionPrepared?.();
      lease.assertCurrent();
    }
    if(journal.state!=="prepared")return fail("FEEDBACK_RECEIVER_DELETION_JOURNAL_INVALID","Deletion journal state is invalid");
    const object = path.join(this.root, journal.objectRelativePath);
    assertNoLinks(this.root, object);
    if (fs.existsSync(object)){lease.assertCurrent();fs.unlinkSync(object);syncDirectory(path.dirname(object));}
    if (fs.existsSync(object))
      fail(
        "FEEDBACK_RECEIVER_ABSENCE_UNPROVEN",
        "Purged object absence could not be verified",
      );
    const deletedAt=now.toISOString(),absenceVerifiedAt=deletedAt, signed=signDeletionReceipt({version:"1",requestId:journal.receipt.requestId,companyId:journal.receipt.companyId,projectId:journal.receipt.projectId,feedbackId:journal.receipt.feedbackId,objectId:journal.receipt.objectId,byteCount:journal.receipt.byteCount,objectSha256:journal.receipt.objectSha256,destinationId:journal.receipt.destinationId,policySha256:journal.receipt.policySha256,approvedBy:journal.receipt.approvedBy,approvedAt:journal.receipt.approvedAt,deletedAt,absenceVerifiedAt,journalSha256:journal.receipt.journalSha256,deliveryReceiptSha256:journal.receipt.deliveryReceiptSha256,readbackSha256:journal.receipt.readbackSha256,receiverKeyId:this.receiverKeys.activeKeyId},this.receiverKeys,now);
    const receipt: DeletionReceipt = {...journal.receipt,absenceVerified:true,deletedAt,absenceVerifiedAt,signed};
    lease.assertCurrent();
    const generation=this.bumpGeneration();lease.assertCurrent();const {authentication:ignored,...journalPayload}=journal;atomicJson(this.root, journalPath, this.authenticateRecord("bimlog-feedback-receiver-deletion-journal-v3",{
      ...journalPayload,
      state: "finalized",
      receipt,
      generation,
    }));
    return receipt;
  }
  purge(requestId:string,authority:PurgeAuthority,now=new Date()):DeletionReceipt{return this.lockSync(requestId,lease=>this.purgeUnderLease(requestId,authority,now,lease));}
  async purgeAsync(requestId:string,authority:PurgeAuthority,now=new Date()):Promise<DeletionReceipt>{return this.lock(requestId,async lease=>this.purgeUnderLease(requestId,authority,now,lease));}
  async consumePurgeCommand<TCommand>(requestId:string,command:TCommand,authority:ReceiverPurgeCommandAuthority<TCommand>,now=new Date()):Promise<DeletionReceipt>{return this.lock(requestId,async lease=>{lease.assertCurrent();const requestIndex=this.readStored(this.indexPath(requestId)),verified=await authority.verifyAndRevalidate({requestId,command,requestIndex,now});lease.assertCurrent();return this.purgeUnderLease(requestId,verified,now,lease);});}
  health() {
    try {
      assertTreeNoLinks(this.root);
      fs.accessSync(this.root, fs.constants.R_OK | fs.constants.W_OK);
      return {
        status: "ok" as const,
        destinationId: this.authority.destinationId,
        rootFingerprintSha256: this.authority.rootFingerprintSha256,
      };
    } catch {
      return {
        status: "unavailable" as const,
        destinationId: this.authority.destinationId,
      };
    }
  }
}

function inventoryAuthority(root: string) {
  const result: { relativePath: string; byteCount: number; sha256: string }[] =
    [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const target = path.join(dir, entry.name);
      assertNoLinks(root, target);
      if (entry.isDirectory()) {
        if (entry.name !== "staging" && entry.name !== "locks") walk(target);
      } else if (entry.isFile()) {
        const identity=fileIdentity(target);
        result.push({
          relativePath: path.relative(root, target).replaceAll("\\", "/"),
          byteCount: identity.byteCount,
          sha256: identity.sha256,
        });
      }
    }
  };
  for (const relative of [
    "01-Active",
    path.join("99-System", "requests"),
    path.join("99-System", "deletions"),
  ]) {
    const dir = path.join(root, relative);
    if (fs.existsSync(dir)) walk(dir);
  }
  return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
function emptyIsolatedRoot(root:string){assertNoLinks(root,root);for(const entry of fs.readdirSync(root)){const target=path.join(root,entry);assertNoLinks(root,target);fs.rmSync(target,{recursive:true,force:false});}syncDirectory(root);}
function backupKey(ring:RelayKeyRing,keyId=ring.activeKeyId){const key=ring.keys.find(candidate=>candidate.id===keyId);if(!key||key.secret.length<32||key.status==="revoked")return fail("FEEDBACK_RECEIVER_BACKUP_KEY_INVALID","Backup authentication key is unavailable");return key;}
export async function createReceiverBackupV2(service:FeedbackReceiverCustodyService,backupRoot:string,ring:RelayKeyRing,options:{createdAt?:Date;concurrency?:number;signal?:AbortSignal}={}):Promise<SignedBackupManifestV2>{
  const backup=canonicalRoot(backupRoot),concurrency=options.concurrency??2;if(!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>16)fail("FEEDBACK_RECEIVER_BACKUP_CONCURRENCY_INVALID","Backup concurrency is invalid");
  if(!fs.existsSync(backup)||fs.readdirSync(backup).length)fail("FEEDBACK_RECEIVER_BACKUP_ROOT_NOT_EMPTY","Backup root must exist and be empty");assertTreeNoLinks(service.root);const generation=service.snapshotGeneration(),objects=inventoryAuthority(service.root),queue=[...objects];let failure:unknown;
  const worker=async()=>{while(queue.length&&!failure){if(options.signal?.aborted){failure=new RelayProtocolError("FEEDBACK_RECEIVER_BACKUP_ABORTED","Backup was aborted");return;}const item=queue.shift()!,from=path.join(service.root,item.relativePath),to=path.join(backup,item.relativePath);try{assertNoLinks(service.root,from);mkdirSafe(backup,path.dirname(to));await fs.promises.copyFile(from,to,fs.constants.COPYFILE_EXCL);const identity=fileIdentity(to);if(identity.byteCount!==item.byteCount||identity.sha256!==item.sha256)fail("FEEDBACK_RECEIVER_BACKUP_MISMATCH","Backup object verification failed");}catch(error){failure=error;}}};
  await Promise.all(Array.from({length:concurrency},worker));if(failure){emptyIsolatedRoot(backup);throw failure;}if(service.snapshotGeneration()!==generation){emptyIsolatedRoot(backup);fail("FEEDBACK_RECEIVER_BACKUP_GENERATION_CHANGED","Receiver generation changed during backup");}
  const key=backupKey(ring),base={version:2 as const,createdAt:(options.createdAt??new Date()).toISOString(),sourceRootFingerprintSha256:FeedbackReceiverCustodyService.fingerprintRoot(service.root),generation,objects},canonical=canonicalJson({domain:"bimlog-feedback-receiver-backup-v2",...base}),manifestSha256=sha256(canonical),manifest={...base,manifestSha256,authentication:{keyId:key.id,hmacSha256:createHmac("sha256",key.secret).update(canonical,"utf8").digest("hex")}};
  atomicJson(backup,path.join(backup,"backup-manifest-v2.json"),manifest);return manifest;
}
export async function restoreReceiverBackupV2(backupRoot:string,restoreRoot:string,ring:RelayKeyRing,options:{concurrency?:number;signal?:AbortSignal}={}):Promise<SignedBackupManifestV2>{
  const backup=canonicalRoot(backupRoot),restore=canonicalRoot(restoreRoot),concurrency=options.concurrency??2;if(!Number.isSafeInteger(concurrency)||concurrency<1||concurrency>16)fail("FEEDBACK_RECEIVER_BACKUP_CONCURRENCY_INVALID","Restore concurrency is invalid");if(!fs.existsSync(restore)||fs.readdirSync(restore).length)fail("FEEDBACK_RECEIVER_RESTORE_ROOT_NOT_EMPTY","Restore root must exist and be empty");assertTreeNoLinks(backup);
  const manifest=readJson<SignedBackupManifestV2>(backup,path.join(backup,"backup-manifest-v2.json"));if(manifest.version!==2||!Number.isSafeInteger(manifest.generation)||!Array.isArray(manifest.objects)||!HEX64.test(manifest.manifestSha256))fail("FEEDBACK_RECEIVER_BACKUP_MANIFEST_INVALID","Backup manifest schema is invalid");const key=backupKey(ring,manifest.authentication?.keyId),base={version:manifest.version,createdAt:manifest.createdAt,sourceRootFingerprintSha256:manifest.sourceRootFingerprintSha256,generation:manifest.generation,objects:manifest.objects},canonical=canonicalJson({domain:"bimlog-feedback-receiver-backup-v2",...base});if(sha256(canonical)!==manifest.manifestSha256||!sameSignature(createHmac("sha256",key.secret).update(canonical,"utf8").digest("hex"),manifest.authentication?.hmacSha256||""))fail("FEEDBACK_RECEIVER_BACKUP_MANIFEST_INVALID","Backup manifest authentication is invalid");
  const queue=[...manifest.objects];let failure:unknown;const worker=async()=>{while(queue.length&&!failure){if(options.signal?.aborted){failure=new RelayProtocolError("FEEDBACK_RECEIVER_BACKUP_ABORTED","Restore was aborted");return;}const item=queue.shift()!,from=path.join(backup,item.relativePath),to=path.join(restore,item.relativePath);try{assertNoLinks(backup,from);mkdirSafe(restore,path.dirname(to));await fs.promises.copyFile(from,to,fs.constants.COPYFILE_EXCL);const identity=fileIdentity(to);if(identity.byteCount!==item.byteCount||identity.sha256!==item.sha256)fail("FEEDBACK_RECEIVER_RESTORE_MISMATCH","Restored object verification failed");}catch(error){failure=error;}}};await Promise.all(Array.from({length:concurrency},worker));if(failure){emptyIsolatedRoot(restore);throw failure;}return manifest;
}
