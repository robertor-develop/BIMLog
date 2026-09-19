import assert from "node:assert/strict";
import fs from "node:fs";

const state = fs.readFileSync(new URL("./RouteState.tsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../../index.css", import.meta.url), "utf8");

for (const kind of ["loading", "empty", "denied", "offline", "error"]) assert.ok(state.includes(`${kind}:`), `missing ${kind} state`);
assert.match(state, /role=\{loading \? "status" : "alert"\}/);
assert.match(state, /Try again \/ Intentar de nuevo/);
assert.match(state, /Return to headquarters \/ Volver a la sede/);
assert.match(app, /setState\("error"\)/, "access service failure must not become denied");
assert.match(app, /<RouteState kind="error" code="ACCESS_PROFILE_UNAVAILABLE" onRetry=/);
assert.match(app, /setProjectError\(true\)/);
assert.match(app, /<RouteState kind="denied"/);
assert.match(css, /\.route-state \{[\s\S]*max-width: 680px/);

console.log(JSON.stringify({ status: "PASS", states: 5, actionable: true, silentFallback: false }));
