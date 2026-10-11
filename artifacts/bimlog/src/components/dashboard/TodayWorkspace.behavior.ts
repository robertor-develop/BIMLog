import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./TodayWorkspace.tsx", import.meta.url), "utf8");
for (const token of [
  'state === "loading"',
  'role="status"',
  'Finding your next action',
  'state === "unavailable"',
  'role="alert"',
  'Guidance is unavailable right now',
  'state === "empty"',
  'state === "ready" && action',
]) assert.ok(source.includes(token), token);
assert.ok(!source.includes("{action ?"), "unresolved guidance must not fall through to the empty state");

console.log("Today workspace guidance states: PASS");
