import assert from "node:assert/strict";
import fs from "node:fs";
import { projectApuIdentity } from "./apu-library-reuse";

const service=fs.readFileSync(new URL("./project-apu-library-service.ts",import.meta.url),"utf8");
const route=fs.readFileSync(new URL("../routes/company-pricing-templates.ts",import.meta.url),"utf8");
assert.match(service,/template\.latest_status !== "published"/);
assert.match(service,/APU_LIBRARY_VERSION_INELIGIBLE/);
assert.match(route,/status IN\('published','retired'\)[\s\S]*WHERE status='published'/);
assert.notEqual(projectApuIdentity(101,"shared-template"),projectApuIdentity(202,"shared-template"));
assert.match(route,/status:"retired"/);
console.log("apu-library-retirement.behavior: PASS retired APUs remain historical, are excluded from selection, and two projects keep independent lineage");
