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

const dispatchOrder: string[] = [];
let active = 0;
let maximumActive = 0;
const fifoFetch: typeof fetch = async (_url, init) => {
  const request = JSON.parse(String(init?.body));
  dispatchOrder.push(request.question);
  active += 1;
  maximumActive = Math.max(maximumActive, active);
  await new Promise(resolve => setTimeout(resolve, request.question === "first exact question" ? 20 : 1));
  active -= 1;
  return new Response(JSON.stringify({ threadId: BIMLOG_MAIN04_THREAD_ID, requestId: request.requestId, answer: `answer for ${request.question}` }), { status: 200, headers: { "content-type": "application/json" } });
};
const fifoEnvironment = { BIMLOG_MAIN04_BRIDGE_URL: "https://connector.example.test/bimlog", BIMLOG_MAIN04_BRIDGE_TOKEN: "secret" };
const concurrent = await Promise.all([
  askBimlogMain04({ question: "first exact question", context, userId: 7, projectId: 63 }, { fetch: fifoFetch, environment: fifoEnvironment }),
  askBimlogMain04({ question: "second exact question", context, userId: 8, projectId: 63 }, { fetch: fifoFetch, environment: fifoEnvironment }),
  askBimlogMain04({ question: "third exact question", context, userId: 9, projectId: 64 }, { fetch: fifoFetch, environment: fifoEnvironment }),
]);
assert.deepEqual(dispatchOrder, ["first exact question", "second exact question", "third exact question"], "simultaneous questions must dispatch in FIFO order");
assert.equal(maximumActive, 1, "only one MAIN 04.00 request may be active at a time");
assert.deepEqual(concurrent.map(item => item.answer), ["answer for first exact question", "answer for second exact question", "answer for third exact question"], "each answer must return to its own request");

console.log("main04-agent-transport.behavior: PASS");
