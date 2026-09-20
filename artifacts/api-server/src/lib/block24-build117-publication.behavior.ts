import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "../..");
const guide = fs.readFileSync(path.join(root, "docs/deployment/DATABASE_MIGRATION_SAFETY.md"), "utf8");
assert.match(guide, /exact GitHub `master` source/i);
assert.match(guide, /Replit Shell/i);
assert.match(guide, /Replit Agents are prohibited/i);
assert.match(guide, /development-data copy off/i);
assert.match(guide, /no destructive database changes/i);
console.log("block24 build117 governed Replit Shell publication path: PASS");
