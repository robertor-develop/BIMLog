import fs from "node:fs";
const panel=fs.readFileSync(new URL("../artifacts/bimlog/src/pages/AdminPanel.tsx",import.meta.url),"utf8");
const page=fs.readFileSync(new URL("../artifacts/bimlog/src/pages/parity/admin-overview.tsx",import.meta.url),"utf8");
const app=fs.readFileSync(new URL("../artifacts/bimlog/src/App.tsx",import.meta.url),"utf8");
const directory=fs.readFileSync(new URL("../artifacts/bimlog/src/lib/capability-directory.ts",import.meta.url),"utf8");
const routes=fs.readFileSync(new URL("../artifacts/api-server/src/routes/admin.ts",import.meta.url),"utf8");
const checks=[
 [app.includes('/admin/overview')&&app.includes('component={AdminOverview} surface="project_administration"'),"project-administration protected direct route"],
 [directory.includes('id: "admin-overview"')&&directory.includes('href: "/admin/overview"'),"discoverable All Tools entry"],
 [page.includes("OverviewTab")&&page.includes("Operational summary"),"complete summary and lifecycle guidance"],
 [panel.includes('export function OverviewTab')&&panel.includes('/admin/overview?scope=mine'),"scoped operational data"],
 [panel.includes("No activity yet")&&panel.includes("Project Activity Feed"),"empty and evidence states"],
 [routes.includes('router.get("/admin/overview"')&&routes.includes('scope === "mine"'),"backend scoped overview"],
];
for(const [ok,label] of checks)console.log(`${ok?"PASS":"FAIL"} ${label}`);if(checks.some(([ok])=>!ok))process.exit(1);console.log("PASS P039 admin overview parity");
