import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const evidenceDir = process.env.FINANCIAL_BROWSER_EVIDENCE_DIR;
const playwrightModule = process.env.BIMLOG_PLAYWRIGHT_MODULE;
const fixtureOnly = process.env.BIMLOG_VISIBLE_FIXTURE_ONLY === "1";
const spanishOnly = process.env.BIMLOG_BROWSER_SPANISH_ONLY === "1";
if (!evidenceDir || (!fixtureOnly && !playwrightModule)) throw new Error("Evidence and installed Playwright module paths are required.");
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const publicDir = path.join(repoRoot, "artifacts/bimlog/dist/public");
assert.ok(fs.existsSync(path.join(publicDir, "index.html")), "The accepted production frontend build is required.");
fs.mkdirSync(evidenceDir, { recursive: true });

const user = { id: 71, fullName: "Internal Finance Preparer", companyId: 31, companyName: "Disposable Company", isSuperAdmin: false };
const credential = crypto.randomUUID();
const contracts = [
  { id: "contract-review", bimlogId: "BIMLOG-CON-review", legalNumber: "SC-2026-001", title: "Controlled Trade Contract", counterpartyName: "Sanitized Trade", perspective: "downstream", contractType: "subcontract", versionId: "version-review", version: 1, status: "under_review", currency: "USD", originalValue: "125000.250001", executedAmendmentTotal: "0", currentCommitment: "125000.250001", contentFingerprint: "a".repeat(64), revision: 3 },
  { id: "contract-execution", bimlogId: "BIMLOG-CON-execution", legalNumber: "PO-2026-002", title: "Approved Purchase Order", counterpartyName: "Sanitized Supplier", perspective: "downstream", contractType: "purchase_order", versionId: "version-execution", version: 1, status: "approved", currency: "USD", originalValue: "25000.000001", executedAmendmentTotal: "-0.000001", currentCommitment: "25000", contentFingerprint: "b".repeat(64), revision: 4 },
];
const snapshot = { id: "snapshot-browser", budgetVersion: 1, currency: "USD", currentTotal: "200000.250001", lines: [{ id: "budget-line-browser", project_cost_node_id: "node-browser", project_code: "01", description: "Approved exact allocation", amount: "200000.250001" }] };
const workspace = { snapshots: [snapshot], structures: [], nodes: [], budgets: [], boundary: { en: "Operational approved budgets only.", es: "Solo presupuestos operativos aprobados." }, snapshot };
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };
const authState = JSON.stringify({ state: { token: credential, user }, version: 0 });
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/api/v1/auth/me") return void response.end(JSON.stringify({ ...user, company: { name: user.companyName }, notificationPreferences: {} }));
    if (url.pathname === "/api/v1/projects/91/financial/contracts" && request.method === "GET") return void response.end(JSON.stringify({ contracts, totals: { executedCommitments: "150000.250002", currencies: ["USD"] } }));
    if (url.pathname === "/api/v1/projects/91/financial/workspace") return void response.end(JSON.stringify(workspace));
    if (url.pathname === "/api/v1/projects/91/financial/snapshots/snapshot-browser") return void response.end(JSON.stringify(workspace));
    if (url.pathname === "/api/v1/notifications/unread-count") return void response.end('{"count":0}');
    if (url.pathname === "/api/v1/notifications") return void response.end("[]");
    if (url.pathname.startsWith("/api/v1/")) { response.setHeader("content-type", "application/json"); return void response.end("{}"); }
    const wanted = decodeURIComponent(url.pathname).replace(/^\/+/, ""); let file = path.resolve(publicDir, wanted || "index.html");
    if (!file.startsWith(publicDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(publicDir, "index.html");
    let body = fs.readFileSync(file); if (path.basename(file) === "index.html") { const language = url.searchParams.get("lang") === "es" ? "es" : "en"; body = Buffer.from(body.toString("utf8").replace("</head>", `<script>localStorage.setItem('bimlog-auth',${JSON.stringify(authState)});localStorage.setItem('bimlog-lang','${language}');addEventListener('load',()=>{const timer=setInterval(()=>{const button=[...document.querySelectorAll('button')].find((item)=>/New contract|Nuevo contrato/.test(item.textContent||''));if(button){button.click();clearInterval(timer)}},100)})</script></head>`)); }
    response.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" }); response.end(body);
  } catch (error) { response.statusCode = 500; response.end(error instanceof Error ? error.message : "fixture failure"); }
});
await new Promise((resolve) => server.listen(fixtureOnly ? 3138 : 0, "127.0.0.1", resolve));
const address = server.address(); assert.equal(typeof address, "object"); const origin = `http://127.0.0.1:${address.port}`;
if (fixtureOnly) { console.log(origin); await new Promise((resolve) => { process.once("SIGTERM", resolve); process.once("SIGINT", resolve); }); server.closeAllConnections?.(); await new Promise((resolve) => server.close(resolve)); process.exit(0); }
const { chromium } = await import(pathToFileURL(playwrightModule).href);
const chrome = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"].find(fs.existsSync);
assert.ok(chrome, "Installed Chrome executable not found.");
const browser = await chromium.launch({ executablePath: chrome, headless: true, timeout: 15000 });
const runtimeErrors = [], failedRequests = [], failedApi = [];
const observe = (page) => {
  page.on("pageerror", (error) => runtimeErrors.push(String(error)));
  page.on("console", (message) => { if (message.type() === "error") runtimeErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push(`${request.method()} ${new URL(request.url()).pathname}`));
  page.on("response", (result) => { const url = new URL(result.url()); if (url.origin === origin && url.pathname.startsWith("/api/") && result.status() >= 400) failedApi.push(`${result.status()} ${url.pathname}`); });
};
let dialogMessage = "";
const results = { suite: "cost-financial-control-build-3-browser", transport: "Playwright direct browser pipe", desktop: spanishOnly ? { status: "accepted-prior-evidence", screenshot: "financial-contract-desktop-en.png" } : {}, mobile: {}, runtimeErrors, failedRequests, failedApi, screenshots: ["financial-contract-desktop-en.png", "financial-contract-mobile-es-390.png"] };
try {
  if (!spanishOnly) {
    const desktopContext = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "en-US" });
    await desktopContext.addInitScript(() => localStorage.setItem("bimlog-lang", "en")); const desktop = await desktopContext.newPage(); observe(desktop);
    await desktop.goto(`${origin}/projects/91/financial/contracts`, { waitUntil: "networkidle", timeout: 15000 }); await desktop.getByRole("heading", { name: "Contracts & Commitments" }).waitFor({ timeout: 8000 });
    const createPanel = desktop.getByRole("heading", { name: "Controlled contract draft" });
    if (await createPanel.count() === 0) await desktop.getByRole("button", { name: "New contract" }).click();
    await createPanel.waitFor();
    desktop.once("dialog", async (dialog) => { dialogMessage = dialog.message(); await dialog.accept("Controlled over-budget variance reason"); }); await desktop.getByRole("button", { name: "Confirm exact approval" }).click(); await desktop.waitForTimeout(300);
    const desktopText = await desktop.locator("body").innerText();
    results.desktop = { width: await desktop.evaluate(() => innerWidth), language: await desktop.evaluate(() => document.documentElement.lang), contracts: desktopText.includes("Contracts & Commitments"), sov: desktopText.includes("Schedule of Values"), approval: desktopText.includes("Confirm exact approval"), execution: desktopText.includes("Attest signed execution"), exactDecimal: desktopText.includes("125000.250001 USD"), boundary: desktopText.includes("Approval is separate from signed-document execution"), overBudgetReasonPrompt: /exceeds budget or aggregate limits/i.test(dialogMessage), importPreviewConfirm: /import/i.test(desktopText) && /preview/i.test(desktopText) && /confirm/i.test(desktopText), amendmentWorkflow: /new amendment|amendment workflow/i.test(desktopText), horizontalOverflow: await desktop.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth) };
    await desktop.screenshot({ path: path.join(evidenceDir, "financial-contract-desktop-en.png"), fullPage: true }); await desktopContext.close();
  }

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, locale: "es" });
  await mobileContext.addInitScript(() => localStorage.setItem("bimlog-lang", "es")); const mobile = await mobileContext.newPage(); observe(mobile);
  await mobile.goto(`${origin}/projects/91/financial/contracts?lang=es`, { waitUntil: "networkidle", timeout: 15000 }); await mobile.getByRole("heading", { name: "Contratos y Compromisos" }).waitFor({ timeout: 8000 }); const mobileText = await mobile.locator("body").innerText();
  results.mobile = { width: await mobile.evaluate(() => innerWidth), language: await mobile.evaluate(() => document.documentElement.lang), contracts: mobileText.includes("Contratos y Compromisos"), commitment: mobileText.includes("Compromiso ejecutado"), approval: /Confirmar aprobaci.n exacta/.test(mobileText), execution: /Atestar ejecuci.n firmada/.test(mobileText), exactDecimal: mobileText.includes("125000.250001 USD"), horizontalOverflow: await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth) };
  await mobile.screenshot({ path: path.join(evidenceDir, "financial-contract-mobile-es-390.png"), fullPage: true }); await mobileContext.close();
  const passObject = (value) => Object.entries(value).every(([key, item]) => key === "horizontalOverflow" ? item === false : key === "width" ? item === 1366 || item === 390 : Boolean(item));
  results.status = (spanishOnly || passObject(results.desktop)) && passObject(results.mobile) && runtimeErrors.length === 0 && failedRequests.length === 0 && failedApi.length === 0 ? "passed" : "failed";
  fs.writeFileSync(path.join(evidenceDir, "financial-contract-browser.json"), `${JSON.stringify(results, null, 2)}\n`); console.log(JSON.stringify(results, null, 2));
  if (results.status !== "passed") throw new Error("Finance Build 3 browser acceptance did not satisfy every required UI state.");
} finally { await browser.close(); server.closeAllConnections?.(); await new Promise((resolve) => server.close(resolve)); }
