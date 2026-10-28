import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("./AllTools.tsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const sidebar = fs.readFileSync(new URL("../components/layout/MasterSidebar.tsx", import.meta.url), "utf8");
assert.match(app, /path="\/all-tools"/);
assert.match(sidebar, /"All Tools", "Todas las herramientas"/);
assert.match(page, /resolveCapabilityDirectory/);
assert.match(page, /entry\.href && setLocation\(entry\.href\)/);
assert.match(page, /searchCapabilities/);
assert.match(page, /id="all-tools-search"/);
assert.match(page, /Clear search/);
assert.match(page, /Administrator only/);
assert.match(page, /disabled=\{!entry\.href\}/);
assert.doesNotMatch(sidebar, /More Tools|Más herramientas/);
console.log("ALL_TOOLS_P007=PASS visible_route=true direct_actions=true");
