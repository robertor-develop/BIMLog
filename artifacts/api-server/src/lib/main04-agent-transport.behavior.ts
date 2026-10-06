import assert from "node:assert/strict";
import { askBimlogMain04, BIMLOG_MAIN04_THREAD_ID } from "./main04-agent-transport";

const context = { route: "/projects/63/intake", page: "Job Intake", section: "Contract setup", language: "en" as const, focusedControl: "Counterparty", controls: ["Counterparty"], pageText: ["Needs info"], history: [] };
let captured: any;
const answer = "Use the visible Contract Items section next.";
const goodFetch: typeof fetch = async (_url, init) => {
  captured = JSON.parse(String(init?.body));
  return new Response(JSON.stringify({ threadId: BIMLOG_MAIN04_THREAD_ID, requestId: captured.requestId, answer }), { status: 200, headers: { "content-type": "application/json" } });
};
const result = await askBimlogMain04({ question: "What exactly is missing?", context, userId: 7, projectId: 63 }, { fetch: goodFetch, environment: { BIMLOG_MAIN04_BRIDGE_URL: "https://connector.example.test/bimlog", BIMLOG_MAIN04_BRIDGE_TOKEN: "secret" } });
assert.equal(captured.question, "What exactly is missing?", "the user's exact question must reach MAIN 04.00");
assert.equal(captured.destinationThreadId, BIMLOG_MAIN04_THREAD_ID);
assert.equal(result.answer, answer, "the panel answer must be the task's returned answer");
assert.equal(result.answerDigest.length, 64);

const receiptFetch: typeof fetch = async (_url, init) => {
  const request = JSON.parse(String(init?.body));
  return new Response(JSON.stringify({ threadId: BIMLOG_MAIN04_THREAD_ID, requestId: request.requestId, receipt: "accepted" }), { status: 200, headers: { "content-type": "application/json" } });
};
await assert.rejects(() => askBimlogMain04({ question: "Do not show a receipt.", context, userId: 7, projectId: 63 }, { fetch: receiptFetch, environment: { BIMLOG_MAIN04_BRIDGE_URL: "https://connector.example.test/bimlog", BIMLOG_MAIN04_BRIDGE_TOKEN: "secret" } }), /MAIN04_ANSWER_MISSING/);

const wrongDestinationFetch: typeof fetch = async (_url, init) => {
  const request = JSON.parse(String(init?.body));
  return new Response(JSON.stringify({ threadId: "01a0eaec-81ed-7381-a9fc-74fb7e1d9c37", requestId: request.requestId, answer: "Wrong MAIN" }), { status: 200, headers: { "content-type": "application/json" } });
};
await assert.rejects(() => askBimlogMain04({ question: "Only MAIN 04.00", context, userId: 7, projectId: 63 }, { fetch: wrongDestinationFetch, environment: { BIMLOG_MAIN04_BRIDGE_URL: "https://connector.example.test/bimlog", BIMLOG_MAIN04_BRIDGE_TOKEN: "secret" } }), /MAIN04_DESTINATION_MISMATCH/);

console.log("main04-agent-transport.behavior: PASS");
