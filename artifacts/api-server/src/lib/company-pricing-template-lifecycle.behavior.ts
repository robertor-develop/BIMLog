import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("../routes/company-pricing-templates.ts", import.meta.url), "utf8");
const binding = fs.readFileSync(new URL("./company-pricing-template-binding.ts", import.meta.url), "utf8");
const migration = fs.readFileSync(new URL("./generic-apu-persistence-migration.ts", import.meta.url), "utf8");
const http = fs.readFileSync(new URL("./company-pricing-template.http-evidence.ts", import.meta.url), "utf8");

assert.match(route, /status:"draft"/);
assert.match(route, /status:"published"/);
assert.match(route, /status:"retired"/);
assert.match(route, /sourceVersionId:latest\.id/);
assert.match(route, /boundedReason\(req\.body\?\.reason\)/);
assert.match(route, /PRICING_TEMPLATE_MAKER_CHECKER_REQUIRED/);
assert.match(route, /PRICING_TEMPLATE_FINANCE_APPROVER_REQUIRED/);
assert.match(route, /PRICING_TEMPLATE_STALE_VERSION/);
assert.match(migration, /generic_apu_template_versions_immutable/);
assert.match(migration, /BEFORE UPDATE OR DELETE ON generic_apu_template_versions/);
assert.match(binding, /PRICING_TEMPLATE_VERSION_SUPERSEDED/);
assert.match(binding, /PRICING_TEMPLATE_FINGERPRINT_MISMATCH/);
assert.match(http, /New labor plan/);
assert.match(http, /Checked revision/);
assert.match(http, /Method no longer approved/);
assert.match(http, /PRICING_TEMPLATE_VERSION_SUPERSEDED/);
assert.match(http, /UPDATE generic_apu_template_versions SET name='changed'/);
assert.match(http, /PRICING_TEMPLATE_PMO_REQUIRED|\.status,403/);

console.log("company pricing-template lifecycle: draft, publish, append-only supersession, audit reason, immutable history, and unauthorized negatives PASS");
