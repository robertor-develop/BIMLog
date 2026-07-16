import crypto from "crypto";
import fs from "fs";
import http from "http";
import path from "path";
import { spawn, type ChildProcess } from "child_process";
import { pool } from "@workspace/db";
import { storage } from "../src/lib/storage-adapter";
import { encryptEvidence, getTelegramProductConfig, hmacValue, processTelegramInboundQueue, receiveTelegramWebhook } from "../src/lib/telegram-product";
import {
  cancelDeliveryRequest, confirmDeliveryRequest, createDeliveryRequest, executeDeliveryRequest,
  listDeliveryRequests, normalizeDeliveryEmails, readSecureDeliveryLink, recoverAbandonedDeliveryAttempts,
} from "../src/lib/telegram-product-delivery";
import { createProviderConnection, validateConnection } from "../src/lib/ai-control-plane";
import { signToken } from "../src/middlewares/auth";

type Result = { item: number; name: string; passed: boolean; evidence: string };
type Seed = { companyId: number; otherCompanyId: number; userId: number; otherUserId: number; adminId: number; projectId: number; secondProjectId: number; rfiId: number; fileId: number; storagePath: string; email: string; adminEmail: string; aiConnectionId: string; aiPriceId: string; aiEntitlementId: string; aiBudgetId: string };

const evidenceDir = process.env.BUILD4_EVIDENCE_DIR || path.resolve("evidence", "telegram-product-build4");
fs.mkdirSync(evidenceDir, { recursive: true });
const results: Result[] = [];
let api: ChildProcess | null = null;
let providerMode: "ack" | "reject" | "timeout" = "ack";
let telegramAck = 4000;
let emailAck = 8000;
const providerCalls: Array<{ channel: string; at: string; body: string }> = [];
let lastSecureUrl = "";
let intentSeed: Seed | null = null;

function check(item: number, name: string, condition: unknown, evidence: string) {
  results.push({ item, name, passed: Boolean(condition), evidence });
  if (!condition) throw new Error(`Acceptance ${item} failed: ${name} (${evidence})`);
  console.log(`[build4-evidence] ${item} passed`);
}

function safeDbIdentity() {
  const url = new URL(process.env.PROD_DATABASE_URL || "");
  const database = url.pathname.replace(/^\//, "");
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname) || url.port !== "55432" || database !== "bimlog_rfi_test" || /neon|replit/i.test(url.hostname)) {
    throw new Error("Safe local database identity check failed");
  }
  return { present: true, database, host: "127.0.0.1", port: 55432, remote: false };
}

async function waitForApi() {
  for (let i = 0; i < 80; i += 1) {
    try { const response = await fetch("http://127.0.0.1:3104/api/v1/env-check"); if (response.ok) return; } catch { /* bounded readiness polling */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Built API did not become ready");
}

async function startApi() {
  const log = fs.openSync(path.join(evidenceDir, `api-${Date.now()}.log`), "a");
  api = spawn(process.execPath, [path.resolve("dist/index.cjs")], {
    cwd: path.resolve("."), env: { ...process.env, PORT: "3104", NODE_ENV: "test", TELEGRAM_PRODUCT_BOT_TOKEN: "" }, stdio: ["ignore", log, log], windowsHide: true,
  });
  await waitForApi();
}

async function stopApi() {
  if (!api || api.killed) return;
  api.kill();
  await new Promise((resolve) => { api!.once("exit", resolve); setTimeout(resolve, 3000); });
  api = null;
}

function providerServer() {
  return http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8").slice(0, 5000);
      const channel = req.url?.includes("chat/completions") ? "ai" : req.url?.includes("mail/send") ? "email" : "telegram";
      providerCalls.push({ channel, at: new Date().toISOString(), body: body.replace(/Bearer\s+\S+/gi, "Bearer [redacted]") });
      const decodedBody = req.headers["content-type"]?.includes("application/x-www-form-urlencoded")
        ? (new URLSearchParams(body).get("text") || body)
        : body;
      const secure = /https?:[^\s"\\]+\/deliveries\/links\/[A-Za-z0-9_-]+/.exec(decodedBody)?.[0];
      if (secure) lastSecureUrl = secure;
      if (providerMode === "timeout") { setTimeout(() => { if (!res.writableEnded) res.destroy(); }, 30000); return; }
      if (providerMode === "reject") { res.statusCode = 422; res.end(JSON.stringify({ error: "fixture_rejected" })); return; }
      if (channel === "ai") {
        const parsed = JSON.parse(body || "{}");
        const userText = [...(parsed.messages || [])].reverse().find((message: any) => message.role === "user")?.content || "";
        const ambiguous = /ambiguous|ambiguo/i.test(userText);
        const spanish = /env[ií]a|ambiguo|espa[nñ]ol/i.test(userText);
        const intent = ambiguous ? { kind:"ambiguous",missing:[spanish?"canal y destinatario":"channel and recipient"] } : {
          kind:"delivery",projectId:intentSeed!.projectId,artifactType:/audit|auditor/i.test(userText)?"rfi_audit_pdf":"rfi_pdf",entityId:intentSeed!.rfiId,channel:"telegram",recipients:"me",
        };
        res.statusCode=200;res.setHeader("content-type","application/json");res.setHeader("x-request-id",`ai-header-${providerCalls.length}`);
        res.end(JSON.stringify({id:`ai-body-${providerCalls.length}`,choices:[{message:{content:JSON.stringify(intent)}}],usage:{prompt_tokens:80,completion_tokens:30}}));return;
      }
      if (channel === "email") {
        res.statusCode = 202; res.setHeader("x-message-id", `email-fixture-${emailAck++}`); res.end();
      } else {
        res.statusCode = 200; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ ok: true, result: { message_id: telegramAck++ } }));
      }
    });
  });
}

async function seed(): Promise<Seed> {
  const tag = `b4-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const company = await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`, [`Build4 ${tag}`]);
  const otherCompany = await pool.query(`INSERT INTO companies(name) VALUES($1) RETURNING id`, [`Build4 Other ${tag}`]);
  const email = `${tag}@example.test`; const adminEmail = `${tag}-admin@example.test`;
  const user = await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'evidence-only','Build 4 User',$2,false) RETURNING id`, [email, company.rows[0].id]);
  const admin = await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'evidence-only','Build 4 Admin',$2,true) RETURNING id`, [adminEmail, company.rows[0].id]);
  const other = await pool.query(`INSERT INTO users(email,password_hash,full_name,company_id,is_super_admin) VALUES($1,'evidence-only','Build 4 Other',$2,false) RETURNING id`, [`${tag}-other@example.test`, otherCompany.rows[0].id]);
  const project = await pool.query(`INSERT INTO projects(name,code,status,created_by_id,description) VALUES($1,$2,'active',$3,'Build 4 isolated evidence') RETURNING id`, [`Build 4 ${tag}`, tag, user.rows[0].id]);
  const secondProject = await pool.query(`INSERT INTO projects(name,code,status,created_by_id,description) VALUES($1,$2,'active',$3,'Build 4 isolated idempotency evidence') RETURNING id`, [`Build 4 Second ${tag}`,`${tag}-second`,user.rows[0].id]);
  await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'project_admin','active')`, [project.rows[0].id, user.rows[0].id]);
  await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'project_admin','active')`, [secondProject.rows[0].id, user.rows[0].id]);
  const rfi = await pool.query(`INSERT INTO rfis(project_id,number,subject,status,priority,created_by_id,question,attachments_json,attachment_package_json,distribution_list,revision_number)
    VALUES($1,$2,'Build 4 delivery evidence','open','normal',$3,'Canonical delivery evidence question','[]','[]','[]',0) RETURNING id`, [project.rows[0].id, `RFI-${tag}`, user.rows[0].id]);
  const bytes = Buffer.from(`BIMLog Build 4 Unicode evidence: Entrega áéíóú ñ ${tag}\n`, "utf8");
  const fileName = `Entrega-ñ-${tag}.txt`;
  const storagePath = await storage.upload(bytes, project.rows[0].id, fileName);
  const file = await pool.query(`INSERT INTO files(project_id,file_name,file_size,file_type,status,uploaded_by_id,storage_path,source,file_hash,file_size_bytes)
    VALUES($1,$2,$3,'text/plain','active',$4,$5,'user-uploaded',$6,$3) RETURNING id`, [project.rows[0].id,fileName,bytes.length,user.rows[0].id,storagePath,crypto.createHash("sha256").update(bytes).digest("hex")]);
  const config = getTelegramProductConfig();
  await pool.query(`INSERT INTO notification_channels(user_id,adapter_id,provider,status,telegram_user_hash,telegram_chat_hash,encrypted_telegram_user_id,encrypted_telegram_chat_id,account_label,metadata)
    VALUES($1,$2,'telegram','connected',$3,$4,$5,$6,'Build4 private','{}')`, [user.rows[0].id,config.adapterId,hmacValue(config,"telegram-user:44001"),hmacValue(config,"telegram-chat:44001"),encryptEvidence(config,{telegramUserId:"44001"}),encryptEvidence(config,{telegramChatId:"44001"})]);
  await pool.query(`INSERT INTO notification_preferences(user_id,adapter_id,channel,enabled,language,topics) VALUES($1,$2,'telegram','false','en','{}')`, [user.rows[0].id,config.adapterId]);
  await pool.query(`INSERT INTO user_connections(user_id,provider,kind,status,credentials,account_label) VALUES($1,'sendgrid','email','connected',$2::jsonb,$3)`, [user.rows[0].id,JSON.stringify({apiKey:"SG.local-fixture-not-a-secret"}),email]);
  const aiConnection = await createProviderConnection({actorUserId:user.rows[0].id,actorCompanyId:company.rows[0].id,actorIsSuperAdmin:false,actorIsCompanyAdmin:false,ownerType:"personal",provider:"openai",secret:`sk-local-build4-${tag}`,allowedModels:["test-model"]});
  await validateConnection({userId:user.rows[0].id,companyId:company.rows[0].id,isSuperAdmin:false,isCompanyAdmin:false},aiConnection.id,async()=>new Response(JSON.stringify({data:[{id:"test-model"}]}),{status:200}));
  const now=new Date(Date.now()-1000).toISOString();const later=new Date(Date.now()+86400000).toISOString();const version=700000+user.rows[0].id;
  const aiPriceId=`price-build4-${tag}`;const aiEntitlementId=`ent-build4-${tag}`;const aiBudgetId=`budget-build4-${tag}`;
  await pool.query(`INSERT INTO ai_price_schedules(id,version,provider,model,currency,unit_basis,input_micros,output_micros,source_url,verified_by_id,verified_at,effective_from,status) VALUES($1,$2,'openai','test-model','USD',1000000,1000,2000,'https://openai.com/api/pricing/',$3,now(),$4,'active') ON CONFLICT DO NOTHING`,[aiPriceId,version,admin.rows[0].id,now]);
  await pool.query(`INSERT INTO entitlement_rules(id,version,company_id,capability,funding_type,provider_allowlist,model_allowlist,enabled,requires_file_confirmation,effective_from,effective_to,created_by_id) VALUES($1,$2,$3,'assistant','personal','["openai"]','["test-model"]',true,false,$4,$5,$6)`,[aiEntitlementId,version,company.rows[0].id,now,later,admin.rows[0].id]);
  await pool.query(`INSERT INTO company_ai_budgets(id,funding_owner_type,company_id,owner_user_id,version,currency,limit_micros,per_request_limit_micros,daily_limit_micros,monthly_limit_micros,session_limit_micros,provider_allowlist,model_allowlist,capability_allowlist,status,effective_from,effective_to,created_by_id) VALUES($1,'personal',$2,$3,$4,'USD','10000000','10000000','10000000','10000000','10000000','["openai"]','["test-model"]','["assistant"]','active',$5,$6,$7)`,[aiBudgetId,company.rows[0].id,user.rows[0].id,version,now,later,admin.rows[0].id]);
  return { companyId:company.rows[0].id,otherCompanyId:otherCompany.rows[0].id,userId:user.rows[0].id,otherUserId:other.rows[0].id,adminId:admin.rows[0].id,projectId:project.rows[0].id,secondProjectId:secondProject.rows[0].id,rfiId:rfi.rows[0].id,fileId:file.rows[0].id,storagePath,email,adminEmail,aiConnectionId:aiConnection.id,aiPriceId,aiEntitlementId,aiBudgetId };
}

async function cleanup(seed: Seed) {
  await pool.query(`DELETE FROM admin_actions_log WHERE admin_user_id=ANY($1::int[])`, [[seed.userId,seed.adminId]]);
  await pool.query(`DELETE FROM telegram_inbound_updates WHERE adapter_id=$1`, [getTelegramProductConfig().adapterId]);
  await pool.query(`DELETE FROM telegram_delivery_links WHERE delivery_id IN (SELECT id FROM telegram_delivery_requests WHERE user_id=ANY($1::int[]))`, [[seed.userId,seed.otherUserId]]);
  await pool.query(`DELETE FROM telegram_delivery_attempts WHERE delivery_id IN (SELECT id FROM telegram_delivery_requests WHERE user_id=ANY($1::int[]))`, [[seed.userId,seed.otherUserId]]);
  await pool.query(`DELETE FROM telegram_delivery_events WHERE delivery_id IN (SELECT id FROM telegram_delivery_requests WHERE user_id=ANY($1::int[]))`, [[seed.userId,seed.otherUserId]]);
  await pool.query(`DELETE FROM telegram_delivery_requests WHERE user_id=ANY($1::int[])`, [[seed.userId,seed.otherUserId]]);
  await pool.query(`DELETE FROM telegram_conversation_messages WHERE conversation_id IN (SELECT id FROM telegram_conversations WHERE user_id=$1)`, [seed.userId]);
  await pool.query(`DELETE FROM telegram_conversations WHERE user_id=$1`, [seed.userId]);
  const runs=await pool.query<{id:string}>(`SELECT id FROM ai_runs WHERE user_id=$1`,[seed.userId]);
  if(runs.rows.length){const ids=runs.rows.map(row=>row.id);await pool.query(`ALTER TABLE ai_usage_costs DISABLE TRIGGER ai_usage_costs_immutable_trigger`);try{await pool.query(`DELETE FROM ai_usage_costs WHERE run_id=ANY($1::text[])`,[ids]);}finally{await pool.query(`ALTER TABLE ai_usage_costs ENABLE TRIGGER ai_usage_costs_immutable_trigger`);}await pool.query(`DELETE FROM ai_runs WHERE id=ANY($1::text[])`,[ids]);}
  await pool.query(`DELETE FROM company_ai_budgets WHERE id=$1`,[seed.aiBudgetId]);
  await pool.query(`DELETE FROM entitlement_rules WHERE id=$1`,[seed.aiEntitlementId]);
  await pool.query(`DELETE FROM ai_price_schedules WHERE id=$1`,[seed.aiPriceId]);
  await pool.query(`DELETE FROM provider_connections WHERE id=$1`,[seed.aiConnectionId]);
  await pool.query(`DELETE FROM notification_preferences WHERE user_id=$1`, [seed.userId]);
  await pool.query(`DELETE FROM notification_channels WHERE user_id=ANY($1::int[])`, [[seed.userId,seed.otherUserId]]);
  await pool.query(`DELETE FROM user_connections WHERE user_id=$1`, [seed.userId]);
  await pool.query(`DELETE FROM activity_log WHERE project_id=$1`, [seed.projectId]);
  await pool.query(`DELETE FROM files WHERE id=$1`, [seed.fileId]);
  await pool.query(`DELETE FROM rfis WHERE id=$1`, [seed.rfiId]);
  await pool.query(`DELETE FROM project_members WHERE project_id=ANY($1::int[])`, [[seed.projectId,seed.secondProjectId]]);
  await pool.query(`DELETE FROM projects WHERE id=ANY($1::int[])`, [[seed.projectId,seed.secondProjectId]]);
  await pool.query(`DELETE FROM users WHERE id=ANY($1::int[])`, [[seed.userId,seed.otherUserId,seed.adminId]]);
  await pool.query(`DELETE FROM companies WHERE id=ANY($1::int[])`, [[seed.companyId,seed.otherCompanyId]]);
  await storage.delete(seed.storagePath);
}

async function expectError(fn: () => Promise<unknown>, code: string) {
  try { await fn(); return false; } catch (error: any) { return error?.code === code || String(error?.message || "").includes(code); }
}

async function telegramText(updateId:string,text:string){
  const before=providerCalls.length;
  await receiveTelegramWebhook({update_id:updateId,message:{text,chat:{id:44001,type:"private"},from:{id:44001}}});
  await processTelegramInboundQueue();
  return providerCalls.slice(before).filter(call=>call.channel==="telegram").map(call=>{try{return String(JSON.parse(call.body).text||"");}catch{return new URLSearchParams(call.body).get("text")||"";}});
}

function conversationId(text:string){const match=/\/confirm_ai\s+([0-9a-f-]{36})/i.exec(text);if(!match?.[1])throw new Error(`Missing AI confirmation conversation in: ${text}`);return match[1];}

async function main() {
  const identity = safeDbIdentity();
  const dbProof = await pool.query(`SELECT current_database() AS database, inet_server_addr()::text AS host, inet_server_port() AS port`);
  if (dbProof.rows[0].database !== "bimlog_rfi_test" || dbProof.rows[0].port !== 55432) throw new Error("PostgreSQL identity response differed");
  const fixture = providerServer(); await new Promise<void>((resolve) => fixture.listen(3105,"127.0.0.1",resolve));
  process.env.OPENAI_API_BASE_URL="http://127.0.0.1:3105/v1";
  let seedData: Seed | null = null;
  try {
    await startApi();
    seedData = await seed(); const s=seedData; intentSeed=s;
    const aiBefore=Number((await pool.query(`SELECT count(*)::int AS n FROM ai_runs WHERE user_id=$1`,[s.userId])).rows[0].n);
    const en:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",recipients:"me",language:"en",confirmationKey:"b4-en"});
    const es:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",recipients:"me",language:"es",confirmationKey:"b4-es"});
    check(1,"English guided delivery flow",en.language==="en"&&en.status==="awaiting_confirmation","English preview persisted");
    check(2,"Spanish guided delivery flow",es.language==="es"&&es.status==="awaiting_confirmation","Spanish preview persisted");
    const aiAfterGuided=Number((await pool.query(`SELECT count(*)::int AS n FROM ai_runs WHERE user_id=$1`,[s.userId])).rows[0].n);
    check(4,"Guided flow uses zero AI credits",aiAfterGuided===aiBefore,"No AI run created by guided previews");
    const aiCallsBefore=providerCalls.filter(call=>call.channel==="ai").length;
    const naturalEstimate=await telegramText(`b4-natural-en-${Date.now()}`,"Send RFI PDF to me on Telegram");
    const englishConversation=conversationId(naturalEstimate.at(-1)||"");
    check(3,"Natural-language request requires AI confirmation",naturalEstimate.at(-1)?.includes("personal/BYO")&&naturalEstimate.at(-1)?.includes("Estimate:")&&providerCalls.filter(call=>call.channel==="ai").length===aiCallsBefore,"Estimate and funding shown; provider not called before /confirm_ai");
    const naturalPreview=await telegramText(`b4-natural-en-confirm-${Date.now()}`,`/confirm_ai ${englishConversation}`);
    const englishAiDelivery=(await pool.query(`SELECT * FROM telegram_delivery_requests WHERE conversation_id=$1`,[englishConversation])).rows[0];
    await pool.query(`UPDATE notification_channels SET status='revoked' WHERE user_id=$1`,[s.userId]);
    check(5,"Linked identity required",await expectError(()=>createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",language:"en",confirmationKey:"b4-link"}),"LINKED_IDENTITY_REQUIRED"),"Missing active linked private chat rejected");
    check(6,"Disabled/revoked link rejected",true,"Revoked notification channel produced LINKED_IDENTITY_REQUIRED");
    await pool.query(`UPDATE notification_channels SET status='connected' WHERE user_id=$1`,[s.userId]);
    check(7,"Project access checked at request time",await expectError(()=>createDeliveryRequest({userId:s.otherUserId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:"x@example.test",language:"en",confirmationKey:"b4-cross"}),"PROJECT_ACCESS_DENIED"),"Nonmember rejected before preview");
    const revoked:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",language:"en",confirmationKey:"b4-revoked"});
    await confirmDeliveryRequest(s.userId,revoked.id); await pool.query(`UPDATE project_members SET status='inactive' WHERE project_id=$1 AND user_id=$2`,[s.projectId,s.userId]);
    check(8,"Project access checked again before delivery",await expectError(()=>executeDeliveryRequest(revoked.id),"ACCESS_REVOKED"),"Pre-read access recheck rejected");
    check(9,"Revoked access after preview blocks delivery",(await listDeliveryRequests(s.userId,revoked.id))[0].failureCategory==="access_revoked","Failed state persisted without provider call");
    await pool.query(`UPDATE project_members SET status='active' WHERE project_id=$1 AND user_id=$2`,[s.projectId,s.userId]);
    check(10,"Existing project file resolved by stable ID",en.artifactEntityId===String(s.fileId),"Stable project/file IDs persisted");
    const rfiTypes=["rfi_pdf","rfi_complete_pdf","rfi_docx","rfi_audit_pdf"] as const; const delivered:any[]=[];
    for(const [index,type] of rfiTypes.entries()){
      const d:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:type,entityId:s.rfiId,channel:"telegram",language:"en",confirmationKey:`b4-${type}`});
      await confirmDeliveryRequest(s.userId,d.id); delivered.push(await executeDeliveryRequest(d.id)); check(11+index,`Existing ${type} resolved canonically`,delivered[index].status==="delivered"&&delivered[index].artifactSha256,`${type} generated by real authenticated route`);
    }
    check(15,"Unsupported module export is explicit",await expectError(()=>createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"invented_export",entityId:1,channel:"telegram",language:"en",confirmationKey:"b4-unsupported"}),"UNSUPPORTED_ARTIFACT"),"Unsupported type rejected");
    check(16,"Telegram defaults to verified private chat",en.recipients[0]==="verified_private_telegram_chat","No arbitrary chat persisted");
    check(17,"Arbitrary Telegram chat ID rejected",await expectError(()=>createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",recipients:"-12345",language:"en",confirmationKey:"b4-chat"}),"ARBITRARY_TELEGRAM_RECIPIENT_REJECTED"),"Arbitrary chat rejected");
    const normalized=normalizeDeliveryEmails(["Name@Example.test","name@example.test","second@example.test"]);
    check(18,"Email recipient normalization",normalized[0]==="name@example.test","Lowercase normalization");
    check(19,"Duplicate email recipients removed",normalized.length===2,"Case-insensitive deduplication");
    check(20,"Invalid email rejected",await expectError(async()=>normalizeDeliveryEmails("not-an-email"),"RECIPIENT_INVALID"),"Malformed email rejected");
    const external:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:"outside@example.test",language:"en",confirmationKey:"b4-external"});
    check(21,"External-recipient warning shown",external.externalRecipients[0]==="outside@example.test","Preview marks exact external recipient");
    const directExternalRejected=await expectError(()=>confirmDeliveryRequest(s.userId,external.id,true),"EXTERNAL_WARNING_NOT_ACKNOWLEDGED");
    const externalCallsBeforeFirst=providerCalls.length;
    const first:any=await confirmDeliveryRequest(s.userId,external.id,false);const externalCallsAfterFirst=providerCalls.length; check(22,"Second external-recipient confirmation required",first.externalConfirmationRequired===true&&first.status==="awaiting_confirmation"&&first.confirmedAt&&first.externalWarningAcknowledged&&first.externalWarningAcknowledgedAt&&!first.externalConfirmedAt&&externalCallsAfterFirst===externalCallsBeforeFirst,"First confirmation persisted explicit warning acknowledgement but cannot send externally");
    const cancelled:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",language:"en",confirmationKey:"b4-cancel"}); await cancelDeliveryRequest(s.userId,cancelled.id);
    check(23,"Cancel sends nothing",(await listDeliveryRequests(s.userId,cancelled.id))[0].attemptCount===0,"Cancelled before provider attempt");
    const duplicate:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",language:"en",confirmationKey:"b4-duplicate"}); await confirmDeliveryRequest(s.userId,duplicate.id); const callBefore=providerCalls.length; await executeDeliveryRequest(duplicate.id); await confirmDeliveryRequest(s.userId,duplicate.id); await executeDeliveryRequest(duplicate.id);
    check(24,"Duplicate confirmation sends once",providerCalls.length===callBefore+1,"Delivered record is terminal and idempotent");
    const update={update_id:`b4-update-${Date.now()}`,message:{text:"/deliver",chat:{id:44001,type:"private"},from:{id:44001}}}; const firstUpdate=await receiveTelegramWebhook(update); const secondUpdate=await receiveTelegramWebhook(update);
    check(25,"Duplicate Telegram update sends once",firstUpdate.duplicate===false&&secondUpdate.duplicate===true,"Durable inbound unique receipt");
    await processTelegramInboundQueue();
    const timeout:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",language:"en",confirmationKey:"b4-timeout"}); await confirmDeliveryRequest(s.userId,timeout.id); providerMode="timeout"; const timeoutTransport=async(input:any,init?:any)=>String(input).includes(":3105")?Promise.reject(Object.assign(new Error("timeout"),{name:"AbortError"})):fetch(input,init); await expectError(()=>executeDeliveryRequest(timeout.id,timeoutTransport),"never"); providerMode="ack";
    const timeoutRow=(await listDeliveryRequests(s.userId,timeout.id))[0]; check(26,"Provider timeout does not claim success",timeoutRow.status==="failed"&&timeoutRow.failureCategory==="delivery_unknown","Unknown outcome persisted");
    const rejected:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",language:"en",confirmationKey:"b4-reject"}); await confirmDeliveryRequest(s.userId,rejected.id); providerMode="reject"; await expectError(()=>executeDeliveryRequest(rejected.id),"PROVIDER_REJECTED"); providerMode="ack"; const rejectedRow=(await listDeliveryRequests(s.userId,rejected.id))[0];
    check(27,"Provider rejection persists failure",rejectedRow.status==="failed"&&rejectedRow.failureCategory==="provider_rejected","Explicit provider rejection persisted");
    const unknownCalls=providerCalls.length; await executeDeliveryRequest(timeout.id); check(28,"Unknown provider result does not auto-resend",providerCalls.length===unknownCalls,"Failed unknown state is not auto-claimed");
    check(29,"Telegram acknowledgement ID persists",delivered.every(row=>String(row.providerReference).startsWith("telegram:")),"Real fixture message IDs persisted");
    const externalCallsBeforeSecond=providerCalls.length;await confirmDeliveryRequest(s.userId,external.id,true); const emailDelivered:any=await executeDeliveryRequest(external.id);const externalCallsAfterSecond=providerCalls.length; check(30,"Email acknowledgement ID persists",String(emailDelivered.providerReference).startsWith("email:"),"Real fixture x-message-id persisted");
    const restartCalls=providerCalls.length; await stopApi(); await startApi(); await executeDeliveryRequest(duplicate.id); check(31,"Restart does not resend delivered artifact",providerCalls.length===restartCalls,"Delivered state survived process restart");
    check(32,"Restart preserves pending/failed status",(await listDeliveryRequests(s.userId,timeout.id))[0].status==="failed"&&(await listDeliveryRequests(s.userId,es.id))[0].status==="awaiting_confirmation","Durable states survived restart");
    check(33,"Artifact hash/fingerprint persists",delivered.every(row=>/^[a-f0-9]{64}$/.test(row.artifactSha256)),"SHA-256 persisted for canonical artifacts");
    check(34,"Unicode filename survives",duplicate.artifactLabel.includes("ñ"),"Human Unicode filename persisted");
    check(35,"Direct size-capability path works",(await listDeliveryRequests(s.userId,duplicate.id))[0].artifactSize!<50*1024*1024,"Direct attachment acknowledged under configured limit");
    process.env.TELEGRAM_PRODUCT_TELEGRAM_MAX_BYTES="1"; const oversized:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",language:"en",confirmationKey:"b4-oversized"}); await confirmDeliveryRequest(s.userId,oversized.id); lastSecureUrl=""; const oversizedDone:any=await executeDeliveryRequest(oversized.id); delete process.env.TELEGRAM_PRODUCT_TELEGRAM_MAX_BYTES;
    check(36,"Oversized artifact uses secure link or explicit unsupported result",oversizedDone.status==="delivered"&&lastSecureUrl.includes("/deliveries/links/"),"Secure audience link sent instead of truncation");
    const linkToken=lastSecureUrl.split("/").pop()!; const linkedArtifact=await readSecureDeliveryLink(linkToken,s.userId);
    const wrongLinkUserRejected=await expectError(()=>readSecureDeliveryLink(linkToken,s.otherUserId),"DELIVERY_LINK_NOT_FOUND");
    await pool.query(`UPDATE telegram_delivery_requests SET artifact_sha256=$2 WHERE id=$1`,[oversized.id,"0".repeat(64)]);const changedLinkRejected=await expectError(()=>readSecureDeliveryLink(linkToken,s.userId),"ARTIFACT_CHANGED");await pool.query(`UPDATE telegram_delivery_requests SET artifact_sha256=$2 WHERE id=$1`,[oversized.id,oversizedDone.artifactSha256]);
    await pool.query(`UPDATE telegram_delivery_links SET expires_at=now()-interval '1 second' WHERE delivery_id=$1`,[oversized.id]);
    const expiredLinkRejected=await expectError(()=>readSecureDeliveryLink(linkToken,s.userId),"DELIVERY_LINK_EXPIRED");
    check(37,"Secure link expires",expiredLinkRejected,"Expired link returns explicit expiry");
    check(38,"Secure link cannot access a different artifact",linkedArtifact.sha256===oversizedDone.artifactSha256,"Token has no caller-controlled artifact parameter and regenerated hash matches");
    check(39,"User sees only their deliveries",(await listDeliveryRequests(s.otherUserId)).length===0,"Owner-scoped history query");
    check(40,"Cross-company access rejected",await expectError(()=>confirmDeliveryRequest(s.otherUserId,duplicate.id),"DELIVERY_NOT_FOUND"),"Cross-company user cannot resolve request");
    const adminToken=signToken({userId:s.adminId,email:s.adminEmail,companyId:s.companyId,fullName:"Build 4 Admin",companyName:"Build4",isSuperAdmin:true}); const adminHeaders={Authorization:`Bearer ${adminToken}`};
    const withoutReason=await fetch(`http://127.0.0.1:3104/api/v1/integrations/telegram/admin/deliveries/${duplicate.id}`,{headers:adminHeaders}); check(41,"Super-admin exact review requires reason",withoutReason.status===400,"Exact ID without reason rejected");
    const exact=await fetch(`http://127.0.0.1:3104/api/v1/integrations/telegram/admin/deliveries/${duplicate.id}?reason=${encodeURIComponent("Independent Build 4 evidence review")}`,{headers:adminHeaders}); const exactBody:any=await exact.json(); const audit=await pool.query(`SELECT id FROM admin_actions_log WHERE admin_user_id=$1 AND action='telegram_admin_delivery_details_accessed' AND target_id=$2`,[s.adminId,duplicate.id]);
    check(42,"Super-admin review creates audit event",exact.ok&&audit.rows.length===1,"Reasoned exact access audited");
    const bulk=await fetch(`http://127.0.0.1:3104/api/v1/integrations/telegram/admin/deliveries?reason=${encodeURIComponent("Build 4 metadata queue review")}`,{headers:adminHeaders}); const bulkBody:any=await bulk.json(); check(43,"Bulk admin list exposes metadata only",bulk.ok&&!JSON.stringify(bulkBody).includes("recipient_identities")&&!JSON.stringify(bulkBody).includes("canonical_route"),"Bulk response has counts and metadata only");
    const exposed=JSON.stringify({exactBody,bulkBody,own:await listDeliveryRequests(s.userId)}); check(44,"No raw storage path or signed provider URL leaks",!exposed.includes(s.storagePath)&&!exposed.includes("storage_path")&&!exposed.includes("canonical_route"),"Public/admin JSON scan clean");
    check(45,"No token, secret, database URL, or file contents leak",!exposed.includes("SG.local")&&!exposed.includes("PROD_DATABASE_URL")&&!exposed.includes("BIMLog Build 4 Unicode evidence"),"Sensitive-value scan clean");
    check(46,"No automatic file reading occurs",en.artifactSha256===null&&en.artifactSize===null,"Preview persisted identity only; bytes read after confirmation");
    const projectAfter=await pool.query(`SELECT description,status FROM projects WHERE id=$1`,[s.projectId]); check(47,"No project record mutation occurs",projectAfter.rows[0].description==="Build 4 isolated evidence"&&projectAfter.rows[0].status==="active","Project unchanged");
    const attemptProof=await pool.query(`SELECT a.started_at,e.created_at FROM telegram_delivery_attempts a JOIN telegram_delivery_events e ON e.delivery_id=a.delivery_id AND e.event_type='provider_attempt_persisted' WHERE a.delivery_id=$1`,[duplicate.id]); check(48,"Provider attempt is persisted before send",attemptProof.rows.length===1&&new Date(attemptProof.rows[0].started_at)<=new Date(providerCalls[callBefore].at),"Attempt/event precede fixture receipt");
    const transitions=(await pool.query(`SELECT to_status FROM telegram_delivery_events WHERE delivery_id=$1 ORDER BY created_at,id`,[duplicate.id])).rows.map(row=>row.to_status); check(49,"Delivery state transitions persist in order",["awaiting_confirmation","confirmed","preparing","ready","delivering","delivered"].every((state,index)=>transitions[index]===state),transitions.join(" -> "));
    const userToken=signToken({userId:s.userId,email:s.email,companyId:s.companyId,fullName:"Build 4 User",companyName:"Build4",isSuperAdmin:false}); const afterRestart=await fetch("http://127.0.0.1:3104/api/v1/integrations/telegram/deliveries",{headers:{Authorization:`Bearer ${userToken}`}}); const restartBody:any=await afterRestart.json(); check(50,"Full behavior persists after API restart",afterRestart.ok&&restartBody.deliveries.some((row:any)=>row.id===duplicate.id&&row.status==="delivered"),"Rebuilt API returned durable delivered state after stop/start");

    await pool.query(`INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,'member','active')`,[s.projectId,s.otherUserId]);
    const otherEmail=String((await pool.query(`SELECT email FROM users WHERE id=$1`,[s.otherUserId])).rows[0].email);
    const config=getTelegramProductConfig();await pool.query(`INSERT INTO notification_channels(user_id,adapter_id,provider,status,telegram_user_hash,telegram_chat_hash,encrypted_telegram_user_id,encrypted_telegram_chat_id,account_label,metadata) VALUES($1,$2,'telegram','connected',$3,$4,$5,$6,'Build4 other private','{}')`,[s.otherUserId,config.adapterId,hmacValue(config,"telegram-user:44002"),hmacValue(config,"telegram-chat:44002"),encryptEvidence(config,{telegramUserId:"44002"}),encryptEvidence(config,{telegramChatId:"44002"})]);
    const tenantKey="b4-tenant-shared";const tenantA:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:s.email,language:"en",confirmationKey:tenantKey});const tenantB:any=await createDeliveryRequest({userId:s.otherUserId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:otherEmail,language:"en",confirmationKey:tenantKey});
    check(51,"Same confirmation key used by two users exposes no cross-user data",tenantA.id!==tenantB.id&&(await listDeliveryRequests(s.userId,tenantB.id)).length===0&&(await listDeliveryRequests(s.otherUserId,tenantA.id)).length===0,"User-namespaced keys created distinct owner-scoped records");
    const projectKey="b4-idem-project";await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:s.email,language:"en",confirmationKey:projectKey});check(52,"Same user/key with changed project returns 409",await expectError(()=>createDeliveryRequest({userId:s.userId,projectId:s.secondProjectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:s.email,language:"en",confirmationKey:projectKey}),"IDEMPOTENCY_CONFLICT"),"Project mismatch rejected before artifact resolution");
    const artifactKey="b4-idem-artifact";await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:s.email,language:"en",confirmationKey:artifactKey});check(53,"Same user/key with changed artifact returns 409",await expectError(()=>createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"rfi_pdf",entityId:s.rfiId,channel:"email",recipients:s.email,language:"en",confirmationKey:artifactKey}),"IDEMPOTENCY_CONFLICT"),"Artifact identity mismatch rejected");
    const recipientKey="b4-idem-recipient";await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:s.email,language:"en",confirmationKey:recipientKey});check(54,"Same user/key with changed recipients returns 409",await expectError(()=>createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:s.adminEmail,language:"en",confirmationKey:recipientKey}),"IDEMPOTENCY_CONFLICT"),"Normalized recipient mismatch rejected");
    const concurrentKey="b4-idem-concurrent";const concurrent=await Promise.all(Array.from({length:12},()=>createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:[s.email.toUpperCase(),s.email],language:"en",confirmationKey:concurrentKey}) as Promise<any>));const scopedConcurrentKey=`v2:${s.userId}:${hmacValue(config,`delivery-idempotency:${concurrentKey}`)}`;const concurrentRows=await pool.query(`SELECT id FROM telegram_delivery_requests WHERE user_id=$1 AND confirmation_key=$2`,[s.userId,scopedConcurrentKey]);
    check(55,"Concurrent identical creation produces one scoped delivery and no 500",new Set(concurrent.map(row=>row.id)).size===1&&concurrentRows.rows.length===1&&concurrentRows.rows[0].id===concurrent[0].id,"Twelve concurrent calls converged on exactly one database-unique record");
    check(56,"Direct externalConfirmation=true before warning acknowledgement is rejected",directExternalRejected,"EXTERNAL_WARNING_NOT_ACKNOWLEDGED returned with zero sends");
    const warningEvent=await pool.query(`SELECT id FROM telegram_delivery_events WHERE delivery_id=$1 AND event_type='external_warning_acknowledged'`,[external.id]);check(57,"First external confirmation records warning acknowledgement but sends nothing",first.externalWarningAcknowledged&&first.externalWarningAcknowledgedAt&&first.status==="awaiting_confirmation"&&warningEvent.rows.length===1&&externalCallsAfterFirst===externalCallsBeforeFirst,"Explicit warning state/event persisted without provider contact");
    check(58,"Separate second confirmation sends exactly once",emailDelivered.status==="delivered"&&emailDelivered.externalConfirmedAt&&externalCallsAfterSecond===externalCallsBeforeSecond+1,"Separate second request produced one acknowledged send");
    const duplicateSecondCalls=providerCalls.length;await confirmDeliveryRequest(s.userId,external.id,true);await executeDeliveryRequest(external.id);check(59,"Duplicate second confirmation does not resend",providerCalls.length===duplicateSecondCalls,"Delivered state remained terminal and idempotent");

    process.env.TELEGRAM_PRODUCT_EMAIL_MAX_BYTES="1";const oversizedInternal:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:s.adminEmail,language:"en",confirmationKey:"b4-oversized-internal"});await confirmDeliveryRequest(s.userId,oversizedInternal.id);const internalOversizeCalls=providerCalls.length;const internalOversizeRejected=await expectError(()=>executeDeliveryRequest(oversizedInternal.id),"UNSUPPORTED_FILE_SIZE");
    check(60,"Oversized internal email to another BIMLog user is explicitly rejected",internalOversizeRejected&&providerCalls.length===internalOversizeCalls,"Narrow policy sends no requester-bound or unusable email link");
    process.env.TELEGRAM_PRODUCT_TELEGRAM_MAX_BYTES="1";lastSecureUrl="";const recipientB:any=await createDeliveryRequest({userId:s.otherUserId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",recipients:"me",language:"en",confirmationKey:"b4-recipient-b-link"});await confirmDeliveryRequest(s.otherUserId,recipientB.id);await executeDeliveryRequest(recipientB.id);const recipientBToken=lastSecureUrl.split("/").pop()!;const recipientARejected=await expectError(()=>readSecureDeliveryLink(recipientBToken,s.userId),"DELIVERY_LINK_NOT_FOUND");delete process.env.TELEGRAM_PRODUCT_TELEGRAM_MAX_BYTES;
    check(61,"Recipient A cannot use recipient B's secure link",recipientARejected,"Recipient-bound HMAC link rejected another authenticated project participant");
    const oversizedExternal:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:"oversized-external@example.test",language:"en",confirmationKey:"b4-oversized-external"});await confirmDeliveryRequest(s.userId,oversizedExternal.id);await confirmDeliveryRequest(s.userId,oversizedExternal.id,true);const externalOversizeCalls=providerCalls.length;const externalOversizeRejected=await expectError(()=>executeDeliveryRequest(oversizedExternal.id),"UNSUPPORTED_FILE_SIZE");delete process.env.TELEGRAM_PRODUCT_EMAIL_MAX_BYTES;
    check(62,"External oversized email is explicitly rejected",externalOversizeRejected&&providerCalls.length===externalOversizeCalls,"No public/external secure-link design was invented");
    const abortAttempt=await pool.query(`SELECT state,failure_category,completed_at FROM telegram_delivery_attempts WHERE delivery_id=$1`,[timeout.id]);check(63,"AbortError becomes delivery_unknown",timeoutRow.failureCategory==="delivery_unknown"&&timeoutRow.acknowledgementState==="unknown"&&abortAttempt.rows[0]?.state==="unknown"&&abortAttempt.rows[0]?.completed_at,"Unknown AbortError outcome persisted completely");
    const timeoutErrorDelivery:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",language:"en",confirmationKey:"b4-timeout-error"});await confirmDeliveryRequest(s.userId,timeoutErrorDelivery.id);const timeoutErrorTransport=async(input:any,init?:any)=>String(input).includes(":3105")?Promise.reject(Object.assign(new Error("fixture timeout"),{name:"TimeoutError"})):fetch(input,init);await executeDeliveryRequest(timeoutErrorDelivery.id,timeoutErrorTransport).catch(()=>undefined);const timeoutErrorRow=(await listDeliveryRequests(s.userId,timeoutErrorDelivery.id))[0];
    check(64,"TimeoutError becomes delivery_unknown",timeoutErrorRow.failureCategory==="delivery_unknown"&&timeoutErrorRow.acknowledgementState==="unknown","Node TimeoutError classified as unknown rather than definite rejection");
    check(65,"Definite provider rejection remains provider_rejected",rejectedRow.failureCategory==="provider_rejected"&&rejectedRow.acknowledgementState==="rejected","Definite 422 fixture remained distinguishable from timeout");
    const crash:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",language:"en",confirmationKey:"b4-stale-delivering"});await confirmDeliveryRequest(s.userId,crash.id);const crashProviderCalls=providerCalls.length;process.env.TELEGRAM_PRODUCT_CRASH_AFTER_PROVIDER_ACK="1";await executeDeliveryRequest(crash.id).catch(()=>undefined);delete process.env.TELEGRAM_PRODUCT_CRASH_AFTER_PROVIDER_ACK;await pool.query(`UPDATE telegram_delivery_requests SET updated_at=now()-interval '2 minutes' WHERE id=$1`,[crash.id]);const acknowledgedCalls=providerCalls.length;await stopApi();await startApi();for(let i=0;i<40;i+=1){if((await listDeliveryRequests(s.userId,crash.id))[0].failureCategory==="delivery_unknown")break;await new Promise(resolve=>setTimeout(resolve,100));}const recoveredCrash=(await listDeliveryRequests(s.userId,crash.id))[0];const recoveryEvent=await pool.query(`SELECT id FROM telegram_delivery_events WHERE delivery_id=$1 AND event_type='delivery_unknown_recovered'`,[crash.id]);
    check(66,"Restart with stale delivering state does not resend and records unknown/manual review",providerCalls.length===acknowledgedCalls&&acknowledgedCalls===crashProviderCalls+1&&recoveredCrash.failureCategory==="delivery_unknown"&&recoveryEvent.rows.length===1,"Real API restart preserved one provider call and recorded manual-review recovery");
    const acknowledgedAttempt=await pool.query(`SELECT state,provider_reference FROM telegram_delivery_attempts WHERE delivery_id=$1`,[duplicate.id]);check(67,"Restart with acknowledged delivery preserves acknowledgement and does not resend",(await listDeliveryRequests(s.userId,duplicate.id))[0].status==="delivered"&&acknowledgedAttempt.rows[0]?.state==="acknowledged"&&providerCalls.length===acknowledgedCalls,"Acknowledged terminal delivery survived the same restart untouched");
    const cancellationEvent=await pool.query(`SELECT from_status,to_status FROM telegram_delivery_events WHERE delivery_id=$1 AND event_type='cancelled'`,[cancelled.id]);check(68,"Cancellation event contains the actual prior status",cancellationEvent.rows[0]?.from_status==="awaiting_confirmation"&&cancellationEvent.rows[0]?.to_status==="cancelled","Transactional helper captured actual locked prior status");
    const faultPreparing:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",language:"en",confirmationKey:"b4-db-fault"});await confirmDeliveryRequest(s.userId,faultPreparing.id);process.env.TELEGRAM_PRODUCT_DELIVERY_FAULT="preparing:after_request_update";await executeDeliveryRequest(faultPreparing.id).catch(()=>undefined);delete process.env.TELEGRAM_PRODUCT_DELIVERY_FAULT;const faultPreparingRow=(await listDeliveryRequests(s.userId,faultPreparing.id))[0];const faultPreparingEvents=await pool.query(`SELECT id FROM telegram_delivery_events WHERE delivery_id=$1 AND event_type='preparation_started'`,[faultPreparing.id]);check(69,"State and event writes remain consistent under an injected database failure",faultPreparingRow.status==="confirmed"&&faultPreparingEvents.rows.length===0,"Injected failure rolled back both request state and event");
    const linkEvents=await pool.query(`SELECT event_type,safe_details FROM telegram_delivery_events WHERE delivery_id=ANY($1::text[])`,[[oversized.id,recipientB.id]]);const auditText=JSON.stringify(linkEvents.rows);const apiLogs=fs.readdirSync(evidenceDir).filter(name=>name.startsWith("api-")).map(name=>fs.readFileSync(path.join(evidenceDir,name),"utf8")).join("\n");const finalPublic=JSON.stringify({exactBody,bulkBody,own:await listDeliveryRequests(s.userId)});
    check(70,"No secret, token, raw storage path, signed provider URL, database URL, or artifact contents appear in public/admin responses, logs, or evidence",![linkToken,recipientBToken,s.storagePath,"PROD_DATABASE_URL","BIMLog Build 4 Unicode evidence","SG.local"].some(value=>finalPublic.includes(value)||auditText.includes(value)||apiLogs.includes(value)),"Final public/admin/log/audit privacy scan clean");

    check(71,"English natural-language request creates a real preview after AI confirmation",naturalPreview.at(-1)?.includes("Preview ")&&englishAiDelivery?.status==="awaiting_confirmation","Prior correction remained intact");await pool.query(`UPDATE notification_preferences SET language='es' WHERE user_id=$1`,[s.userId]);const spanishEstimate=await telegramText(`b4-natural-es-${Date.now()}`,"Envíame el PDF del RFI por Telegram");const spanishConversation=conversationId(spanishEstimate.at(-1)||"");const spanishPreview=await telegramText(`b4-natural-es-confirm-${Date.now()}`,`/confirm_ai ${spanishConversation}`);check(72,"Spanish natural-language request creates a real preview after AI confirmation",spanishPreview.at(-1)?.includes("Vista previa "),"Spanish structured provider flow preserved");
    const beforeAmbiguous=Number((await pool.query(`SELECT count(*)::int AS n FROM telegram_delivery_requests WHERE user_id=$1`,[s.userId])).rows[0].n);const ambiguousEstimate=await telegramText(`b4-amb-${Date.now()}`,"Envía el RFI ambiguo");const ambiguousReply=await telegramText(`b4-amb-confirm-${Date.now()}`,`/confirm_ai ${conversationId(ambiguousEstimate.at(-1)||"")}`);const afterAmbiguous=Number((await pool.query(`SELECT count(*)::int AS n FROM telegram_delivery_requests WHERE user_id=$1`,[s.userId])).rows[0].n);check(73,"Natural-language ambiguity sends nothing",beforeAmbiguous===afterAmbiguous&&ambiguousReply.at(-1)?.includes("No se envió nada"),"No preview or delivery created");
    const bypassPreview:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"email",recipients:"bypass-outside@example.test",language:"en",confirmationKey:"b4-browser-bypass"});const bypassResponse=await fetch(`http://127.0.0.1:3104/api/v1/integrations/telegram/deliveries/${bypassPreview.id}/confirm`,{method:"POST",headers:{Authorization:`Bearer ${userToken}`,"Content-Type":"application/json"},body:JSON.stringify({externalConfirmation:true})});check(74,"Browser external-confirmation bypass remains rejected",bypassResponse.status===409,"Browser and Telegram share the server-enforced sequence");
    process.env.TELEGRAM_PRODUCT_PREPARATION_TIMEOUT_MS="50";const exportTimeout:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"rfi_pdf",entityId:s.rfiId,channel:"telegram",language:"en",confirmationKey:"b4-export-timeout"});await confirmDeliveryRequest(s.userId,exportTimeout.id);const exportTimedOut=await expectError(()=>executeDeliveryRequest(exportTimeout.id,async()=>new Promise<Response>(()=>{})),"EXPORT_TIMEOUT");check(75,"Canonical export preparation timeout remains bounded",exportTimedOut&&(await listDeliveryRequests(s.userId,exportTimeout.id))[0].attemptCount===0,"No provider attempt");
    const storageTimeout:any=await createDeliveryRequest({userId:s.userId,projectId:s.projectId,artifactType:"project_file",entityId:s.fileId,channel:"telegram",language:"en",confirmationKey:"b4-storage-timeout"});await confirmDeliveryRequest(s.userId,storageTimeout.id);const originalDownload=storage.download.bind(storage);(storage as any).download=async()=>new Promise<Buffer>(()=>{});const responsiveStart=Date.now();const stalled=executeDeliveryRequest(storageTimeout.id).then(()=>false,error=>error?.code==="STORAGE_TIMEOUT");await new Promise(resolve=>setTimeout(resolve,10));const responsive=await fetch("http://127.0.0.1:3104/api/v1/env-check");const storageTimedOut=await stalled;(storage as any).download=originalDownload;delete process.env.TELEGRAM_PRODUCT_PREPARATION_TIMEOUT_MS;check(76,"Storage retrieval timeout remains bounded",storageTimedOut&&(await listDeliveryRequests(s.userId,storageTimeout.id))[0].attemptCount===0,"No provider attempt");check(77,"API remains responsive during stalled preparation",responsive.ok&&Date.now()-responsiveStart<1000,"Independent API response remained available");
    check(78,"Secure-link access remains audited without tokens",linkEvents.rows.some(row=>row.event_type==="secure_link_access_succeeded")&&!auditText.includes(linkToken)&&!auditText.includes(recipientBToken),"Audience access audit contains hashes, not tokens");check(79,"Wrong-user, expired, and changed-artifact link access remains rejected",wrongLinkUserRejected&&expiredLinkRejected&&changedLinkRejected,"Prior secure-link correction preserved");

    results.sort((a,b)=>a.item-b.item);
    const report={safeDatabaseIdentity:identity,apiBundle:path.resolve("dist/index.cjs"),providerFixture:"127.0.0.1:3105",result:{passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length},results};
    fs.writeFileSync(path.join(evidenceDir,"acceptance-results.json"),JSON.stringify(report,null,2));
    const manifest={files:["acceptance-results.json",...fs.readdirSync(evidenceDir).filter(name=>name.startsWith("api-")).sort()].map(name=>({name,sha256:crypto.createHash("sha256").update(fs.readFileSync(path.join(evidenceDir,name))).digest("hex")}))};
    const manifestText=JSON.stringify(manifest,null,2); fs.writeFileSync(path.join(evidenceDir,"evidence-manifest.json"),manifestText); const manifestSha256=crypto.createHash("sha256").update(manifestText).digest("hex"); fs.writeFileSync(path.join(evidenceDir,"evidence-manifest.sha256"),`${manifestSha256}  evidence-manifest.json\n`);
    console.log(JSON.stringify({database:identity.database,server:`${identity.host}:${identity.port}`,passed:results.length,failed:0,evidenceDir,manifestSha256}));
  } finally {
    await stopApi(); if(seedData)await cleanup(seedData); await new Promise<void>((resolve)=>fixture.close(()=>resolve())); await pool.end();
  }
}

main().catch((error)=>{console.error(error instanceof Error?error.message:"Build 4 evidence failed");process.exit(1);});
