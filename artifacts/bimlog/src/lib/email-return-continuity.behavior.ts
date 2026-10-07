import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { safeEmailReturnTarget } from "./email-configuration-return";

const exact = "/projects/7/intake?stage=delivery&item=ji-email-readiness";
assert.equal(safeEmailReturnTarget(exact), exact);
assert.equal(safeEmailReturnTarget("https://evil.test/projects/7/intake"), null);
const readiness = readFileSync(new URL("../components/job-intake/EmailReadinessSection.tsx", import.meta.url), "utf8");
const profile = readFileSync(new URL("../pages/Profile.tsx", import.meta.url), "utf8");
assert.match(readiness, /stage=delivery&item=ji-email-readiness/);
assert.match(profile, /Your previous work is preserved/);
assert.match(profile, /return to the exact page and section where you started/);
console.log("Email configuration preserves and explains the exact return destination PASS");
