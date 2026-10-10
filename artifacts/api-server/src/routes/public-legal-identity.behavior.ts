import assert from "node:assert/strict";
import fs from "node:fs";

const route = fs.readFileSync(new URL("./public-legal-identity.ts", import.meta.url), "utf8");
const index = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8");
assert.match(route, /router\.get\("\/public\/legal-identity"/);
assert.match(route, /Cache-Control", "no-store"/);
assert.match(route, /derivePublicLegalIdentity\(process\.env\)/);
assert.doesNotMatch(route, /authMiddleware|missingConfigurationKeys|checkedAt/);
const projection = fs.readFileSync(new URL("../lib/public-legal-identity.ts", import.meta.url), "utf8");
assert.doesNotMatch(projection, /registrationNumber: profile|taxIdentifier: profile|billingEmail: profile|registeredAddress: profile/);
assert.match(index, /import publicLegalIdentityRouter from "\.\/public-legal-identity"/);
assert.match(index, /router\.use\(publicLegalIdentityRouter\)/);
console.log("LR007 cache-safe public legal identity endpoint: PASS");
