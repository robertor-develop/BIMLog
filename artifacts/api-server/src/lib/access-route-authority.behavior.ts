import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const app = fs.readFileSync(path.resolve("../bimlog/src/App.tsx"), "utf8");
const sidebar = fs.readFileSync(path.resolve("../bimlog/src/components/layout/MasterSidebar.tsx"), "utf8");
const auth = fs.readFileSync(path.resolve("src/routes/auth.ts"), "utf8");
const profile = fs.readFileSync(path.resolve("src/lib/access-profile.ts"), "utf8");

for (const [route, surface] of [
  ["/admin", "project_administration"],
  ["/admin/feedback", "feedback_administration"],
  ["/total-control", "total_control"],
  ["/living-brief", "living_brief"],
  ["/company-catalogs", "company_catalogs"],
  ["/company-workflows", "company_workflows"],
  ["/company-pricing-templates", "company_pricing"],
] as const) {
  assert.match(app, new RegExp(`path=\\"${route.replace("/", "\\/")}\\"[\\s\\S]{0,180}surface=\\"${surface}\\"`));
}
assert.match(app, /ACCESS_PROFILE_UNAVAILABLE/);
assert.match(app, /Access unavailable \/ Acceso no disponible/);
assert.match(sidebar, /profile\.decisions\.project_administration\.allow/);
assert.match(sidebar, /profile\.decisions\.company_catalogs\.allow/);
assert.match(sidebar, /profile\.decisions\.total_control\.allow/);
assert.doesNotMatch(sidebar, /projects\.some\(p => p\.userRole === "project_admin"\)/);
assert.match(auth, /\/auth\/access-profile/);
assert.match(profile, /financial_authority_revocations/);
assert.match(profile, /pm\.status='active'.*p\.status<>'archived'/s);

console.log("access route authority: 16/16 passed");
