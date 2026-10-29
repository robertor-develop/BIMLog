import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("artifacts/bimlog/src/pages/AdminPanel.tsx");
const routes = read("artifacts/api-server/src/routes/admin.ts");

assert.match(panel, /Email Log shows delivery evidence for projects you administer/);
assert.match(panel, /\/admin\/email-log\?scope=mine/);
assert.match(panel, /Loading email evidence/);
assert.match(panel, /No email delivery records match this administered scope and filter/);
assert.match(panel, /role="alert"[\s\S]*Retry/);
assert.match(panel, /A sent record confirms provider acceptance/);
assert.match(routes, /router\.get\("\/admin\/email-log"/);
assert.match(routes, /getProjectAdminProjectIds/);
assert.match(routes, /req\.query\.scope === "mine"/);

console.log("P032 governed email log parity checks passed");
