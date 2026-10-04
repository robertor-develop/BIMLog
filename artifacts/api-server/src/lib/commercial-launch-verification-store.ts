import type {Pool} from "pg";
import type {CommercialLiveCheck} from "./commercial-stripe-live-verification";
import type {CommercialVerificationEvidence} from "./commercial-launch-verification-evidence";

type VerificationResult={status:"configuration_blocked"|"verified"|"failed";verified:boolean;checks:readonly CommercialLiveCheck[];checkedAt:string;evidence:CommercialVerificationEvidence|null};
export type StoredCommercialVerification={id:string;actorUserId:number;sourceCommit:string;status:VerificationResult["status"];verified:boolean;checkedAt:string;validUntil:string;checkCount:number;failedCheckIds:string[];checks:CommercialLiveCheck[];evidenceSha256:string;recordedAt:string};

function parseJsonArray(value:unknown,label:string){if(typeof value!=="string")throw new Error(`${label} is invalid`);const parsed=JSON.parse(value);if(!Array.isArray(parsed))throw new Error(`${label} is invalid`);return parsed;}
function mapRow(row:Record<string,unknown>):StoredCommercialVerification{
  const failedCheckIds=parseJsonArray(row.failed_check_ids_json,"Stored failed checks");
  const checks=parseJsonArray(row.checks_json,"Stored checks");
  if(failedCheckIds.some(value=>typeof value!=="string")||checks.some(value=>!value||typeof value!=="object"||typeof value.id!=="string"||!['verified','failed'].includes(String(value.status))||typeof value.code!=="string"))throw new Error("Stored commercial verification is invalid");
  return {id:String(row.id),actorUserId:Number(row.actor_user_id),sourceCommit:String(row.source_commit),status:String(row.status) as StoredCommercialVerification["status"],verified:row.verified==="true",checkedAt:new Date(String(row.checked_at)).toISOString(),validUntil:new Date(String(row.valid_until)).toISOString(),checkCount:Number(row.check_count),failedCheckIds:failedCheckIds as string[],checks:checks as CommercialLiveCheck[],evidenceSha256:String(row.evidence_sha256),recordedAt:new Date(String(row.recorded_at)).toISOString()};
}

export async function recordCommercialLaunchVerification(client:Pick<Pool,"query">,actorUserId:number,result:VerificationResult){
  if(!Number.isInteger(actorUserId)||actorUserId<=0)throw new Error("Verification actor is invalid");
  const evidence=result.evidence;if(!evidence)throw new Error("Source-bound verification evidence is required");
  const checks=result.checks.map(({id,status,code})=>({id,status,code}));
  const id=`launch-verification-${evidence.evidenceSha256}`;
  await client.query(`INSERT INTO commercial_launch_verifications(id,actor_user_id,source_commit,status,verified,checked_at,valid_until,check_count,failed_check_ids_json,checks_json,evidence_sha256) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (evidence_sha256) DO NOTHING`,[id,actorUserId,evidence.sourceCommit,evidence.status,String(evidence.verified),evidence.checkedAt,evidence.validUntil,evidence.checkCount,JSON.stringify(evidence.failedCheckIds),JSON.stringify(checks),evidence.evidenceSha256]);
  const stored=await client.query(`SELECT * FROM commercial_launch_verifications WHERE evidence_sha256=$1`,[evidence.evidenceSha256]);
  if(stored.rows.length!==1)throw new Error("Commercial verification receipt was not stored");
  return mapRow(stored.rows[0]);
}

export async function readCommercialLaunchVerificationHistory(client:Pick<Pool,"query">,limit=10){
  if(!Number.isInteger(limit)||limit<1||limit>25)throw new Error("Verification history limit is invalid");
  const result=await client.query(`SELECT * FROM commercial_launch_verifications ORDER BY checked_at DESC,id DESC LIMIT $1`,[limit]);
  return result.rows.map(mapRow);
}
