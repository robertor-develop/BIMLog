import http from "node:http";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { openSync, closeSync, fstatSync, readSync } from "node:fs";

const THREAD_ID = "01a10a95-a2e5-73d3-a471-6738addc7e42";
const PORT = 8789;
const HOST = "127.0.0.1";
const ALLOWED_ORIGINS = new Set(["https://bimlog.app", "https://www.bimlog.app"]);
const executable = process.env.BIMLOG_CODEX_EXECUTABLE || "codex.exe";
const rollout = process.env.BIMLOG_MAIN04_ROLLOUT_PATH;
if (!rollout) throw new Error("BIMLOG_MAIN04_ROLLOUT_PATH is required");

let fifo = Promise.resolve();
function enqueue(work) { const result = fifo.then(work, work); fifo = result.then(() => undefined, () => undefined); return result; }
function cors(origin) { return ALLOWED_ORIGINS.has(origin) ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type, x-bimlog-bridge", "access-control-allow-private-network": "true", "access-control-max-age": "600", vary: "Origin" } : {}; }
function json(response, status, value, origin) { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...cors(origin) }); response.end(JSON.stringify(value)); }
function readAfter(offset) { const fd = openSync(rollout, "r"); try { const size = fstatSync(fd).size; if (size <= offset) return { bytes: "", offset }; const buffer = Buffer.alloc(size - offset); readSync(fd, buffer, 0, buffer.length, offset); return { bytes: buffer.toString("utf8"), offset: size }; } finally { closeSync(fd); } }
function queueQuestion(question) { return new Promise((resolve, reject) => { const child = spawn(executable, ["queue", "--thread", THREAD_ID, "--message", question], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let out = "", err = ""; const timer = setTimeout(() => { child.kill(); reject(new Error("QUEUE_TIMEOUT")); }, 30000); child.stdout.on("data", value => out += String(value)); child.stderr.on("data", value => err += String(value)); child.on("error", () => { clearTimeout(timer); reject(new Error("QUEUE_UNAVAILABLE")); }); child.on("exit", code => { clearTimeout(timer); code === 0 && /Queued message/.test(out) ? resolve() : reject(new Error(/active writer/i.test(err) ? "ACTIVE_WRITER" : "QUEUE_REFUSED")); }); }); }
async function answer(prompt) { const fd = openSync(rollout, "r"); const offsetStart = fstatSync(fd).size; closeSync(fd); let offset = offsetStart; await queueQuestion(prompt); const deadline = Date.now() + 180000; let remainder = "", turnId = ""; while (Date.now() < deadline) { const next = readAfter(offset); offset = next.offset; const rows = (remainder + next.bytes).split(/\r?\n/); remainder = rows.pop() || ""; for (const row of rows) { let event; try { event = JSON.parse(row); } catch { continue; } const payload = event?.payload; if (!payload) continue; if (!turnId && payload.type === "item_completed" && payload.item?.type === "UserMessage" && payload.item.content?.some(item => item?.type === "text" && item.text === prompt)) turnId = payload.turn_id || ""; if (!turnId && event.type === "event_msg" && payload.item?.type === "UserMessage" && payload.item.content?.some(item => item?.type === "text" && item.text === prompt)) turnId = payload.turn_id || ""; if (turnId && payload.turn_id === turnId && payload.type === "task_complete" && typeof payload.last_agent_message === "string" && payload.last_agent_message.trim()) return payload.last_agent_message.trim(); if (turnId && event.type === "event_msg" && payload.turn_id === turnId && payload.item?.type === "AgentMessage" && payload.item.phase === "final_answer") { const text = payload.item.content?.filter(item => item?.type === "Text").map(item => item.text).join("\n").trim(); if (text) return text; } } await new Promise(resolve => setTimeout(resolve, 250)); } throw new Error("ANSWER_TIMEOUT"); }

http.createServer(async (request, response) => {
  const origin = String(request.headers.origin || "");
  if (request.method === "OPTIONS") { if (!ALLOWED_ORIGINS.has(origin)) return json(response, 403, { error: "ORIGIN_REFUSED" }, origin); response.writeHead(204, cors(origin)); return response.end(); }
  if (request.method !== "POST" || request.url !== "/v1/questions" || !ALLOWED_ORIGINS.has(origin) || request.headers["x-bimlog-bridge"] !== "main04") return json(response, 403, { error: "REQUEST_REFUSED" }, origin);
  let raw = ""; for await (const chunk of request) { raw += chunk; if (raw.length > 64000) return json(response, 413, { error: "REQUEST_TOO_LARGE" }, origin); }
  let body; try { body = JSON.parse(raw); } catch { return json(response, 400, { error: "INVALID_JSON" }, origin); }
  const question = typeof body.question === "string" ? body.question.trim() : ""; const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!question || question.length > 4000 || !requestId || body.destinationThreadId !== THREAD_ID) return json(response, 400, { error: "REQUEST_INVALID" }, origin);
  const context = JSON.stringify(body.context ?? {}).slice(0, 12000); const prompt = `Answer the exact current BIMLog user question as BIMLog Dedicated Agent MAIN 04.00. Use only the current page context below. Return only the direct answer.\n\nCURRENT PAGE CONTEXT:\n${context}\n\nUSER QUESTION (EXACT):\n${question}`;
  try { const result = await enqueue(() => answer(prompt)); return json(response, 200, { requestId, threadId: THREAD_ID, answer: result, answerDigest: createHash("sha256").update(result).digest("hex"), transport: "main04-local-fifo", contextual: true, highlightLabels: [], proposal: null }, origin); }
  catch (error) { return json(response, 503, { error: error instanceof Error ? error.message : "BRIDGE_FAILED" }, origin); }
}).listen(PORT, HOST, () => process.stdout.write(`BIMLog MAIN 04 bridge listening on http://${HOST}:${PORT}\n`));
