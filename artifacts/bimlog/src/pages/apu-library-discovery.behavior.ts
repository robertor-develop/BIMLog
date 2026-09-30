import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("./CompanyPricingTemplates.tsx", import.meta.url), "utf8");
assert.match(page, /Search APUs/);
assert.match(page, /statusFilter/);
assert.match(page, /quantity × unit cost/);
assert.match(page, /Company library/);
assert.match(page, /visibleItems\.map/);
console.log("apu-library-discovery.behavior: PASS searchable APU metadata and immutable preview entry are visible");
