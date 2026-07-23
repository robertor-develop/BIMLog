import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import express from "express";

const evidenceDir = process.argv[2];
if (!evidenceDir) throw new Error("Evidence directory is required.");
fs.mkdirSync(evidenceDir, { recursive: true });
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const distDir = path.join(repoRoot, "artifacts/bimlog/dist/public");
assert.ok(fs.existsSync(path.join(distDir, "index.html")), "Build the frontend before browser evidence.");

const marker = `ccc-build4-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
const projectId = 4404;
const token = `local-browser-token-${marker}`;
const browserErrors: string[] = [];
const failedRequests: string[] = [];
const fixtureHits: string[] = [];

const insightFixture = {
  generatedAt: new Date().toISOString(),
  projectId,
  title: { en: "Project Insights & Reports", es: "Perspectivas e Informes del Proyecto" },
  metricAuthority: {
    source: "coordinator-action-register",
    timezone: "America/New_York",
    partial: false,
    definitions: [
      { key: "actionable", definition: "Current actionable records after authorization and filters." },
      { key: "overdue", definition: "Canonical due date before the viewer date boundary." },
      { key: "dueSoon", definition: "Canonical due date today through seven calendar days." },
      { key: "blocked", definition: "Blocked/action-required presentation status." },
    ],
    sources: [
      { module: "lens", status: "ok", count: 2 },
      { module: "rfi", status: "ok", count: 4 },
      { module: "submittal", status: "ok", count: 3 },
      { module: "meeting", status: "ok", count: 1 },
      { module: "schedule", status: "ok", count: 2 },
    ],
  },
  operationalContext: {
    actionable: 12,
    overdue: 3,
    dueSoon: 4,
    blocked: 2,
    links: {
      actionable: `/projects/${projectId}/command-center?ccBuiltIn=all_actionable`,
      overdue: `/projects/${projectId}/command-center?ccBuiltIn=overdue`,
      dueSoon: `/projects/${projectId}/command-center?ccDeadline=due_this_week`,
      blocked: `/projects/${projectId}/command-center?ccPresentation=action_required`,
    },
  },
  compliance: {
    totalFiles: 25,
    validFiles: 21,
    rejectedFiles: 4,
    complianceRate: 84,
    unavailable: false,
    companies: [
      { company: "Mechanical Partner", rejected: 3 },
      { company: "Electrical Partner", rejected: 1 },
    ],
    links: { source: `/projects/${projectId}/files`, report: `/projects/${projectId}/reports?report=naming-compliance` },
  },
  rfiPerformance: {
    total: 10,
    byStatus: { open: 4, in_review: 2, responded: 1, closed: 3 },
    open: 7,
    agingOver7Days: 2,
    averageOpenAgeDays: 6,
    links: { open: `/projects/${projectId}/command-center?ccModules=rfi`, aging: `/projects/${projectId}/command-center?ccModules=rfi&ccBuiltIn=overdue`, report: `/projects/${projectId}/reports?report=rfi-aging` },
  },
  team: { members: 5, companies: 3, link: `/projects/${projectId}/team` },
  unavailable: [
    { key: "historical_trends", reason: "No authoritative retained history table exists yet for trend-over-time analytics.", reasonEs: "Todavía no existe una tabla histórica autorizada para tendencias en el tiempo." },
    { key: "schedule_forecast_causes", reason: "Schedule forecasting/causal analytics are unavailable until authoritative history and forecasting rules are accepted.", reasonEs: "El pronóstico y las causas del cronograma no están disponibles hasta aceptar historial y reglas de pronóstico autorizadas." },
  ],
  removedFromInsights: ["recent_activity", "recent_files", "operational_task_lists", "schedule_placeholder"],
  linksGrantAuthority: false,
  aiUsed: false,
};

const app = express();
app.use(express.json({ limit: "64kb" }));
app.use((req, _res, next) => {
  if (req.path.startsWith("/api/v1/")) fixtureHits.push(`${req.method} ${req.path}`);
  next();
});
app.get("/api/v1/config", (_req, res) => res.json({
  member_role: [
    { value: "project_admin", label: "Project Admin", labelEs: "Administrador del Proyecto", meta: { permission: "admin" } },
    { value: "viewer", label: "Viewer", labelEs: "Lector", meta: { permission: "read" } },
  ],
}));
app.get("/api/v1/auth/me", (_req, res) => res.json({ id: 9001, email: "build4@example.invalid", fullName: "Build Four", companyId: 7001, companyName: "BIMLog Local", isSuperAdmin: false }));
app.get("/api/v1/users/me", (_req, res) => res.json({ id: 9001, email: "build4@example.invalid", fullName: "Build Four", companyId: 7001, companyName: "BIMLog Local", isSuperAdmin: false }));
app.get("/api/v1/users/me/company-profile", (_req, res) => res.json({ company: { id: 7001, name: "BIMLog Local" }, profile: null }));
app.get("/api/v1/living-brief/eligibility", (_req, res) => res.json({ eligible: false, reason: "not_required_for_local_browser_evidence" }));
app.get("/api/v1/projects/:id", (req, res) => res.json({ id: Number(req.params.id), code: "CCC4", name: "Coordinator Build 4 Fixture", description: "Local browser evidence project", status: "active" }));
app.get("/api/v1/projects/:id/members", (req, res) => res.json([
  { id: 1, projectId: Number(req.params.id), userId: 9001, role: "project_admin", status: "active", userFullName: "Build Four", userEmail: "build4@example.invalid", userCompanyName: "BIMLog Local" },
]));
app.get("/api/v1/projects/:id/project-insights", (_req, res) => res.json(insightFixture));
app.use(express.static(distDir));
app.use((req, res, next) => req.method === "GET" ? res.sendFile(path.join(distDir, "index.html")) : next());

const server = http.createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.equal(typeof address, "object");
const baseUrl = `http://127.0.0.1:${address!.port}`;

const chrome = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"].find(fs.existsSync);
assert.ok(chrome, "Chrome not found");
const debugPort = 9700 + Math.floor(Math.random() * 300);
const profileDir = path.join(evidenceDir, "chrome-profile");
const chromeProcess = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--remote-debugging-port=${debugPort}`, "--remote-allow-origins=*", `--user-data-dir=${profileDir}`, "about:blank"], { stdio: "ignore", windowsHide: true });

async function waitJson(url: string) {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(url, { method: url.includes("/json/new") ? "PUT" : "GET" });
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome endpoint unavailable");
}

const target = await waitJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`) as { webSocketDebuggerUrl: string };
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise<void>((resolve, reject) => {
  socket.addEventListener("open", () => resolve());
  socket.addEventListener("error", () => reject(new Error("CDP socket failed")));
});
let commandId = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) {
    const item = pending.get(message.id)!;
    pending.delete(message.id);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") {
    browserErrors.push(message.params.exceptionDetails.text);
  } else if (message.method === "Log.entryAdded" && message.params?.entry?.level === "error") {
    browserErrors.push(message.params.entry.text);
  } else if (message.method === "Network.loadingFailed") {
    failedRequests.push(String(message.params?.errorText ?? "request_failed"));
  }
});
const cdp = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => {
  const id = ++commandId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression: string) => (await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
const waitFor = async (expression: string, label: string) => {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const debug = await evaluate("({lang:document.documentElement.lang,url:location.href,text:document.body.innerText.slice(0,1200)})");
  throw new Error(`Timed out: ${label}: ${JSON.stringify(debug)}`);
};
const screenshot = async (name: string) => {
  const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  fs.writeFileSync(path.join(evidenceDir, name), Buffer.from(shot.data, "base64"));
};

try {
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Network.enable");
  await cdp("Log.enable");
  const auth = JSON.stringify({ state: { token, user: { id: 9001, email: "build4@example.invalid", fullName: "Build Four", companyId: 7001, companyName: "BIMLog Local" } }, version: 0 });
  await evaluate(`localStorage.setItem('bimlog-auth',${JSON.stringify(auth)});localStorage.setItem('bimlog-lang','en')`);
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${baseUrl}/projects/${projectId}/analytics` });
  await waitFor("document.body.innerText.includes('Project Insights & Reports') && document.body.innerText.includes('Actionable')", "English insights loaded");
  const desktop = await evaluate(`(() => {
    const text = document.body.innerText;
    return {
      title: text.includes('Project Insights & Reports'),
      commandLinks: [...document.querySelectorAll('button')].filter((button)=>button.textContent?.includes('Open RFI actions')||button.textContent?.includes('Act in Command Center')).length,
      removedActivity: !text.includes('Recent activity'),
      removedFiles: !text.includes('Recent files'),
      removedSchedulePlaceholder: !text.includes('Schedule delay attribution') && !text.includes('MS Project'),
      unavailable: text.includes('Unavailable analytics') && text.includes('No authoritative retained history table exists'),
      overflow: document.documentElement.scrollWidth > innerWidth
    };
  })()`);
  assert.equal(desktop.title, true);
  assert.ok(desktop.commandLinks >= 2);
  assert.equal(desktop.removedActivity, true);
  assert.equal(desktop.removedFiles, true);
  assert.equal(desktop.removedSchedulePlaceholder, true);
  assert.equal(desktop.unavailable, true);
  assert.equal(desktop.overflow, false);
  await screenshot("desktop-en-project-insights.png");

  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(`localStorage.setItem('bimlog-lang','es'); location.href=${JSON.stringify(`${baseUrl}/projects/${projectId}/analytics`)}`);
  await waitFor("document.body.innerText.includes('Perspectivas e Informes') && /accionables/i.test(document.body.innerText)", "Spanish mobile insights loaded");
  const mobile = await evaluate(`(() => {
    const text = document.body.innerText;
    return {
      title: text.includes('Perspectivas e Informes'),
      commandBoundary: text.includes('Centro de Control'),
      removedActivity: !text.includes('Actividad reciente') && !text.includes('Recent activity'),
      removedFiles: !text.includes('Archivos recientes') && !text.includes('Recent files'),
      unavailable: text.includes('Analítica no disponible') || text.includes('Analitica no disponible'),
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth
    };
  })()`);
  assert.equal(mobile.title, true);
  assert.equal(mobile.commandBoundary, true);
  assert.equal(mobile.removedActivity, true);
  assert.equal(mobile.removedFiles, true);
  assert.equal(mobile.unavailable, true);
  assert.equal(mobile.width, 390);
  assert.equal(mobile.overflow, false);
  await screenshot("mobile-es-390-project-insights.png");

  assert.deepEqual(browserErrors, []);
  assert.deepEqual(failedRequests, []);
  assert.ok(fixtureHits.some((hit) => hit.includes("/project-insights")));
  const report = {
    suite: "coordinator-command-center-build4-browser",
    fixtureBoundary: "Built BIMLog frontend, local fixture API, real Chrome/CDP; no production or customer data.",
    desktop,
    mobile,
    fixtureHits,
    browserErrors,
    failedRequests,
    screenshots: ["desktop-en-project-insights.png", "mobile-es-390-project-insights.png"],
  };
  fs.writeFileSync(path.join(evidenceDir, "browser-proof.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket.close();
  chromeProcess.kill();
  server.close();
}
