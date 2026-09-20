import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "../..");
const app = fs.readFileSync(path.join(root, "artifacts/bimlog/src/App.tsx"), "utf8");
for (const route of ["/dashboard", "/pending", "/lens-next", "/help", "/profile", "/settings/company-profile", "/admin/feedback", "/company-catalogs", "/company-workflows", "/company-pricing-templates", "/total-control", "/living-brief"]) {
  assert.ok(app.includes(route), `missing authenticated route ${route}`);
}
const evidence = fs.readFileSync(path.join(root, "evidence/stabilization-program-20260919/BUILD_112_AUTHENTICATED_ROUTE_MATRIX.md"), "utf8");
for (const surface of ["RFIs", "Submittals", "Transmittals", "Change Orders", "Clash Reports", "Integrations"]) assert.ok(evidence.includes(surface));
console.log("block23 build112 authenticated route matrix contract: PASS");

