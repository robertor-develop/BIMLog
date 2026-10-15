import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createHash, timingSafeEqual } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const THREAD_ID = "01a10a95-a2e5-73d3-a471-6738addc7e42";
export const THREAD_MODEL = "gpt-5.6-sol";
const PORT = Number(process.env.BIMLOG_MAIN04_LOCAL_PORT || 8791);
const TOKEN = process.env.BIMLOG_MAIN04_BRIDGE_TOKEN || "";
const CODEX = process.env.BIMLOG_CODEX_EXECUTABLE || "C:\\Users\\soporte\\AppData\\Local\\OpenAI\\Codex\\bin\\f544b3844e0f14e9\\codex.exe";
const ROLLOUT = process.env.BIMLOG_MAIN04_ROLLOUT_PATH || "C:\\Users\\soporte\\.codex\\sessions\\2026\\10\\05\\rollout-2026-10-05T01-42-21-01a10a95-a2e5-73d3-a471-6738addc7e42.jsonl";
let queue = Promise.resolve();
const jobs = new Map();

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

function resumeQuestion(message) {
  const folder = mkdtempSync(join(tmpdir(), "bimlog-main04-"));
  const output = join(folder, "answer.txt");
  return new Promise((resolve, reject) => {
    const child = spawn(CODEX, ["exec", "--skip-git-repo-check", "resume", "--all", "-m", THREAD_MODEL, "-c", 'model_reasoning_effort="low"', "-c", 'sandbox_mode="read-only"', "--output-last-message", output, THREAD_ID, "-"], {
      cwd: "F:\\BIMLog",
      windowsHide: true,
      stdio: ["pipe", "ignore", "pipe"],
      env: { ...process.env, USERPROFILE: "C:\\Users\\soporte", HOME: "C:\\Users\\soporte", CODEX_HOME: "C:\\Users\\soporte\\.codex" },
    });
    let error = "";
    child.stderr.on("data", chunk => { if (error.length < 8192) error += String(chunk); });
    child.on("error", () => reject(new Error("CODEX_RESUME_FAILED")));
    child.on("exit", code => {
      try {
        if (code !== 0) {
          if (/active writer|already has an active/i.test(error)) return reject(new Error("CODEX_DESTINATION_BUSY"));
          if (/no rollout found/i.test(error)) return reject(new Error("CODEX_THREAD_BINDING_MISSING"));
          return reject(new Error("CODEX_RESUME_FAILED"));
        }
        const answer = readFileSync(output, "utf8").trim();
        if (!answer) return reject(new Error("MAIN04_ANSWER_MISSING"));
        resolve(answer);
      } catch {
        reject(new Error("MAIN04_ANSWER_MISSING"));
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
    });
    child.stdin.end(message);
  });
}

async function resumeQuestionWithRetry(message, delays = [250, 500, 1_000, 2_000, 4_000, 8_000, 16_000]) {
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await resumeQuestion(message);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "CODEX_DESTINATION_BUSY" || attempt === delays.length) throw error;
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
  throw new Error("CODEX_DESTINATION_BUSY");
}

export function invokeMain04(payload) {
  const work = async () => {
    if (payload?.schemaVersion !== "bimlog-main04-question.v1" || payload?.destinationThreadId !== THREAD_ID || typeof payload?.requestId !== "string" || typeof payload?.question !== "string" || !payload.question.trim()) throw new Error("REQUEST_REFUSED");
    const marker = `BIMLOG_REQUEST_ID=${payload.requestId}`;
    const message = [
      marker,
      "Answer the authenticated BIMLog user's exact question. Return only the user-facing answer; do not mention this envelope or its metadata.",
      `EXACT_QUESTION=${JSON.stringify(payload.question)}`,
      `TRUSTED_PAGE_CONTEXT=${JSON.stringify(payload.context || {})}`,
    ].join("\n");
    const answer = await resumeQuestionWithRetry(message);
    return { threadId: THREAD_ID, requestId: payload.requestId, answer, answerDigest: createHash("sha256").update(answer).digest("hex") };
  };
  const result = queue.then(work, work);
  queue = result.then(() => undefined, () => undefined);
  return result;
}

function submitMain04(payload) {
  if (payload?.schemaVersion !== "bimlog-main04-question.v1" || payload?.destinationThreadId !== THREAD_ID || typeof payload?.requestId !== "string" || typeof payload?.question !== "string" || !payload.question.trim()) throw new Error("REQUEST_REFUSED");
  if (jobs.has(payload.requestId)) return jobs.get(payload.requestId);
  const job = { threadId: THREAD_ID, requestId: payload.requestId, state: "QUEUED", createdAt: Date.now() };
  jobs.set(payload.requestId, job);
  void invokeMain04(payload).then(
    result => Object.assign(job, result, { state: "SUCCEEDED", completedAt: Date.now() }),
    error => Object.assign(job, { state: "FAILED", error: error instanceof Error ? error.message : "MAIN04_FAILED", completedAt: Date.now() }),
  );
  return job;
}

function publicJob(job) {
  if (job.state === "SUCCEEDED") return { threadId: job.threadId, requestId: job.requestId, state: job.state, answer: job.answer, answerDigest: job.answerDigest };
  if (job.state === "FAILED") return { threadId: job.threadId, requestId: job.requestId, state: job.state, error: job.error };
  return { threadId: job.threadId, requestId: job.requestId, state: job.state };
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, "/")}`).href) {
  if (!TOKEN) throw new Error("BIMLOG_MAIN04_BRIDGE_TOKEN is required");
  createServer(async (request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    if (request.method === "GET" && request.url === "/healthz") return response.end(JSON.stringify({ ok: true, threadId: THREAD_ID }));
    if (!authorized(request.headers.authorization)) {
      response.statusCode = 404;
      return response.end(JSON.stringify({ error: "NOT_FOUND" }));
    }
    try {
      if (request.method === "POST" && request.url === "/bimlog/main04") {
        const job = submitMain04(await readBody(request));
        response.statusCode = job.state === "SUCCEEDED" ? 200 : 202;
        return response.end(JSON.stringify(publicJob(job)));
      }
      const match = request.method === "GET" && request.url?.match(/^\/bimlog\/main04\/([A-Za-z0-9-]{8,128})$/);
      const job = match ? jobs.get(match[1]) : null;
      if (!job) {
        response.statusCode = 404;
        return response.end(JSON.stringify({ error: "NOT_FOUND" }));
      }
      response.statusCode = job.state === "FAILED" ? 503 : job.state === "SUCCEEDED" ? 200 : 202;
      response.end(JSON.stringify(publicJob(job)));
    } catch (error) {
      response.statusCode = 503;
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "MAIN04_FAILED" }));
    }
  }).listen(PORT, "127.0.0.1", () => console.log(JSON.stringify({ event: "bimlog_main04_bridge_ready", port: PORT, threadId: THREAD_ID })));
}
