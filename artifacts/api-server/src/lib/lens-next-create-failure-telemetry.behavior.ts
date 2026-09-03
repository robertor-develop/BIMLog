import assert from "node:assert/strict";
import { serializeLensNextCreateFailure } from "./lens-next-create-failure-telemetry";

const postgresCause = Object.assign(new Error("connection terminated during BEGIN"), {
  code: "57P01",
  constraint: "lens_identity_unique",
  detail: "server closed the connection unexpectedly",
  schema: "public",
  table: "lens_viewpoints",
  column: "viewpoint_id",
  routine: "ProcessInterrupts",
  where: "SQL statement BEGIN",
});
const failure = Object.assign(new TypeError("transaction acquisition failed", { cause: postgresCause }), {
  stack: "TypeError: transaction acquisition failed\n    at createLensNextIssue (clash_reports.ts:749:31)",
});
const line = serializeLensNextCreateFailure({ error: failure, correlationId: "test-correlation", projectId: 26, stage: "transaction_start" });
assert.equal(line.includes("\n"), false, "serialized failure event must occupy one physical line");
const parsed = JSON.parse(line);
assert.equal(parsed.event, "lens_next_create_failure");
assert.equal(parsed.correlationId, "test-correlation");
assert.equal(parsed.projectId, 26);
assert.equal(parsed.transactionStage, "transaction_start");
assert.equal(parsed.exceptionClass, "TypeError");
assert.equal(parsed.exceptionMessage, "transaction acquisition failed");
assert.equal(parsed.exceptionCause, "connection terminated during BEGIN");
assert.equal(parsed.postgresCode, "57P01");
assert.equal(parsed.constraint, "lens_identity_unique");
assert.equal(parsed.detail, "server closed the connection unexpectedly");
assert.equal(parsed.schema, "public");
assert.equal(parsed.table, "lens_viewpoints");
assert.equal(parsed.column, "viewpoint_id");
assert.equal(parsed.routine, "ProcessInterrupts");
assert.equal(parsed.sourceFunction, "ProcessInterrupts");
assert.equal(parsed.sourceContext, "SQL statement BEGIN");

const hostile = new Proxy({}, { get() { throw new Error("hostile getter"); } });
assert.doesNotThrow(() => JSON.parse(serializeLensNextCreateFailure({ error: hostile, correlationId: "safe", projectId: 26, stage: "request_validation" })));
console.log(line);
