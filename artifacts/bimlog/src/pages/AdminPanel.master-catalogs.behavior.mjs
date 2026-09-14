import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("./AdminPanel.tsx", import.meta.url), "utf8");

assert.match(source, /"Master Catalogs"/, "super-admin navigation must expose master catalogs");
assert.match(source, /\/master-catalogs\/\$\{kind\}\?includeInactive=true/, "catalog administration must load active and inactive entries");
assert.match(source, /\/admin\/master-catalogs\/\$\{kind\}/, "catalog creation must use the governed super-admin route");
assert.match(source, /\/admin\/master-catalogs\/\$\{kind\}\/\$\{entry\.id\}/, "catalog lifecycle changes must use the governed versioned entry route");
assert.match(source, /Clients are managed in Companies/, "the existing client authority must remain explicit");
assert.match(source, /disciplines in the existing enterprise authority/, "the existing discipline authority must remain explicit");
assert.doesNotMatch(source, /method:\s*"DELETE"[^]*master-catalogs/, "master catalogs must never expose destructive deletion");

console.log("Admin master catalog behavior: PASS");
