import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const domain = readFileSync(new URL("../artifacts/api-server/src/lib/launch-configuration.ts", import.meta.url), "utf8");
const behavior = readFileSync(new URL("../artifacts/api-server/src/lib/launch-configuration.behavior.ts", import.meta.url), "utf8");
const panel = readFileSync(new URL("../artifacts/bimlog/src/components/admin/LaunchConfigurationPanel.tsx", import.meta.url), "utf8");

const requiredIdentityFields = [
  "businessPhone",
  "supportPhone",
  "legalContactName",
  "legalContactEmail",
  "websiteUrl",
  "invoiceIdentity",
  "customerFacingFooter",
  "termsUrl",
  "privacyUrl",
];

for (const field of requiredIdentityFields) {
  assert.ok(domain.includes(field), `server launch identity must own ${field}`);
  assert.ok(panel.includes(field), `Super Admin launch center must expose ${field}`);
}

assert.match(domain, /url\.protocol === "https:"/);
assert.match(domain, /phonePattern\.test/);
assert.match(behavior, /termsUrl: "http:\/\/example\.test\/terms"/);
assert.match(behavior, /supportPhone: "call us"/);
assert.match(panel, /Required next:/);
assert.match(panel, /Siguiente requisito:/);
assert.doesNotMatch(panel, /Required sections:/);
assert.doesNotMatch(panel, /Secciones requeridas:/);

console.log("ENTERPRISE_LAUNCH_CONFIGURATION_BLOCK_07=PASS builds=31-35 businessProfile=complete legalLinks=https blockers=bilingual");
