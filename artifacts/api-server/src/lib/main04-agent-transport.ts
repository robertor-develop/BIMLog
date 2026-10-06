import { createHash, randomUUID } from "node:crypto";
import { BIMLOG_ASSISTANT_ROUTES } from "./assistant-route-registry";

export const BIMLOG_MAIN04_THREAD_ID = BIMLOG_ASSISTANT_ROUTES.conversation.threadId;

export type Main04QuestionContext = { route: string; page: string; section: string; language: "en" | "es"; focusedControl: string; controls: string[]; pageText: string[]; history: Array<{ role: "user" | "assistant"; content: string }> };
type Main04BridgeResponse = { threadId?: unknown; answer?: unknown; requestId?: unknown };

function bridgeConfiguration(environment: NodeJS.ProcessEnv = process.env) {
  const url = environment.BIMLOG_MAIN04_BRIDGE_URL?.trim();
  const token = environment.BIMLOG_MAIN04_BRIDGE_TOKEN?.trim();
  if (!url || !token) throw new Error("MAIN04_TRANSPORT_NOT_CONFIGURED");
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") throw new Error("MAIN04_TRANSPORT_URL_REFUSED");
  return { url: parsed.toString(), token };
}

export async function askBimlogMain04(input: { question: string; context: Main04QuestionContext; userId: number; projectId: number | null }, dependencies: { fetch?: typeof fetch; environment?: NodeJS.ProcessEnv } = {}) {
  const { url, token } = bridgeConfiguration(dependencies.environment);
  const requestId = randomUUID();
  const body = { schemaVersion: "bimlog-main04-question.v1", requestId, destinationThreadId: BIMLOG_MAIN04_THREAD_ID, question: input.question, context: input.context, actor: { userId: input.userId, projectId: input.projectId } };
  const response = await (dependencies.fetch ?? fetch)(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "x-bimlog-request-id": requestId }, body: JSON.stringify(body), signal: AbortSignal.timeout(190_000) });
  if (!response.ok) throw new Error(`MAIN04_TRANSPORT_FAILED_${response.status}`);
  const result = await response.json() as Main04BridgeResponse;
  if (result.threadId !== BIMLOG_MAIN04_THREAD_ID) throw new Error("MAIN04_DESTINATION_MISMATCH");
  if (result.requestId !== requestId) throw new Error("MAIN04_REQUEST_MISMATCH");
  const answer = typeof result.answer === "string" ? result.answer.trim() : "";
  if (!answer) throw new Error("MAIN04_ANSWER_MISSING");
  return { answer, requestId, answerDigest: createHash("sha256").update(answer, "utf8").digest("hex"), threadId: BIMLOG_MAIN04_THREAD_ID };
}
