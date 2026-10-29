import fs from "node:fs";

const panel = fs.readFileSync(new URL("../artifacts/bimlog/src/pages/AdminPanel.tsx", import.meta.url), "utf8");
const routes = fs.readFileSync(new URL("../artifacts/api-server/src/routes/feature-policies.ts", import.meta.url), "utf8");
const service = fs.readFileSync(new URL("../artifacts/api-server/src/lib/feature-policy-service.ts", import.meta.url), "utf8");

const checks = [
  [panel.includes('"Policy Authority Grants"'), "visible Policy Authority Grants tab"],
  [panel.includes('requested === "policy-authority-grants" && isSuperAdmin'), "Super Admin-only direct navigation"],
  [panel.includes('/admin/feature-policy-authority-grants?companyId='), "metadata list UI"],
  [panel.includes('apiFetch("/admin/feature-policy-authority-grants"'), "audited grant creation UI"],
  [panel.includes('/admin/feature-policy-authority-grants/${encodeURIComponent(grantId)}/revoke'), "audited revocation UI"],
  [panel.includes("metadata only") && panel.includes("cross-company"), "plain-language authority and privacy guidance"],
  [panel.includes("Loading policy authority grant metadata") && panel.includes("No policy authority grants are recorded"), "loading and empty states"],
  [routes.includes('router.post("/admin/feature-policy-authority-grants",authMiddleware,isSuperAdminMiddleware'), "protected create route"],
  [routes.includes('router.get("/admin/feature-policy-authority-grants",authMiddleware,isSuperAdminMiddleware'), "protected metadata route"],
  [routes.includes('router.post("/admin/feature-policy-authority-grants/:grantId/revoke",authMiddleware,isSuperAdminMiddleware'), "protected revoke route"],
  [service.includes('"CROSS_COMPANY_FORBIDDEN"') && service.includes('"GRANT_ALREADY_REVOKED"'), "cross-company and duplicate-revoke defenses"],
  [service.includes("metadataOnly:true"), "metadata-only response contract"],
];

const failed = checks.filter(([ok]) => !ok);
for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (failed.length) process.exit(1);
console.log("PASS P035 feature policy authority grants parity");
