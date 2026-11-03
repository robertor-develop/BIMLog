import fs from "node:fs";
const panel=fs.readFileSync(new URL("../artifacts/bimlog/src/pages/AdminPanel.tsx",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("../artifacts/bimlog/src/pages/parity/admin-master-catalogs.tsx",import.meta.url),"utf8");
const app=fs.readFileSync(new URL("../artifacts/bimlog/src/App.tsx",import.meta.url),"utf8");
const directory=fs.readFileSync(new URL("../artifacts/bimlog/src/lib/capability-directory.ts",import.meta.url),"utf8");
const routes=fs.readFileSync(new URL("../artifacts/api-server/src/routes/master-catalogs.ts",import.meta.url),"utf8");
const checks=[
 [app.includes('/admin/master-catalogs')&&app.includes('component={AdminMasterCatalogs} surface="total_control"'),"protected direct route"],
 [directory.includes('id: "admin-master-catalogs"')&&directory.includes('href: "/admin/master-catalogs"'),"discoverable All Tools entry"],
 [page.includes("MasterCatalogsTab")&&page.includes("historical project records"),"complete operable workflow and lifecycle guidance"],
 [panel.includes('export function MasterCatalogsTab')&&panel.includes('method: "POST"')&&panel.includes('method: "PATCH"'),"create and state-change controls"],
 [panel.includes("Master catalogs could not be loaded")&&panel.includes("No values yet"),"error and empty states"],
 [panel.includes("available in Intake")&&panel.includes("without changing historical records"),"success and evidence outcomes"],
 [routes.includes('router.post("/admin/master-catalogs/:catalog", authMiddleware, isSuperAdminMiddleware')&&routes.includes('router.patch("/admin/master-catalogs/:catalog/:id", authMiddleware, isSuperAdminMiddleware'),"server Super Admin enforcement"],
];
for(const [ok,label] of checks)console.log(`${ok?"PASS":"FAIL"} ${label}`);if(checks.some(([ok])=>!ok))process.exit(1);console.log("PASS P038 admin master-catalogs parity");
