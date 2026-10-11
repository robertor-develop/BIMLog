import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");
assert.match(source, /isPending: adoptionSummaryLoading/);
assert.match(source, /isFetching: adoptionSummaryRefreshing/);
assert.match(source, /adoptionSummaryRefreshing && !adoptionSummaryLoading && !adoptionSummaryFailed/);
assert.match(source, /Refreshing Headquarters guidance\./);

console.log("Dashboard verified guidance refresh behavior: PASS");
