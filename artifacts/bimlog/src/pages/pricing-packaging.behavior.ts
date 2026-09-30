import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Pricing.tsx", import.meta.url), "utf8");

assert.match(source, /Find a practical starting plan/);
assert.match(source, /does not change access or create a subscription/);
assert.match(source, /recommendPackageFit\(fitInput\)/);
assert.match(source, /summarizePackageLimits/);
assert.match(source, /Compare package capabilities/);
assert.match(source, /planIncludesCapability/);
assert.match(source, /aria-labelledby="package-fit-title"/);
assert.match(source, /role="status"/);
assert.match(source, /Commercial terms, add-ons and implementation/);
assert.match(source, /COMMERCIAL_ADDONS\.map/);
assert.match(source, /IMPLEMENTATION_SERVICES\.map/);
assert.match(source, /Public prices exclude applicable taxes/);

console.log("Commercial packaging build 005 pricing experience: PASS");
