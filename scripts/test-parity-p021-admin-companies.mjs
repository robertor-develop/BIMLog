import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const panel = read("artifacts/bimlog/src/pages/AdminPanel.tsx");
const directory = read("artifacts/bimlog/src/lib/capability-directory.ts");
const routes = read("artifacts/api-server/src/routes/admin.ts");

assert.match(directory, /id: "company-directory"[\s\S]*href: "\/admin\?tab=companies"[\s\S]*audience: "project_administration"/);
assert.match(panel, /requested === "companies"\) setActiveTab\(2\)/);
assert.match(panel, /Loading participating companies/);
assert.match(panel, /No participating companies are connected/);
assert.match(panel, /role="alert"/);
assert.match(panel, /The admin log contains the evidence record/);
assert.match(panel, /Reassign users before deleting/);
assert.match(routes, /router\.get\("\/admin\/companies"/);
assert.match(routes, /router\.patch\("\/admin\/companies\/:id"/);
assert.match(routes, /router\.delete\("\/admin\/companies\/:id"/);
assert.match(routes, /Number\(userCount\) > 0[\s\S]*status\(409\)/);
assert.match(routes, /action: "update_company"/);
assert.match(routes, /action: "delete_company"/);

console.log("P021 admin companies parity checks passed");
