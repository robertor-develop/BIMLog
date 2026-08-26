import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync(new URL("./LensNextPanel.tsx", import.meta.url), "utf8");
const start = panel.indexOf("const materializeMyView");
const block = panel.slice(start, panel.indexOf("return (", start));
assert.ok(start >= 0);
assert.match(block, /filter\(viewpoint => viewpoint\.lensNextPublished\)/);
assert.match(block, /publishedGuids\.has/);
assert.match(block, /bridgeClient\.materializeMyView/);
assert.match(block, /Original Lens and unmanaged folders will not be changed/);
assert.doesNotMatch(block, /lens-sync|remove|delete/i);
const client = fs.readFileSync(new URL("./lens-next-client.ts", import.meta.url), "utf8");
assert.match(client, /\/v1\/materialize-my-view/);
assert.match(client, /my_view_materialized/);
console.log(JSON.stringify({ status: "PASS", tests: ["current-filtered-view", "exact-local-guid-only", "dedicated-command", "explicit-confirmation", "no-legacy-sync-or-delete"] }));
