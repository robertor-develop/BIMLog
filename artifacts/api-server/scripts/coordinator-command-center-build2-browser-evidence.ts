import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import express from "express";

if (!process.env.PROD_DATABASE_URL) throw new Error("Load the isolated local test environment first.");
const dbUrl = new URL(process.env.PROD_DATABASE_URL);
if (!['127.0.0.1', 'localhost', '::1'].includes(dbUrl.hostname) || dbUrl.port !== '55432' || dbUrl.pathname.slice(1) !== 'bimlog_rfi_test') throw new Error("Browser evidence requires the isolated loopback database.");
process.env.JWT_SECRET ||= "coordinator-build2-browser-local-only";
const evidenceDir = process.argv[2];
if (!evidenceDir) throw new Error("Evidence directory is required.");
fs.mkdirSync(evidenceDir, { recursive: true });
const repoRoot = path.resolve(import.meta.dirname, "../../..");
const distDir = path.join(repoRoot, "artifacts/bimlog/dist/public");
assert.ok(fs.existsSync(path.join(distDir, "index.html")), "Build the frontend before browser evidence.");

const [{ pool }, { signToken }, { default: routes }] = await Promise.all([
  import("@workspace/db"), import("../src/middlewares/auth"), import("../src/routes"),
]);
const marker = `ccc-browser-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`;
const ids = { company: 0, user: 0, project: 0 };
const company = await pool.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${marker}-company`]); ids.company = company.rows[0].id;
const user = await pool.query<{ id: number; email: string; full_name: string }>("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'proof',$2,$3) RETURNING id,email,full_name", [`${marker}@example.invalid`, marker, ids.company]); ids.user = user.rows[0].id;
const project = await pool.query<{ id: number }>("INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id", [`${marker} Project`, marker, ids.user]); ids.project = project.rows[0].id;
const role = await pool.query<{ value: string }>("SELECT value FROM config_options WHERE category='member_role' AND meta->>'permission' IN ('admin','write','read') ORDER BY id LIMIT 1");
assert.ok(role.rows[0]?.value);
await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active')", [ids.project, ids.user, role.rows[0].value]);
const token = signToken({ userId: ids.user, email: user.rows[0].email, companyId: ids.company, fullName: user.rows[0].full_name, companyName: `${marker}-company` });

type FixtureSavedView = { id: string; projectId: number; name: string; configuration: any; version: number; isDefault: boolean; createdAt: string; updatedAt: string; deleted: boolean };
let savedViews: FixtureSavedView[] = [];
let fixtureMode: "normal" | "partial" = "normal";
let firstRegisterRequest = true;
const fixtureItem = {
  key: "lens:401", sourceModule: "lens", sourceId: 401, projectId: ids.project, displayIdentifier: "ME-01-0042",
  originalStatus: "follow_up", presentationStatus: "follow_up", title: "Resolve current duct routing viewpoint",
  responsibility: { company: "Mechanical Partner", person: null, userId: ids.user }, dueAt: new Date(Date.now() + 86400000).toISOString().slice(0, 10), deadlineState: "due_this_week",
  floor: "Level 01", discipline: "Mechanical", priority: "P2", sourceUpdatedAt: new Date().toISOString(),
  internalLink: `/projects/${ids.project}/clash-reports?view=lens&viewpoint=401`,
  related: { meetings: [{ id: 701, internalLink: `/projects/${ids.project}/meetings?meeting=701` }], schedule: [], lens: { serverId: 401, displayId: "ME-01-0042", viewpointId: "MODEL1-AB12CD", navisworksGuid: "guid-fixture", bimlogPhysicalId: "physical-fixture", lifecycleStatus: "active", revisionNumber: 2, supersedesId: 399, issueGroupId: "group-fixture" } },
};

const app = express(); app.use(express.json({ limit: "64kb" }));
app.post("/evidence-mode/:mode", (req, res) => { fixtureMode = req.params.mode === "partial" ? "partial" : "normal"; res.json({ ok: true }); });
app.use("/api/v1/projects/:projectId/coordinator-actions", async (req, res) => {
  if (firstRegisterRequest) { firstRegisterRequest = false; await new Promise((resolve) => setTimeout(resolve, 2500)); }
  const empty = String(req.query.meetingId ?? "") === "999999";
  const partial = fixtureMode === "partial";
  res.json({
    items: empty ? [] : [fixtureItem], page: 1, pageSize: 25, total: empty ? 0 : 1, totalPages: empty ? 0 : 1,
    counts: { complete: !partial, byModule: { lens: partial ? null : (empty ? 0 : 1), rfi: 0, submittal: 0, meeting: 0, schedule: 0 }, byPresentationStatus: empty ? {} : { follow_up: 1 } },
    sources: [
      { module: "lens", status: partial ? "failed" : "ok", count: partial ? null : (empty ? 0 : 1), code: partial ? "SOURCE_UNAVAILABLE" : "PROJECT_READ" },
      ...(["rfi", "submittal", "meeting", "schedule"] as const).map((module) => ({ module, status: "ok", count: 0, code: "PROJECT_READ" })),
    ], partial, timezone: String(req.query.timezone ?? "UTC"), generatedAt: new Date().toISOString(), builtInView: String(req.query.builtInView ?? "all_actionable"),
    meetingContext: { status: "not_requested", id: null, title: null, meetingAt: null }, readOnly: true, canonicalModulesRemainAuthoritative: true, aiUsed: false,
  });
});
app.get("/api/v1/projects/:projectId/coordinator-saved-views", (_req, res) => res.json({ views: savedViews.filter((view) => !view.deleted), limit: 50 }));
app.post("/api/v1/projects/:projectId/coordinator-saved-views", (req, res) => {
  const now = new Date().toISOString();
  const view: FixtureSavedView = { id: crypto.randomUUID(), projectId: ids.project, name: String(req.body.name), configuration: req.body.configuration, version: 1, isDefault: false, createdAt: now, updatedAt: now, deleted: false };
  savedViews.push(view); res.status(201).json({ view, idempotent: false });
});
app.patch("/api/v1/projects/:projectId/coordinator-saved-views/:id", (req, res) => {
  const view = savedViews.find((entry) => entry.id === req.params.id && !entry.deleted); if (!view) { res.status(404).json({ message: "Not found", messageEs: "No encontrada" }); return; }
  if (req.body.isDefault === true) { savedViews.forEach((entry) => { if (!entry.deleted) entry.isDefault = false; }); view.isDefault = true; }
  if (req.body.name) view.name = String(req.body.name); if (req.body.configuration) view.configuration = req.body.configuration; view.version += 1; view.updatedAt = new Date().toISOString(); res.json({ view, idempotent: false });
});
app.delete("/api/v1/projects/:projectId/coordinator-saved-views/:id", (req, res) => { const view = savedViews.find((entry) => entry.id === req.params.id); if (!view) { res.status(404).json({}); return; } view.deleted = true; view.version += 1; view.isDefault = false; res.json({ view, idempotent: false }); });
app.use("/api/v1", routes);
app.use(express.static(distDir)); app.use((req, res, next) => req.method === "GET" ? res.sendFile(path.join(distDir, "index.html")) : next());
const server = http.createServer(app); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); assert.equal(typeof address, "object"); const baseUrl = `http://127.0.0.1:${address!.port}`;

const chrome = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"].find(fs.existsSync);
assert.ok(chrome, "Chrome not found"); const debugPort = 9400 + Math.floor(Math.random() * 300); const profileDir = path.join(evidenceDir, "chrome-profile");
const chromeProcess = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--remote-debugging-port=${debugPort}`, "--remote-allow-origins=*", `--user-data-dir=${profileDir}`, "about:blank"], { stdio: "ignore", windowsHide: true });
async function waitJson(url: string) { for (let i = 0; i < 80; i++) { try { const response = await fetch(url, { method: url.includes("/json/new") ? "PUT" : "GET" }); if (response.ok) return response.json(); } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error("Chrome endpoint unavailable"); }
const target = await waitJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`) as { webSocketDebuggerUrl: string };
const socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise<void>((resolve, reject) => { socket.addEventListener("open", () => resolve()); socket.addEventListener("error", () => reject(new Error("CDP socket failed"))); });
let commandId = 0; const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>(); const browserErrors: string[] = [];
socket.addEventListener("message", (event) => { const message = JSON.parse(String(event.data)); if (message.id && pending.has(message.id)) { const item = pending.get(message.id)!; pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); } else if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text); });
const cdp = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => { const id = ++commandId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression: string) => (await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
const waitFor = async (expression: string, label: string) => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise((resolve) => setTimeout(resolve, 100)); } const debug = await evaluate("({url:location.href,text:document.body.innerText.slice(0,1200)})"); throw new Error(`Timed out: ${label}: ${JSON.stringify(debug)}`); };
const screenshot = async (name: string) => { const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); fs.writeFileSync(path.join(evidenceDir, name), Buffer.from(shot.data, "base64")); };

try {
  await cdp("Page.enable"); await cdp("Runtime.enable");
  const auth = JSON.stringify({ state: { token, user: { id: ids.user, email: user.rows[0].email, fullName: user.rows[0].full_name, companyId: ids.company, companyName: `${marker}-company` } }, version: 0 });
  await evaluate(`localStorage.setItem('bimlog-auth',${JSON.stringify(auth)});localStorage.setItem('bimlog-lang','en')`);
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${baseUrl}/projects/${ids.project}/command-center` });
  await waitFor("document.body.innerText.includes('Loading authorized project actions')", "loading state"); await screenshot("desktop-en-loading.png");
  await waitFor("document.body.innerText.includes('Resolve current duct routing viewpoint')", "populated command center");
  await evaluate(`window.prompt=()=>${JSON.stringify("My Daily View")};[...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Save')?.click()`);
  await waitFor("[...document.querySelectorAll('option')].some(o=>o.textContent?.includes('My Daily View'))", "saved view created");
  await evaluate("[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.textContent?.includes('My Daily View'))).value=[...document.querySelectorAll('option')].find(o=>o.textContent?.includes('My Daily View')).value;[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.textContent?.includes('My Daily View'))).dispatchEvent(new Event('change',{bubbles:true}))");
  await evaluate("document.querySelector('button[title=\"Make my default\"]')?.click()");
  await waitFor("[...document.querySelectorAll('option')].some(o=>o.textContent?.includes('★ My Daily View'))", "personal default set");
  await screenshot("desktop-en-saved-default.png");
  await evaluate("(()=>{const i=[...document.querySelectorAll('input')].find(x=>x.placeholder==='Exact meeting ID');const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;s.call(i,'999999');i.dispatchEvent(new Event('input',{bubbles:true}))})()");
  await waitFor("document.body.innerText.includes('No actions match these filters')", "honest empty state");
  assert.ok(String(await evaluate("location.search")).includes("ccMeeting=999999")); await screenshot("desktop-en-honest-empty.png");
  await evaluate("fetch('/evidence-mode/partial',{method:'POST'}).then(()=>[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Clear all'))?.click())");
  await waitFor("document.body.innerText.includes('Some authoritative sources are unavailable')", "partial source state"); await screenshot("desktop-en-partial.png");

  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("localStorage.setItem('bimlog-lang','es');fetch('/evidence-mode/normal',{method:'POST'})"); await cdp("Page.reload", { ignoreCache: true });
  await waitFor("document.body.innerText.includes('Centro de Control de Coordinación') && document.body.innerText.includes('Vista personal guardada') && document.body.innerText.includes('Resolve current duct routing viewpoint')", "Spanish mobile populated command center");
  const overflow = await evaluate("document.documentElement.scrollWidth>innerWidth||document.body.scrollWidth>innerWidth||document.querySelector('.ccc-shell').scrollWidth>document.querySelector('.ccc-shell').clientWidth");
  assert.equal(overflow, false); await screenshot("mobile-390-es.png");
  await evaluate("document.querySelector('.ccc-mobile-list')?.scrollIntoView({block:'start'})"); await screenshot("mobile-390-es-populated-card.png");
  assert.deepEqual(browserErrors, []);
  const report = { suite: "coordinator-command-center-build2-browser", productionComponent: "CoordinatorCommandCenter", fixtureBoundary: "Only local API responses were fixture-controlled; the built production component and real browser were used.", desktop: { width: 1366, language: "en", states: ["loading", "populated", "saved-default", "honest-empty", "partial"] }, mobile: { width: 390, language: "es", horizontalOverflow: false }, savedViewPersistedAcrossApi: savedViews.some((view) => view.name === "My Daily View" && view.isDefault), browserErrors };
  fs.writeFileSync(path.join(evidenceDir, "browser-proof.json"), `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report, null, 2));
} finally {
  socket.close(); chromeProcess.kill(); server.close();
  await pool.query("DELETE FROM project_members WHERE project_id=$1", [ids.project]); await pool.query("DELETE FROM projects WHERE id=$1", [ids.project]); await pool.query("DELETE FROM users WHERE id=$1", [ids.user]); await pool.query("DELETE FROM companies WHERE id=$1", [ids.company]); await pool.end();
}
