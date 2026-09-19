import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const app = fs.readFileSync(path.resolve("../bimlog/src/App.tsx"), "utf8");
const dashboard = fs.readFileSync(path.resolve("../bimlog/src/pages/Dashboard.tsx"), "utf8");
const profile = fs.readFileSync(path.resolve("src/lib/access-profile.ts"), "utf8");

assert.match(app, /function ProjectRoute/);
assert.match(app, /resolveProjectContext\(profile, projectId\)/);
assert.match(app, /Global Super Administrator context/);
assert.match(app, /No active project \/ Sin proyecto activo/);
assert.equal((app.match(/<ProjectRoute component=/g) ?? []).length, 10);
assert.match(dashboard, /projects\.length === 0[\s\S]{0,180}setAgg\(\{ rfis: \[\], submittals: \[\], activity: \[\], files: \[\], loading: false \}\)/);
assert.match(profile, /active_projects/);
assert.match(profile, /pm\.status='active'/);
assert.match(profile, /p\.status<>'archived'/);

console.log("project context source: 9/9 passed");
