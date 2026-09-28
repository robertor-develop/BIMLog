import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../components/dashboard/ResponsibilityWorkspace.tsx", import.meta.url), "utf8");
for (const required of ["my_work", "my_company", "authorized_projects", "role=\"tablist\"", "aria-selected", "role=\"alert\"", "Open linked Lens evidence", "does not create parallel tasks", "publishUpdateMeaning", "localStorage.setItem", "Traceable responsibility summary", "Open source", "does not score people or send notifications"])
  assert.ok(source.includes(required), `missing responsibility UI contract: ${required}`);
assert.ok(!source.includes("isSuperAdmin"), "workspace must not invent super-admin authority");
console.log("C030 responsibility workspace UI contract: PASS");
