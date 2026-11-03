import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const behavior = readFileSync("artifacts/api-server/src/routes/support-case-satisfaction.behavior.ts", "utf8");
const route = readFileSync("artifacts/api-server/src/routes/support-case-satisfaction.ts", "utf8");
const customer = readFileSync("artifacts/bimlog/src/components/commercial/SupportSatisfaction.tsx", "utf8");
const panel = readFileSync("artifacts/bimlog/src/components/commercial/SupportCasesPanel.tsx", "utf8");
const admin = readFileSync("artifacts/bimlog/src/components/admin/SupportSatisfactionSummary.tsx", "utf8");
const quality = readFileSync("artifacts/bimlog/src/components/admin/SupportQualitySummary.tsx", "utf8");

assert.ok(behavior.includes('satisfactionPath=["/support/cases/",":id","/satisfaction"].join("")'), "the frozen template identity must remain traceable to test construction");
assert.doesNotMatch(route, /\$\{satisfactionPath\}/, "the test template must not exist as a production route");
for (const contract of [
  'router.get("/support/cases/:id/satisfaction",authMiddleware',
  'router.post("/support/cases/:id/satisfaction",authMiddleware',
  'router.get("/admin/support/cases/:id/satisfaction",authMiddleware,isSuperAdminMiddleware',
  'router.get("/admin/support/satisfaction-summary",authMiddleware,isSuperAdminMiddleware',
  "companyId", "requesterUserId", 'supportCase.status!=="closed"', "SUPPORT_CASE_NOT_CLOSED",
  "SUPPORT_CASE_SATISFACTION_CONFLICT", 'for("update")', "notificationsTable", 'private, no-store',
]) assert.ok(route.includes(contract), `${contract} must remain in satisfaction authority`);

for (const visible of [
  "How was the support you received?", "¿Cómo fue el soporte que recibió?",
  "Submit rating", "Enviar calificación", "Thank you. Your rating was recorded.", "Gracias. Se registró su calificación.",
  'role="status"', 'role="alert"', "Try again", "Intentar de nuevo",
]) assert.ok(customer.includes(visible), `${visible} must remain visible to the customer`);
assert.match(panel, /item\.status==="closed"&&<>\s*<SupportSatisfaction/);
for (const visible of ["Customer rating", "Calificación del cliente", "has not rated", "todavía no calificó"]) assert.ok(admin.includes(visible), `${visible} must remain visible to administrators`);
for (const visible of ["Service quality", "Calidad del servicio", "Rating distribution", "Distribución de calificaciones"]) assert.ok(quality.includes(visible), `${visible} must remain visible in aggregate service quality`);

const tsx = path.resolve("artifacts/api-server/node_modules/tsx/dist/cli.mjs");
for (const fixture of [
  "artifacts/api-server/src/lib/support-case-satisfaction.behavior.ts",
  "artifacts/api-server/src/lib/support-case-satisfaction-schema.behavior.ts",
  "artifacts/api-server/src/routes/support-case-satisfaction.behavior.ts",
  "artifacts/bimlog/src/lib/support-case-satisfaction-client.behavior.ts",
  "artifacts/bimlog/src/components/commercial/support-satisfaction.behavior.ts",
  "artifacts/bimlog/src/components/admin/support-satisfaction-visibility.behavior.ts",
  "artifacts/bimlog/src/lib/support-satisfaction-summary-client.behavior.ts",
]) execFileSync(process.execPath, [tsx, path.resolve(fixture)], { stdio: "inherit", windowsHide: true });

console.log("P209 template false-positive adjudication plus real closed-case customer/admin satisfaction, tenant/requester isolation, one-time persistence, notification, aggregate quality, bilingual accessibility, and retry gates passed.");
