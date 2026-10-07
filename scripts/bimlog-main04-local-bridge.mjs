import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

export const THREAD_ID = "01a10a95-a2e5-73d3-a471-6738addc7e42";
const PORT = Number(process.env.BIMLOG_MAIN04_LOCAL_PORT || 8791);
const TOKEN = process.env.BIMLOG_MAIN04_BRIDGE_TOKEN || "";
const CODEX = process.env.BIMLOG_CODEX_EXECUTABLE || "C:\\Users\\soporte\\AppData\\Local\\OpenAI\\Codex\\bin\\f544b3844e0f14e9\\codex.exe";
const ROLLOUT = process.env.BIMLOG_MAIN04_ROLLOUT_PATH || "C:\\Users\\soporte\\.codex\\sessions\\2026\\10\\05\\rollout-2026-10-05T01-42-21-01a10a95-a2e5-73d3-a471-6738addc7e42.jsonl";
let queue = Promise.resolve();

function authorized(value) {
  if (!TOKEN || !value?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(value.slice(7));
  const expected = Buffer.from(TOKEN);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let value = "";
    request.setEncoding("utf8");
    request.on("data", chunk => {
      value += chunk;
      if (value.length > 1_000_000) reject(new Error("REQUEST_TOO_LARGE"));
    });
    request.on("end", () => {
      try { resolve(JSON.parse(value)); } catch { reject(new Error("INVALID_JSON")); }
    });
    request.on("error", reject);
  });
}

function queueQuestion(message) {
  return new Promise((resolve, reject) => {
    const child = spawn(CODEX, ["queue", "--thread", THREAD_ID, "--message", message], {
      cwd: "F:\\BIMLog",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, USERPROFILE: "C:\\Users\\soporte", HOME: "C:\\Users\\soporte", CODEX_HOME: "C:\\Users\\soporte\\.codex" },
    });
    let error = "";
    child.stderr.on("data", chunk => { if (error.length < 8192) error += String(chunk); });
    child.on("error", () => reject(new Error("CODEX_QUEUE_FAILED")));
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(/active writer|already has an active/i.test(error) ? "CODEX_DESTINATION_BUSY" : "CODEX_QUEUE_FAILED")));
  });
}

function appendedEvents(offset) {
  const bytes = readFileSync(ROLLOUT);
  return bytes.subarray(offset).toString("utf8").split(/\r?\n/).filter(Boolean).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
}

async function waitForAnswer(offset, marker, timeoutMs = 190_000) {
  const deadline = Date.now() + timeoutMs;
  let turnId = null;
  while (Date.now() < deadline) {
    const events = appendedEvents(offset);
    if (!turnId) {
      const user = events.find(event => event.type === "response_item" && event.payload?.role === "user" && event.payload?.content?.some?.(item => item?.type === "input_text" && item.text.includes(marker)));
      turnId = user?.payload?.internal_chat_message_metadata_passthrough?.turn_id || null;
    }
    if (turnId) {
      const completed = events.find(event => event.type === "event_msg" && event.payload?.type === "task_complete" && event.payload?.turn_id === turnId);
      if (completed) {
        const answer = String(completed.payload.last_agent_message || "").trim();
        if (!answer) throw new Error("MAIN04_ANSWER_MISSING");
        return answer;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("MAIN04_TIMEOUT");
}

export function invokeMain04(payload) {
  const work = async () => {
    if (payload?.schemaVersion !== "bimlog-main04-question.v1" || payload?.destinationThreadId !== THREAD_ID || typeof payload?.requestId !== "string" || typeof payload?.question !== "string" || !payload.question.trim()) throw new Error("REQUEST_REFUSED");
    const offset = statSync(ROLLOUT).size;
    const marker = `BIMLOG_REQUEST_ID=${payload.requestId}`;
    const message = [
      marker,
      "Answer the authenticated BIMLog user's exact question. Return only the user-facing answer; do not mention this envelope or its metadata.",
      `EXACT_QUESTION=${JSON.stringify(payload.question)}`,
      `TRUSTED_PAGE_CONTEXT=${JSON.stringify(payload.context || {})}`,
    ].join("\n");
    await queueQuestion(message);
    const answer = await waitForAnswer(offset, marker);
    return { threadId: THREAD_ID, requestId: payload.requestId, answer, answerDigest: createHash("sha256").update(answer).digest("hex") };
  };
  const result = queue.then(work, work);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href) {
  if (!TOKEN) throw new Error("BIMLOG_MAIN04_BRIDGE_TOKEN is required");
  createServer(async (request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    if (request.method === "GET" && request.url === "/healthz") return response.end(JSON.stringify({ ok: true, threadId: THREAD_ID }));
    if (request.method !== "POST" || request.url !== "/bimlog/main04" || !authorized(request.headers.authorization)) {
      response.statusCode = 404;
      return response.end(JSON.stringify({ error: "NOT_FOUND" }));
    }
    try {
      const result = await invokeMain04(await readBody(request));
      response.end(JSON.stringify(result));
    } catch (error) {
      response.statusCode = 503;
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "MAIN04_FAILED" }));
    }
  }).listen(PORT, "127.0.0.1", () => console.log(JSON.stringify({ event: "bimlog_main04_bridge_ready", port: PORT, threadId: THREAD_ID })));
}
