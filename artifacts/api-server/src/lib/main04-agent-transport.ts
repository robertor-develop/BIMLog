import { createHash, randomUUID } from "node:crypto";
import { BIMLOG_ASSISTANT_ROUTES } from "./assistant-route-registry";
import { resolveBimlogDedicatedAgent } from "./page-assistant-agent-registry";

export const BIMLOG_MAIN04_THREAD_ID = BIMLOG_ASSISTANT_ROUTES.conversation.threadId;

export type Main04QuestionContext = { route: string; page: string; section: string; language: "en" | "es"; focusedControl: string; controls: string[]; pageText: string[]; history: Array<{ role: "user" | "assistant"; content: string }> };
type Main04BridgeResponse = { threadId?: unknown; answer?: unknown; requestId?: unknown; state?: unknown; error?: unknown };

function assistantText(content: unknown) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((item): item is { type: "text"; text: string } => Boolean(item && typeof item === "object" && (item as any).type === "text" && typeof (item as any).text === "string"))
    .map(item => item.text)
    .join("\n")
    .trim();
}

function parseDedicatedAnswer(raw: string, controls: string[]) {
  const candidate = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const parsed = JSON.parse(candidate) as { answer?: unknown; highlightLabels?: unknown };
  const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
  if (!answer) throw new Error("MAIN04_ANSWER_MISSING");
  const allowed = new Set(controls);
  const highlightLabels = Array.isArray(parsed.highlightLabels)
    ? parsed.highlightLabels.filter((label): label is string => typeof label === "string" && allowed.has(label)).slice(0, 8)
    : [];
  return { answer: answer.slice(0, 16_000), highlightLabels };
}

export async function answerBimlogMain04(input: { requestId: string; question: string; context: Main04QuestionContext; userId: number; companyId: number; projectId: number | null }) {
  const agent = resolveBimlogDedicatedAgent();
  const { getAnthropicClientForUser } = await import("./ai-usage");
  const anthropic = await getAnthropicClientForUser({ userId: input.userId, projectId: input.projectId, feature: "bimlog_page_assistant" });
  const evidence = {
    requestId: input.requestId,
    tenant: { companyId: input.companyId, projectId: input.projectId },
    question: input.question,
    currentPage: input.context,
    visibleControls: input.context.controls,
  };
  const message = await anthropic.messages.create({
    model: agent.model,
    max_tokens: 1200,
    temperature: 0,
    system: agent.instructions,
    messages: [{ role: "user", content: JSON.stringify(evidence) }],
  });
  const parsed = parseDedicatedAnswer(assistantText(message.content), input.context.controls);
  return { ...parsed, requestId: input.requestId, answerDigest: createHash("sha256").update(parsed.answer, "utf8").digest("hex"), threadId: BIMLOG_MAIN04_THREAD_ID };
}

function bridgeConfiguration(environment: NodeJS.ProcessEnv = process.env) {
  const url = environment.BIMLOG_MAIN04_BRIDGE_URL?.trim();
  const token = environment.BIMLOG_MAIN04_BRIDGE_TOKEN?.trim();
  const accessClientId = environment.BIMLOG_MAIN04_ACCESS_CLIENT_ID?.trim();
  const accessClientSecret = environment.BIMLOG_MAIN04_ACCESS_CLIENT_SECRET?.trim();
  if (!url || !token) throw new Error("MAIN04_TRANSPORT_NOT_CONFIGURED");
  if (Boolean(accessClientId) !== Boolean(accessClientSecret)) throw new Error("MAIN04_ACCESS_CONFIGURATION_INCOMPLETE");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") throw new Error("MAIN04_TRANSPORT_URL_REFUSED");
  return { url: parsed.toString(), token, accessClientId, accessClientSecret };
}

function bridgeHeaders(requestId: string, environment?: NodeJS.ProcessEnv) {
  const { token, accessClientId, accessClientSecret } = bridgeConfiguration(environment);
  const headers: Record<string, string> = { authorization: `Bearer ${token}`, "content-type": "application/json", "x-bimlog-request-id": requestId };
  if (accessClientId && accessClientSecret) {
    headers["cf-access-client-id"] = accessClientId;
    headers["cf-access-client-secret"] = accessClientSecret;
  }
  return headers;
}

export async function dispatchBimlogMain04(input: { requestId: string; question: string; context: Main04QuestionContext; userId: number; companyId: number; projectId: number | null; conversationId: string }, dependencies: { fetch?: typeof fetch; environment?: NodeJS.ProcessEnv } = {}) {
  const { url, token, accessClientId, accessClientSecret } = bridgeConfiguration(dependencies.environment);
  void token; void accessClientId; void accessClientSecret;
  const body = { schemaVersion: "bimlog-main04-question.v1", requestId: input.requestId, destinationThreadId: BIMLOG_MAIN04_THREAD_ID, product: "bimlog", lane: "BIMLOG_CONVERSATION", question: input.question, context: input.context, actor: { userId: input.userId, companyId: input.companyId, projectId: input.projectId }, conversationId: input.conversationId, idempotencyKey: input.requestId };
  const response = await (dependencies.fetch ?? fetch)(url, { method: "POST", headers: bridgeHeaders(input.requestId, dependencies.environment), body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) });
  if (!response.ok && response.status !== 202) throw new Error(`MAIN04_TRANSPORT_FAILED_${response.status}`);
  const result = await response.json() as Main04BridgeResponse;
  if (result.requestId !== undefined && result.requestId !== input.requestId) throw new Error("MAIN04_REQUEST_MISMATCH");
  if (result.threadId !== undefined && result.threadId !== BIMLOG_MAIN04_THREAD_ID) throw new Error("MAIN04_DESTINATION_MISMATCH");
  if (response.status !== 202 && typeof result.answer !== "string" && result.state === undefined) throw new Error("MAIN04_ANSWER_MISSING");
  return { state: String(result.state || (response.status === 202 ? "QUEUED" : "RUNNING")), answer: typeof result.answer === "string" ? result.answer.trim() : "" };
}

export async function readBimlogMain04(requestId: string, dependencies: { fetch?: typeof fetch; environment?: NodeJS.ProcessEnv } = {}) {
  const { url } = bridgeConfiguration(dependencies.environment);
  const response = await (dependencies.fetch ?? fetch)(new URL(encodeURIComponent(requestId), url.endsWith("/") ? url : `${url}/`).toString(), { method: "GET", headers: bridgeHeaders(requestId, dependencies.environment), signal: AbortSignal.timeout(30_000) });
  const result = await response.json() as Main04BridgeResponse;
  if (!response.ok && response.status !== 202 && String(result.state || "").toUpperCase() !== "FAILED") throw new Error(`MAIN04_TRANSPORT_FAILED_${response.status}`);
  if (result.requestId !== requestId) throw new Error("MAIN04_REQUEST_MISMATCH");
  if (result.threadId !== undefined && result.threadId !== BIMLOG_MAIN04_THREAD_ID) throw new Error("MAIN04_DESTINATION_MISMATCH");
  return { state: String(result.state || (response.status === 202 ? "RUNNING" : "COMPLETE")), answer: typeof result.answer === "string" ? result.answer.trim() : "", errorCode: typeof result.error === "string" ? result.error.slice(0, 120) : "" };
}

export async function askBimlogMain04(input: { question: string; context: Main04QuestionContext; userId: number; projectId: number | null; companyId?: number }, dependencies: { fetch?: typeof fetch; environment?: NodeJS.ProcessEnv } = {}) {
  const requestId = randomUUID();
  const initial = await dispatchBimlogMain04({ ...input, requestId, companyId: input.companyId ?? 0, conversationId: randomUUID() }, dependencies);
  let result = initial;
  const deadline = Date.now() + 190_000;
  while (!result.answer) {
    if (Date.now() >= deadline) throw new Error("MAIN04_TRANSPORT_TIMEOUT");
    await new Promise(resolve => setTimeout(resolve, 1_000));
    result = await readBimlogMain04(requestId, dependencies);
  }
  const answer = result.answer;
  if (!answer) throw new Error("MAIN04_ANSWER_MISSING");
  return { answer, requestId, answerDigest: createHash("sha256").update(answer, "utf8").digest("hex"), threadId: BIMLOG_MAIN04_THREAD_ID };
}
