import fs from "node:fs";

const page = fs.readFileSync(new URL("../artifacts/bimlog/src/pages/parity/autodesk-token.tsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../artifacts/bimlog/src/App.tsx", import.meta.url), "utf8");
const directory = fs.readFileSync(new URL("../artifacts/bimlog/src/lib/capability-directory.ts", import.meta.url), "utf8");
const route = fs.readFileSync(new URL("../artifacts/api-server/src/routes/autodesk.ts", import.meta.url), "utf8");

const checks = [
  [app.includes('path="/autodesk/token"') && app.includes("ProtectedRoute component={AutodeskToken}"), "authenticated frontend route"],
  [directory.includes('id: "autodesk-token"') && directory.includes('href: "/autodesk/token"'), "discoverable All Tools entry"],
  [route.includes('router.get("/autodesk/token", authMiddleware'), "backend token route requires BIMLog authentication"],
  [route.includes('grant_type: "client_credentials"') && route.includes("APS_CLIENT_ID") && route.includes("APS_CLIENT_SECRET"), "server retains provider credential custody"],
  [page.includes("/api/v1/autodesk/token") && page.includes("Authorization: `Bearer ${token}`"), "explicit authenticated service verification"],
  [page.includes('typeof body.access_token !== "string"') && !page.includes("setAccessToken") && !page.includes("localStorage"), "token is validated but never displayed or stored"],
  [page.includes('role="status"') && page.includes('role="alert"') && page.includes("Retry"), "loading success unavailable and retry states"],
  [page.includes("Provider configuration remains restricted") && page.includes("Provider governance"), "actor prerequisite and next-step guidance"],
  [page.includes("Servicio de token de Autodesk") && page.includes("Verificar servicio de token"), "Spanish comprehension path"],
];

for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([ok]) => !ok)) process.exit(1);
console.log("PASS P061 Autodesk token parity");
