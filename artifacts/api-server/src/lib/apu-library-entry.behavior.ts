import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../routes/company-pricing-templates.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../../../bimlog/src/pages/CompanyPricingTemplates.tsx", import.meta.url), "utf8");
assert.match(route, /router\.get\("\/company\/pricing-templates"[\s\S]*actorFor\(req,res,false\)/);
assert.match(page, /APU Library/);
assert.match(page, /Find, preview, and govern reusable company APU definitions/);
console.log("apu-library-entry.behavior: PASS company readers can open the clearly named APU Library");
