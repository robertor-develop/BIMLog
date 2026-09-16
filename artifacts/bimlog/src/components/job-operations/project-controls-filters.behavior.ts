import assert from "node:assert/strict";
import { filterProjectControlsRows } from "./project-controls-filters.ts";

const rows = [
  { id: "scope-a", packageIds: ["wp-1"], memberIds: [7], status: "healthy" },
  { id: "scope-b", packageIds: ["wp-2"], memberIds: [8], status: "critical" },
];
const all = { scopeId: "", packageId: "", memberId: "", risk: "" };
assert.equal(filterProjectControlsRows(rows, all).length, 2);
assert.deepEqual(filterProjectControlsRows(rows, { ...all, scopeId: "scope-b" }), [rows[1]]);
assert.deepEqual(filterProjectControlsRows(rows, { ...all, packageId: "wp-1" }), [rows[0]]);
assert.deepEqual(filterProjectControlsRows(rows, { ...all, memberId: "7" }), [rows[0]]);
assert.deepEqual(filterProjectControlsRows(rows, { ...all, risk: "critical" }), [rows[1]]);
assert.deepEqual(filterProjectControlsRows(rows, { ...all, packageId: "wp-2", memberId: "7" }), []);
console.log("Project Controls filter combinations: PASS");
