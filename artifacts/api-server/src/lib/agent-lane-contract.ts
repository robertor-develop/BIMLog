import { createHash } from "node:crypto";

export const BIMLOG_AGENT_LANES = Object.freeze({
  conversation: { threadId: "01a10a95-a2e5-73d3-a471-6738addc7e42", transport: "main04a", contractVersion: "bimlog-conversation/v2" },
  intake: { threadId: "01a15b79-db29-7131-a627-474d99495909", transport: "main04b", contractVersion: "bimlog-intake-envelope/v1" },
});

export type AgentLane = keyof typeof BIMLOG_AGENT_LANES;
export type IntakeSource = "procore" | "sharepoint" | "outlook" | "google_drive" | "dropbox" | "upload";
export type IntakeLocator = { sourceId: string; versionId: string; locator: string; sha256: string };
export type IntakeEnvelope = {
  lane: "intake";
  requestId: string;
  companyId: number;
  projectId: number;
  source: IntakeSource;
  sourceAccountId: string;
  records: IntakeLocator[];
  reviewState: "preview";
  canonicalMutation: false;
  discoveredAt: string;
};

const SHA256=/^[a-f0-9]{64}$/i;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertConversationLane(body: Record<string, unknown>): void {
  if (body.lane && body.lane !== "conversation") throw new Error("AGENT_LANE_CROSSOVER_REJECTED");
  for (const key of ["files","documents","records","sourceAccountId","canonicalMutation"])
    if (body[key] !== undefined) throw new Error("AGENT_LANE_CROSSOVER_REJECTED");
}

export function parseIntakeEnvelope(value: unknown): IntakeEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INTAKE_ENVELOPE_REQUIRED");
  const input=value as Record<string,unknown>;
  if (input.lane !== "intake") throw new Error("AGENT_LANE_CROSSOVER_REJECTED");
  if (!UUID.test(String(input.requestId||""))) throw new Error("INTAKE_REQUEST_ID_INVALID");
  if (!Number.isSafeInteger(input.companyId)||Number(input.companyId)<=0||!Number.isSafeInteger(input.projectId)||Number(input.projectId)<=0) throw new Error("INTAKE_AUTHORITY_INVALID");
  if (input.canonicalMutation !== false || input.reviewState !== "preview") throw new Error("INTAKE_REVIEW_REQUIRED");
  const records=Array.isArray(input.records)?input.records:[];
  if (!records.length||records.length>100) throw new Error("INTAKE_RECORD_COUNT_INVALID");
  const parsed=records.map((record)=>{
    if(!record||typeof record!=="object"||Array.isArray(record))throw new Error("INTAKE_RECORD_INVALID");
    const item=record as Record<string,unknown>;
    const sourceId=String(item.sourceId||"").trim(),versionId=String(item.versionId||"").trim(),locator=String(item.locator||"").trim(),sha256=String(item.sha256||"").trim();
    if(!sourceId||!versionId||!locator||!SHA256.test(sha256))throw new Error("INTAKE_PROVENANCE_INVALID");
    return {sourceId,versionId,locator,sha256};
  });
  return {...input,companyId:Number(input.companyId),projectId:Number(input.projectId),records:parsed,source:String(input.source) as IntakeSource,sourceAccountId:String(input.sourceAccountId||""),discoveredAt:String(input.discoveredAt||"")} as IntakeEnvelope;
}

export function intakeEnvelopeDigest(envelope:IntakeEnvelope):string {
  return createHash("sha256").update(JSON.stringify(envelope)).digest("hex");
}
