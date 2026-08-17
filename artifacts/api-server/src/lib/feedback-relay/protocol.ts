import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export class RelayProtocolError extends Error {
  constructor(public readonly code: string, message: string, public readonly safeMetadata: Readonly<Record<string, string>> = {}) {
    super(message); this.name = "RelayProtocolError";
  }
}

export type RelayKey = { id: string; secret: Buffer; status: "active" | "grace" | "revoked"; notBefore: Date; notAfter: Date; revokedAt?: Date };
export type RelayKeyRing = { activeKeyId: string; keys: readonly RelayKey[] };
export type RequestContract = { version: "1"; method: string; path: string; query: string; audience: string; keyId: string; timestamp: string; nonce: string; requestId: string; companyId: string; projectId: string; feedbackId: string; objectId: string; byteCount: number; sha256: string; bodySha256: string };
export type ReceiptContract = { version: "1"; requestId: string; companyId: string; projectId: string; feedbackId: string; objectId: string; byteCount: number; sha256: string; destinationId: string; receivedAt: string; requestNonce: string; receiverKeyId: string };
export type ReadbackContract = { version: "1"; requestId: string; companyId: string; projectId: string; feedbackId: string; objectId: string; byteCount: number; sha256: string; destinationId: string; verifiedAt: string; receiptSha256: string; receiverKeyId: string };
export type Signed<T> = { payload: T; signature: string };
export interface NonceAuthority { consume(input: { audience: string; keyId: string; nonce: string; timestamp: string; requestId: string; companyId: string; projectId: string; requestSha256: string }): Promise<boolean>; }
export type DurableReceiptVerification={version:"1";requestId:string;companyId:string;projectId:string;keyId:string;signedAt:string;canonicalSha256:string;signature:string;verifiedAt:string};

const HEX64=/^[a-f0-9]{64}$/; const TOKEN=/^[A-Za-z0-9._:@/-]{1,256}$/;
const field=(name:string,value:string|number)=>{const text=String(value).normalize("NFC");return `${name}:${Buffer.byteLength(text,"utf8")}:${text}`;};
const canonical=(domain:string, fields:readonly (readonly [string,string|number])[])=>[field("domain",domain),...fields.map(([k,v])=>field(k,v))].join("\n");
const iso=(value:string,name:string)=>{const date=new Date(value);if(Number.isNaN(date.getTime())||date.toISOString()!==value) throw new RelayProtocolError("FEEDBACK_RELAY_CANONICAL_INVALID",`Invalid ${name}`);return value;};
const token=(value:string,name:string)=>{if(!TOKEN.test(value))throw new RelayProtocolError("FEEDBACK_RELAY_CANONICAL_INVALID",`Invalid ${name}`);return value;};
const bytes=(value:number)=>{if(!Number.isSafeInteger(value)||value<0)throw new RelayProtocolError("FEEDBACK_RELAY_CANONICAL_INVALID","Invalid byteCount");return value;};
const digest=(value:string,name:string)=>{if(!HEX64.test(value))throw new RelayProtocolError("FEEDBACK_RELAY_CANONICAL_INVALID",`Invalid ${name}`);return value;};

const canonicalMethod=(value:string)=>{if(!/^(GET|HEAD|PUT|POST|DELETE)$/.test(value))throw new RelayProtocolError("FEEDBACK_RELAY_CANONICAL_INVALID","Invalid method");return value;};
const canonicalPath=(value:string)=>{if(!value.startsWith("/")||value.startsWith("//")||value.includes("?")||value.includes("#")||value.includes("\\")||/%2f|%5c/i.test(value))throw new RelayProtocolError("FEEDBACK_RELAY_CANONICAL_INVALID","Invalid path");const parsed=new URL(value,"https://canonical.invalid");if(parsed.pathname!==value||parsed.search||parsed.hash)throw new RelayProtocolError("FEEDBACK_RELAY_CANONICAL_INVALID","Path is not canonical");return value;};
const canonicalQuery=(value:string)=>{if(value.startsWith("?")||value.includes("#"))throw new RelayProtocolError("FEEDBACK_RELAY_CANONICAL_INVALID","Invalid query");const parsed=new URLSearchParams(value);parsed.sort();const canonicalValue=parsed.toString();if(canonicalValue!==value)throw new RelayProtocolError("FEEDBACK_RELAY_CANONICAL_INVALID","Query is not canonical");return value;};
export function canonicalRequest(p:RequestContract){return canonical("bimlog-feedback-relay-request-v1",[["version",p.version],["method",canonicalMethod(p.method)],["path",canonicalPath(p.path)],["query",canonicalQuery(p.query)],["audience",token(p.audience,"audience")],["keyId",token(p.keyId,"keyId")],["timestamp",iso(p.timestamp,"timestamp")],["nonce",token(p.nonce,"nonce")],["requestId",token(p.requestId,"requestId")],["companyId",token(p.companyId,"companyId")],["projectId",token(p.projectId,"projectId")],["feedbackId",token(p.feedbackId,"feedbackId")],["objectId",token(p.objectId,"objectId")],["byteCount",bytes(p.byteCount)],["sha256",digest(p.sha256,"sha256")],["bodySha256",digest(p.bodySha256,"bodySha256")]]);}
export function canonicalReceipt(p:ReceiptContract){return canonical("bimlog-feedback-relay-receipt-v1",[["version",p.version],["requestId",token(p.requestId,"requestId")],["companyId",token(p.companyId,"companyId")],["projectId",token(p.projectId,"projectId")],["feedbackId",token(p.feedbackId,"feedbackId")],["objectId",token(p.objectId,"objectId")],["byteCount",bytes(p.byteCount)],["sha256",digest(p.sha256,"sha256")],["destinationId",token(p.destinationId,"destinationId")],["receivedAt",iso(p.receivedAt,"receivedAt")],["requestNonce",token(p.requestNonce,"requestNonce")],["receiverKeyId",token(p.receiverKeyId,"receiverKeyId")]]);}
export function canonicalReadback(p:ReadbackContract){return canonical("bimlog-feedback-relay-readback-v1",[["version",p.version],["requestId",token(p.requestId,"requestId")],["companyId",token(p.companyId,"companyId")],["projectId",token(p.projectId,"projectId")],["feedbackId",token(p.feedbackId,"feedbackId")],["objectId",token(p.objectId,"objectId")],["byteCount",bytes(p.byteCount)],["sha256",digest(p.sha256,"sha256")],["destinationId",token(p.destinationId,"destinationId")],["verifiedAt",iso(p.verifiedAt,"verifiedAt")],["receiptSha256",digest(p.receiptSha256,"receiptSha256")],["receiverKeyId",token(p.receiverKeyId,"receiverKeyId")]]);}
export const sha256=(value:Buffer|string)=>createHash("sha256").update(value).digest("hex");
const mac=(canonicalValue:string,secret:Buffer)=>createHmac("sha256",secret).update(canonicalValue,"utf8").digest("hex");

function keyAt(ring:RelayKeyRing,keyId:string,at:Date,signing:boolean,historical=false){
  const active=ring.keys.filter(k=>k.status==="active");if(active.length!==1||active[0].id!==ring.activeKeyId)throw new RelayProtocolError("FEEDBACK_RELAY_KEY_RING_INVALID","Relay key ring must have exactly one matching active key");
  const duplicate=ring.keys.filter(k=>k.id===keyId); if(duplicate.length!==1) throw new RelayProtocolError("FEEDBACK_RELAY_KEY_UNKNOWN","Relay key is unavailable",{keyId});
  const key=duplicate[0]; if(key.secret.length<32)throw new RelayProtocolError("FEEDBACK_RELAY_KEY_INVALID","Relay key is invalid",{keyId});
  if(key.status==="revoked"&&(!historical||!key.revokedAt||at>=key.revokedAt))throw new RelayProtocolError("FEEDBACK_RELAY_KEY_REVOKED","Relay key is revoked",{keyId});
  if(at<key.notBefore||at>key.notAfter)throw new RelayProtocolError("FEEDBACK_RELAY_KEY_OUTSIDE_WINDOW","Relay key is outside its validity window",{keyId});
  if(signing&&(key.status!=="active"||key.id!==ring.activeKeyId))throw new RelayProtocolError("FEEDBACK_RELAY_SIGNING_KEY_NOT_ACTIVE","Signing requires the active key",{keyId});
  return key;
}
function equalSignature(actual:string,expected:string){if(!HEX64.test(actual))return false;return timingSafeEqual(Buffer.from(actual,"hex"),Buffer.from(expected,"hex"));}
export function signRequest(payload:RequestContract,ring:RelayKeyRing,at=new Date()):Signed<RequestContract>{const key=keyAt(ring,ring.activeKeyId,at,true);if(payload.keyId!==key.id)throw new RelayProtocolError("FEEDBACK_RELAY_SIGNING_KEY_NOT_ACTIVE","Request keyId is not active");return{payload,signature:mac(canonicalRequest(payload),key.secret)};}
export function signReceipt(payload:ReceiptContract,ring:RelayKeyRing,at=new Date()):Signed<ReceiptContract>{const key=keyAt(ring,ring.activeKeyId,at,true);if(payload.receiverKeyId!==key.id)throw new RelayProtocolError("FEEDBACK_RELAY_SIGNING_KEY_NOT_ACTIVE","Receipt keyId is not active");return{payload,signature:mac(canonicalReceipt(payload),key.secret)};}
export function signReadback(payload:ReadbackContract,ring:RelayKeyRing,at=new Date()):Signed<ReadbackContract>{const key=keyAt(ring,ring.activeKeyId,at,true);if(payload.receiverKeyId!==key.id)throw new RelayProtocolError("FEEDBACK_RELAY_SIGNING_KEY_NOT_ACTIVE","Readback keyId is not active");return{payload,signature:mac(canonicalReadback(payload),key.secret)};}

export function verifyReceiptDurably(signed:Signed<ReceiptContract>,ring:RelayKeyRing,verifiedAt=new Date()):DurableReceiptVerification{const signedAt=new Date(iso(signed.payload.receivedAt,"receivedAt"));if(signedAt>verifiedAt)throw new RelayProtocolError("FEEDBACK_RELAY_TIMESTAMP_SKEW","Receipt timestamp is in the future");const key=keyAt(ring,signed.payload.receiverKeyId,signedAt,false,true);const value=canonicalReceipt(signed.payload);if(!equalSignature(signed.signature,mac(value,key.secret)))throw new RelayProtocolError("FEEDBACK_RELAY_SIGNATURE_INVALID","Receipt signature is invalid",{keyId:key.id});return{version:"1",requestId:signed.payload.requestId,companyId:signed.payload.companyId,projectId:signed.payload.projectId,keyId:key.id,signedAt:signed.payload.receivedAt,canonicalSha256:sha256(value),signature:signed.signature,verifiedAt:verifiedAt.toISOString()};}
export function verifyReceipt(signed:Signed<ReceiptContract>,ring:RelayKeyRing,at=new Date()){verifyReceiptDurably(signed,ring,at);return signed.payload;}
export function verifyReadback(signed:Signed<ReadbackContract>,ring:RelayKeyRing,at=new Date()){const key=keyAt(ring,signed.payload.receiverKeyId,at,false);if(!equalSignature(signed.signature,mac(canonicalReadback(signed.payload),key.secret)))throw new RelayProtocolError("FEEDBACK_RELAY_SIGNATURE_INVALID","Readback signature is invalid",{keyId:key.id});return signed.payload;}
export function assertTimestampWindow(timestamp:string,now:Date,maxSkewMs:number){const parsed=new Date(iso(timestamp,"timestamp"));if(!Number.isSafeInteger(maxSkewMs)||maxSkewMs<0||Math.abs(now.getTime()-parsed.getTime())>maxSkewMs)throw new RelayProtocolError("FEEDBACK_RELAY_TIMESTAMP_SKEW","Timestamp is outside the permitted window");}
export async function verifyRequest(signed:Signed<RequestContract>,ring:RelayKeyRing,nonces:NonceAuthority,options:{now?:Date;maxSkewMs:number}){
  const now=options.now??new Date(); const key=keyAt(ring,signed.payload.keyId,now,false); const timestamp=new Date(signed.payload.timestamp);
  canonicalRequest(signed.payload);
  assertTimestampWindow(timestamp.toISOString(),now,options.maxSkewMs);
  if(!equalSignature(signed.signature,mac(canonicalRequest(signed.payload),key.secret)))throw new RelayProtocolError("FEEDBACK_RELAY_SIGNATURE_INVALID","Request signature is invalid",{keyId:key.id});
  const requestSha256=sha256(canonicalRequest(signed.payload));if(!await nonces.consume({audience:signed.payload.audience,keyId:key.id,nonce:signed.payload.nonce,timestamp:signed.payload.timestamp,requestId:signed.payload.requestId,companyId:signed.payload.companyId,projectId:signed.payload.projectId,requestSha256}))throw new RelayProtocolError("FEEDBACK_RELAY_NONCE_REPLAY","Request nonce was already consumed",{keyId:key.id});
  return signed.payload;
}

export function assertReceiptMatchesRequest(receipt:ReceiptContract,request:RequestContract,destinationId:string){
  if(receipt.requestId!==request.requestId||receipt.companyId!==request.companyId||receipt.projectId!==request.projectId||receipt.feedbackId!==request.feedbackId||receipt.objectId!==request.objectId||receipt.byteCount!==request.byteCount||receipt.sha256!==request.sha256||receipt.requestNonce!==request.nonce||receipt.destinationId!==destinationId)throw new RelayProtocolError("FEEDBACK_RELAY_RECEIPT_MISMATCH","Receipt does not match the requested object");
}
export function assertReadbackMatchesReceipt(readback:ReadbackContract,receipt:Signed<ReceiptContract>){
  if(readback.requestId!==receipt.payload.requestId||readback.companyId!==receipt.payload.companyId||readback.projectId!==receipt.payload.projectId||readback.feedbackId!==receipt.payload.feedbackId||readback.objectId!==receipt.payload.objectId||readback.byteCount!==receipt.payload.byteCount||readback.sha256!==receipt.payload.sha256||readback.destinationId!==receipt.payload.destinationId||readback.receiptSha256!==sha256(canonicalReceipt(receipt.payload)))throw new RelayProtocolError("FEEDBACK_RELAY_READBACK_MISMATCH","Readback does not match the signed receipt");
}

export async function verifyObjectStream(source:AsyncIterable<Uint8Array>,expected:{byteCount:number;sha256:string}){
  bytes(expected.byteCount);digest(expected.sha256,"sha256");const hash=createHash("sha256");let total=0;
  for await(const chunk of source){total+=chunk.byteLength;if(total>expected.byteCount)throw new RelayProtocolError("FEEDBACK_RELAY_OBJECT_BYTES_MISMATCH","Object exceeded its declared byte count");hash.update(chunk);}
  if(total!==expected.byteCount||hash.digest("hex")!==expected.sha256)throw new RelayProtocolError("FEEDBACK_RELAY_OBJECT_BYTES_MISMATCH","Object bytes did not match their declared identity");return{byteCount:total,sha256:expected.sha256};
}

export function safeRelayError(error:unknown){return error instanceof RelayProtocolError?{code:error.code,message:error.message,...error.safeMetadata}:{code:"FEEDBACK_RELAY_INTERNAL",message:"Feedback relay operation failed"};}
