import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const route = fs.readFileSync(path.join(root, "artifacts/api-server/src/routes/living_brief.ts"), "utf8");
const page = fs.readFileSync(path.join(root, "artifacts/bimlog/src/pages/LivingBrief.tsx"), "utf8");
const app = fs.readFileSync(path.join(root, "artifacts/bimlog/src/App.tsx"), "utf8");
const checks = [];

function check(name, fn) {
  fn();
  checks.push(name);
}

check("F5 remains limited to server-confirmed eligible users", () => {
  assert.match(app, /d\.eligible/);
  assert.match(app, /e\.key === "F5"[^]*eligibleRef\.current/);
});

check("eligibility remains independently derived from current super-admin or explicit grant state", () => {
  assert.match(route, /select\(\{ isSuperAdmin: usersTable\.isSuperAdmin, canAccess: usersTable\.canAccessLivingBrief \}\)/);
  assert.match(route, /u\?\.isSuperAdmin \|\| u\?\.canAccess/);
});

check("unlock remains authenticated and fails closed for an ineligible user", () => {
  assert.match(route, /router\.post\("\/living-brief\/unlock", authMiddleware/);
  assert.match(route, /if \(!\(await isEligible\(req\.user!\.userId\)\)\)[^]*res\.status\(403\)/);
});

check("unlock does not read or verify a BIMAI360 gate password", () => {
  const start = route.indexOf('router.post("/living-brief/unlock"');
  const end = route.indexOf("// Return the verified deployed source bundle", start);
  const unlock = route.slice(start, end);
  assert.ok(unlock.length > 0);
  assert.doesNotMatch(unlock, /password|verifyLivingBriefGatePassword|Incorrect password|Password required/i);
});

check("passwordless unlock issues a short-lived token bound to the current revocation version", () => {
  assert.match(route, /const credentialVersion = \(await getLivingBriefGateCredential\(\)\)\?\.version \?\? 0;/);
  assert.match(route, /signBriefAccessToken\(req\.user!\.userId, credentialVersion\)/);
});

check("document middleware revalidates token identity and current eligibility", () => {
  assert.match(route, /payload\.scope !== "living_brief" \|\| payload\.userId !== req\.user!\.userId/);
  assert.match(route, /payload\.credentialVersion !== credentialVersion/);
  assert.match(route, /if \(!\(await isEligible\(req\.user!\.userId\)\)\)[^]*Living Brief access not granted/);
  assert.match(route, /router\.get\("\/living-brief\/docs", authMiddleware, briefAccessMiddleware/);
});

check("eligible page bootstrap obtains access without sending password material", () => {
  assert.match(page, /apiFetch\("\/living-brief\/unlock", token, \{ method: "POST" \}\)/);
  assert.doesNotMatch(page, /Enter password|Living Brief - Locked/);
});

console.log(JSON.stringify({
  suite: "living-brief-passwordless-access-source-proof",
  productionAccess: false,
  database: "not used",
  passed: checks.length,
  checks,
}, null, 2));
