import fs from "node:fs";
const page = fs.readFileSync(new URL("../artifacts/bimlog/src/pages/parity/admin-fix-specific-link.tsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../artifacts/bimlog/src/App.tsx", import.meta.url), "utf8");
const directory = fs.readFileSync(new URL("../artifacts/bimlog/src/lib/capability-directory.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../artifacts/api-server/src/routes/admin.ts", import.meta.url), "utf8");
const checks = [
  [app.includes('/admin/fix-specific-link') && app.includes('surface="total_control"'), "protected direct route"],
  [directory.includes('id: "fix-specific-link"') && directory.includes('href: "/admin/fix-specific-link"'), "discoverable All Tools entry"],
  [page.includes('/api/v1/admin/fix-specific-link') && page.includes('method: "POST"'), "operable repair action"],
  [page.includes('read-only membership') && page.includes('type="checkbox"'), "bounded authority warning and confirmation"],
  [page.includes('Link already exists') && page.includes('Open audit evidence'), "idempotent success and evidence trail"],
  [page.includes('role="alert"') && page.includes('role="status"'), "error and success states"],
  [route.includes('router.post("/admin/fix-specific-link"') && route.includes('if (!req.user?.isSuperAdmin)'), "server Super Admin enforcement"],
  [route.includes('role: "read_only"') && route.includes('action: "fix_specific_link"'), "read-only membership and audit contract"],
];
for (const [ok,label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([ok]) => !ok)) process.exit(1);
console.log("PASS P036 admin fix-specific-link parity");
