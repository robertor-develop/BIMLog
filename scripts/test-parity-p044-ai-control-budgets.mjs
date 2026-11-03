import fs from "node:fs";
const page = fs.readFileSync(
    new URL(
      "../artifacts/bimlog/src/pages/parity/ai-control-budgets.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  app = fs.readFileSync(
    new URL("../artifacts/bimlog/src/App.tsx", import.meta.url),
    "utf8",
  ),
  directory = fs.readFileSync(
    new URL(
      "../artifacts/bimlog/src/lib/capability-directory.ts",
      import.meta.url,
    ),
    "utf8",
  ),
  route = fs.readFileSync(
    new URL(
      "../artifacts/api-server/src/routes/ai-control-plane.ts",
      import.meta.url,
    ),
    "utf8",
  );
const checks = [
  [
    app.includes("/ai-control/budgets") &&
      app.includes("ProtectedRoute component={AiControlBudgets}"),
    "authenticated direct route with server-scoped authorization",
  ],
  [
    directory.includes('id: "ai-control-budgets"'),
    "discoverable All Tools entry",
  ],
  [
    page.includes('request("/ai-control/budgets")') &&
      page.includes('method:"POST"'),
    "list and create workflow",
  ],
  [
    page.includes("/allocations`") &&
      page.includes("userId:Number(userId)") &&
      page.includes("companyId:Number(companyId)"),
    "user allocation workflow",
  ],
  [
    page.includes('personal","company","system') && page.includes("immutable"),
    "funding scopes and evidence guidance",
  ],
  [
    page.includes('role="alert"') &&
      page.includes('role="status"') &&
      page.includes("No budgets are visible"),
    "loading empty failure success states",
  ],
  [
    route.includes('router.get("/ai-control/budgets"') &&
      route.includes('router.post("/ai-control/budgets"') &&
      route.includes('router.post("/ai-control/budgets/:id/allocations"'),
    "server routes preserved",
  ],
  [
    route.includes("CROSS_COMPANY_FORBIDDEN") &&
      route.includes("requireCompanyAdmin") &&
      route.includes("requireSuper"),
    "server authorization and isolation",
  ],
];
for (const [ok, label] of checks)
  console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([ok]) => !ok)) process.exit(1);
console.log("PASS P044 ai-control budgets parity");
