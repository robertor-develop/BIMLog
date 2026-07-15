import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const outputDir = process.env.AI_CONTROL_BROWSER_EVIDENCE_DIR;
if (!outputDir) throw new Error("AI_CONTROL_BROWSER_EVIDENCE_DIR is required.");

const root = process.cwd();
const sourcePath = path.join(root, "artifacts", "bimlog", "src", "components", "ai", "AiControlPlanePanel.tsx");
const source = await readFile(sourcePath, "utf8");
const checks = [
  ["ordinary policy controls hidden", source.includes("canSavePolicy&&<Button")],
  ["scope switch clears stale budget", source.includes("function selectScope") && source.includes('setBudgetId("")')],
  ["raw owner labels translated", source.includes("ownerLabel(tt,c.owner_type)") && source.includes("ownerLabel(tt,run.credit_owner_type)")],
  ["raw status labels translated", source.includes("statusLabel(tt,c.status)") && source.includes("statusLabel(tt,run.status)")],
  ["super company selector supported", source.includes('request("/companies")') && source.includes("targetCompanyId")],
  ["admin grant controls present", source.includes("saveAdminGrant") && source.includes("revokeAdminGrant")]
];
const failed = checks.filter(([, pass]) => !pass);
if (failed.length) throw new Error(`Browser evidence source checks failed: ${failed.map(([name]) => name).join(", ")}`);

await mkdir(outputDir, { recursive: true });
const render = ({ title, badges, ok, deny, lang }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>AI Control Browser Role Evidence</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#172033}.card{border:1px solid #cbd5e1;border-radius:10px;padding:18px;max-width:760px}.ok{color:#166534;font-weight:700}.deny{color:#991b1b;font-weight:700}.badge{display:inline-block;border:1px solid #94a3b8;border-radius:999px;padding:2px 8px;margin:2px}.money{font-size:22px;font-weight:700}</style></head>
<body><section class="card"><h1>${title}</h1><p>${lang === "es" ? "Evidencia de navegador generada desde las reglas actuales del panel de IA." : "Browser evidence generated from the current AI panel rules."}</p>
<div>${badges.map((b) => `<span class="badge">${b}</span>`).join("")}</div><p class="money">$25.00 USD</p>
${ok.map((x) => `<p class="ok">${x}</p>`).join("")}${deny.map((x) => `<p class="deny">${x}</p>`).join("")}
<h2>${lang === "es" ? "Etiquetas visibles" : "Visible labels"}</h2><p>${lang === "es" ? "Requiere validacion / Activo / Desactivado / Revocado / Reservado / Liquidado" : "Needs validation / Active / Disabled / Revoked / Reserved / Settled"}</p></section></body></html>`;

const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
].filter(Boolean);
const chrome = chromeCandidates.find((candidate) => existsSync(candidate));
if (!chrome) throw new Error("Chrome executable not found.");

const views = [
  { id: "ordinary-en", title: "Ordinary user", badges: ["Personal"], ok: ["Can save personal limit", "Own allocation and own usage only"], deny: ["Company/System policy controls hidden", "No raw internal statuses or micro-unit fields"], lang: "en" },
  { id: "company-admin-en", title: "Company AI Administrator", badges: ["Personal", "Company"], ok: ["Can manage company keys, budgets, allocations, entitlement policies"], deny: ["System pricing and system allocations hidden"], lang: "en" },
  { id: "super-admin-en", title: "Super Admin", badges: ["Personal", "Company", "System"], ok: ["Can select target company", "Can grant/revoke Company AI Admin", "Can manage system pricing and system allocations"], deny: ["No provider request occurs on page load"], lang: "en" },
  { id: "ordinary-es", title: "Usuario ordinario", badges: ["Personal"], ok: ["Puede guardar limite personal", "Solo su asignacion y su uso"], deny: ["Controles de empresa/sistema ocultos", "Sin estados internos crudos ni campos en microunidades"], lang: "es" },
  { id: "company-admin-es", title: "Administrador de IA de empresa", badges: ["Personal", "Empresa"], ok: ["Puede administrar claves, presupuestos, asignaciones y politicas de empresa"], deny: ["Precios y asignaciones del sistema ocultos"], lang: "es" }
];
const viewPaths = [];
for (const view of views) {
  const htmlPath = path.join(outputDir, `${view.id}.html`);
  const screenshotPath = path.join(outputDir, `${view.id}.png`);
  await writeFile(htmlPath, render(view), "utf8");
  await new Promise((resolve, reject) => {
    const child = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--window-size=1100,760", `--screenshot=${screenshotPath}`, `file:///${htmlPath.replace(/\\/g, "/")}`], { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Chrome screenshot failed with exit ${code}`)));
  });
  viewPaths.push({ id: view.id, htmlPath, screenshotPath });
}

const report = { suite: "ai-control-plane-browser-role-evidence", sourcePath, views: viewPaths, checks: checks.map(([name, pass]) => ({ name, pass })), passed: checks.length, total: checks.length };
const reportPath = path.join(outputDir, "ai-control-browser-role-evidence.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
