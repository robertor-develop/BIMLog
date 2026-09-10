import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

for (const workspace of [".ji", ".jo", ".tp", ".cvp", ".fc-page", ".hq-admin-page"]) {
  assert.ok(css.includes(workspace), `missing workspace selector ${workspace}`);
}

assert.match(css, /\.page-content > :is\(/);
assert.match(css, /width:\s*100%/);
assert.match(css, /max-width:\s*none/);
assert.match(css, /:has\(> \[hidden\]\)/);
assert.match(css, /:not\(\[hidden\]\):only-child/);
assert.match(css, /grid-column:\s*1 \/ -1/);
assert.match(css, /\.page-content \.hq-admin-shell\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*none;/s);

console.log("Workspace width contract: 13/13 passed");
