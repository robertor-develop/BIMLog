import { createHash } from "node:crypto";
import { BIMLOG_AGENT_LANES, intakeEnvelopeDigest, parseIntakeEnvelope, type IntakeSource } from "./agent-lane-contract";

export type DiscoveryRecord={sourceId:string;versionId:string;locator:string;name:string;bytes:number;content:string};
export type CrawlPage={records:DiscoveryRecord[];nextCursor:string|null};
export type CrawlInput={requestId:string;companyId:number;projectId:number;source:IntakeSource;sourceAccountId:string;pages:CrawlPage[];cancelled?:boolean;maxPages?:number};

export function buildZeroImportPreview(input:CrawlInput){
  const maxPages=Math.min(Math.max(input.maxPages??25,1),25);
  if(input.cancelled)return {state:"cancelled" as const,pagesRead:0,recordsFound:0,canonicalMutation:false,intake:null};
  if(input.pages.length>maxPages)throw new Error("CRAWL_PAGE_LIMIT_EXCEEDED");
  const seen=new Set<string>();let cursor:string|null=null;const records:DiscoveryRecord[]=[];
  input.pages.forEach((page,index)=>{
    if(index>0&&cursor===null)throw new Error("CRAWL_UNEXPECTED_PAGE");
    if(page.nextCursor&&page.nextCursor===cursor)throw new Error("CRAWL_CURSOR_DID_NOT_ADVANCE");
    for(const record of page.records){const id=`${record.sourceId}:${record.versionId}`;if(seen.has(id))continue;seen.add(id);records.push(record);}
    cursor=page.nextCursor;
  });
  const envelope=parseIntakeEnvelope({lane:"intake",requestId:input.requestId,companyId:input.companyId,projectId:input.projectId,source:input.source,sourceAccountId:input.sourceAccountId,reviewState:"preview",canonicalMutation:false,discoveredAt:new Date(0).toISOString(),records:records.map(record=>({sourceId:record.sourceId,versionId:record.versionId,locator:record.locator,sha256:createHash("sha256").update(record.content).digest("hex")}))});
  return {state:"preview_ready" as const,pagesRead:input.pages.length,recordsFound:records.length,canonicalMutation:false,ignoredEmbeddedInstructions:true,handoff:{transport:BIMLOG_AGENT_LANES.intake.transport,threadId:BIMLOG_AGENT_LANES.intake.threadId,envelope,digest:intakeEnvelopeDigest(envelope)}};
}
