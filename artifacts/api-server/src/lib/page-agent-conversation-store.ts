import { createHash, randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { BIMLOG_MAIN04_THREAD_ID, dispatchBimlogMain04, readBimlogMain04, type Main04QuestionContext } from "./main04-agent-transport";

export type PageAgentState = "reserved" | "running" | "complete" | "failed";
export type PageAgentTurn = { requestId:string; conversationId:string; projectId:number|null; question:string; answer:string|null; state:PageAgentState; errorCode:string|null; createdAt:string; updatedAt:string; completedAt:string|null };
type ReserveInput = { requestId:string; conversationId:string; companyId:number; userId:number; projectId:number|null; question:string; context:Main04QuestionContext };
let migration: Promise<void> | null = null;
const active = new Map<string, Promise<void>>();

function ensureSchema() {
  migration ??= (async()=>{
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(1604521)");
      await client.query(`CREATE TABLE IF NOT EXISTS page_agent_turns (
        request_id uuid PRIMARY KEY, conversation_id uuid NOT NULL, company_id integer NOT NULL REFERENCES companies(id),
        user_id integer NOT NULL REFERENCES users(id), project_id integer REFERENCES projects(id), question text NOT NULL,
        context jsonb NOT NULL, answer text, answer_digest text, state text NOT NULL DEFAULT 'reserved', error_code text,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
        CONSTRAINT page_agent_turns_state_chk CHECK(state IN ('reserved','running','complete','failed')),
        CONSTRAINT page_agent_turns_question_chk CHECK(length(question) BETWEEN 1 AND 2000)
      )`);
      await client.query("CREATE INDEX IF NOT EXISTS page_agent_turns_actor_history_idx ON page_agent_turns(company_id,user_id,conversation_id,created_at,request_id)");
      await client.query("CREATE UNIQUE INDEX IF NOT EXISTS page_agent_turns_actor_active_idx ON page_agent_turns(company_id,user_id,conversation_id) WHERE state IN ('reserved','running')");
      await client.query("COMMIT");
    } catch(error) { await client.query("ROLLBACK"); migration=null; throw error; } finally { client.release(); }
  })();
  return migration;
}

function row(value:any):PageAgentTurn{return{requestId:String(value.request_id),conversationId:String(value.conversation_id),projectId:value.project_id===null?null:Number(value.project_id),question:String(value.question),answer:typeof value.answer==="string"?value.answer:null,state:value.state,errorCode:value.error_code??null,createdAt:new Date(value.created_at).toISOString(),updatedAt:new Date(value.updated_at).toISOString(),completedAt:value.completed_at?new Date(value.completed_at).toISOString():null};}

export async function reservePageAgentTurn(input:ReserveInput){
  await ensureSchema();
  const digest=createHash("sha256").update(JSON.stringify({question:input.question,context:input.context}),"utf8").digest("hex");
  try {
    const result=await pool.query(`INSERT INTO page_agent_turns(request_id,conversation_id,company_id,user_id,project_id,question,context)
      VALUES($1,$2,$3,$4,$5,$6,$7::jsonb) ON CONFLICT(request_id) DO NOTHING RETURNING *`,[input.requestId,input.conversationId,input.companyId,input.userId,input.projectId,input.question,JSON.stringify({...input.context,requestDigest:digest})]);
    if(result.rows[0])return row(result.rows[0]);
  } catch(error:any) { if(error?.code==="23505") throw new Error("PAGE_AGENT_CONVERSATION_BUSY"); throw error; }
  const existing=await getPageAgentTurn(input.requestId,input.companyId,input.userId);
  if(!existing||existing.question!==input.question||existing.conversationId!==input.conversationId)throw new Error("PAGE_AGENT_REQUEST_CONFLICT");
  return existing;
}

export async function getPageAgentTurn(requestId:string,companyId:number,userId:number){await ensureSchema();const result=await pool.query("SELECT * FROM page_agent_turns WHERE request_id=$1 AND company_id=$2 AND user_id=$3",[requestId,companyId,userId]);return result.rows[0]?row(result.rows[0]):null;}
export async function listPageAgentTurns(conversationId:string,companyId:number,userId:number){await ensureSchema();const result=await pool.query("SELECT * FROM page_agent_turns WHERE conversation_id=$1 AND company_id=$2 AND user_id=$3 ORDER BY created_at,request_id LIMIT 100",[conversationId,companyId,userId]);return result.rows.map(row);}
export async function refreshPageAgentTurn(requestId:string,companyId:number,userId:number){const current=await getPageAgentTurn(requestId,companyId,userId);if(!current||current.state==="complete"||current.state==="failed")return current;try{const result=await readBimlogMain04(requestId);if(result.answer){await complete(requestId,result.answer);return await getPageAgentTurn(requestId,companyId,userId);}}catch(error:any){if(!String(error?.message||"").includes("404"))console.warn(JSON.stringify({event:"page_agent_refresh_pending",requestId,code:String(error?.message||"UNKNOWN")}));}return current;}

async function processTurn(input:ReserveInput){
  const claimed=await pool.query("UPDATE page_agent_turns SET state='running',updated_at=now() WHERE request_id=$1 AND company_id=$2 AND user_id=$3 AND state='reserved' RETURNING request_id",[input.requestId,input.companyId,input.userId]);
  const current=await getPageAgentTurn(input.requestId,input.companyId,input.userId);
  if(!current||current.state==="complete"||current.state==="failed")return;
  try {
    if(claimed.rows.length) {
      const dispatched=await dispatchBimlogMain04(input);
      if(dispatched.answer){await complete(input.requestId,dispatched.answer);return;}
    }
    const deadline=Date.now()+10*60_000;
    while(Date.now()<deadline){const result=await readBimlogMain04(input.requestId);if(result.answer){await complete(input.requestId,result.answer);return;}await new Promise(resolve=>setTimeout(resolve,1500));}
    throw new Error("MAIN04_TRANSPORT_TIMEOUT");
  } catch(error:any) {
    const code=String(error?.message||"PAGE_AGENT_FAILED").slice(0,120);
    await pool.query("UPDATE page_agent_turns SET state='failed',error_code=$2,updated_at=now() WHERE request_id=$1 AND state<>'complete'",[input.requestId,code]);
    console.error(JSON.stringify({event:"page_agent_turn_failed",requestId:input.requestId,code}));
  }
}
async function complete(requestId:string,answer:string){const clean=answer.trim().slice(0,16000);if(!clean)throw new Error("MAIN04_ANSWER_MISSING");await pool.query("UPDATE page_agent_turns SET state='complete',answer=$2,answer_digest=$3,error_code=NULL,updated_at=now(),completed_at=now() WHERE request_id=$1",[requestId,clean,createHash("sha256").update(clean,"utf8").digest("hex")]);}
export function startPageAgentTurn(input:ReserveInput){if(active.has(input.requestId))return;const work=processTurn(input).finally(()=>active.delete(input.requestId));active.set(input.requestId,work);}
export function newConversationId(){return randomUUID();}
export const PAGE_AGENT_DESTINATION=BIMLOG_MAIN04_THREAD_ID;
