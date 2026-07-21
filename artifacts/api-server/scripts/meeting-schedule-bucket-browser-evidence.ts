import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import express from "express";

if (!process.env.PROD_DATABASE_URL) throw new Error("Load the isolated local test environment before running this evidence script.");
process.env.JWT_SECRET ||= "meeting-schedule-bucket-browser-evidence-secret";
const evidenceDir = process.argv[2]; if (!evidenceDir) throw new Error("Evidence directory is required.");
fs.mkdirSync(evidenceDir, { recursive: true });
const distDir = path.resolve("../bimlog/dist/public");
assert.ok(fs.existsSync(path.join(distDir, "index.html")), "Build the BIMLog web app before browser evidence.");

const [{ pool }, { signToken }, { default: app }] = await Promise.all([
  import("@workspace/db"), import("../src/middlewares/auth"), import("../src/app"),
]);
app.use(express.static(distDir));
app.use((req, res, next) => req.method === "GET" ? res.sendFile(path.join(distDir, "index.html")) : next());
const server = http.createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); assert.equal(typeof address, "object"); const baseUrl = `http://127.0.0.1:${address!.port}`;
const marker = `meeting-m4-browser-${Date.now()}`;
const ids: { company?: number; users: number[]; projects: number[]; meetings: number[]; submittals: number[] } = { users: [], projects: [], meetings: [], submittals: [] };
const api = async (pathname: string, token: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers); headers.set("Content-Type", "application/json"); headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${baseUrl}/api/v1${pathname}`, { ...init, headers }); const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
};

const company = await pool.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${marker}-company`]); ids.company = company.rows[0].id;
const user = await pool.query<{ id: number; email: string; full_name: string }>("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'proof',$2,$3) RETURNING id,email,full_name", [`${marker}@example.invalid`, marker, ids.company]); ids.users.push(user.rows[0].id);
const assignee = await pool.query<{ id: number; email: string; full_name: string }>("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'proof',$2,$3) RETURNING id,email,full_name", [`${marker}-assignee@example.invalid`, `${marker}-assignee`, ids.company]); ids.users.push(assignee.rows[0].id);
const project = await pool.query<{ id: number }>("INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id", [`${marker} Project`, marker, user.rows[0].id]); ids.projects.push(project.rows[0].id);
const role = await pool.query<{ value: string }>("SELECT value FROM config_options WHERE category='member_role' AND meta->>'permission' IN ('admin','write') LIMIT 1"); assert.ok(role.rows[0]?.value);
await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active'),($1,$4,$3,'active')", [project.rows[0].id, user.rows[0].id, role.rows[0].value, assignee.rows[0].id]);
const submittals = await pool.query<{ id: number }>(`INSERT INTO submittals(project_id,number,title,description,status,submittal_type,submitted_by_id,floor,trade,responsible_company,date_required)
  VALUES($1,$2,'Pump package','Domestic water pump coordination','under_review','shop_drawing',$3,'Level 1','Plumbing','Aqua Contractors','2026-08-15'),
        ($1,$4,'Panel schedules','Emergency distribution panel package','submitted','shop_drawing',$3,'Level 2','Electrical','Volt LLC','2026-08-20')
  RETURNING id`, [project.rows[0].id, `${marker}-001`, user.rows[0].id, `${marker}-002`]);
ids.submittals.push(...submittals.rows.map(row => row.id));
const meeting = await pool.query<{ id: number }>("INSERT INTO meeting_minutes(project_id,title,meeting_date,created_by_id,notes) VALUES($1,'M4 Browser Coordination','2026-07-21T10:00:00Z',$2,'DELIVERABLES:\\nLegacy schedule row remains') RETURNING id", [project.rows[0].id, user.rows[0].id]); ids.meetings.push(meeting.rows[0].id);
const token = signToken({ userId: user.rows[0].id, email: user.rows[0].email, companyId: ids.company!, fullName: user.rows[0].full_name, companyName: `${marker}-company` });
const linkRes = await api(`/projects/${project.rows[0].id}/meetings/${meeting.rows[0].id}/submittals`, token, { method: "POST", body: JSON.stringify({ submittal_ids: ids.submittals }) });
assert.ok([200, 201].includes(linkRes.status));

const chrome = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"].find(fs.existsSync); assert.ok(chrome, "Chrome not found");
const debugPort = 9354; const profileDir = path.join(evidenceDir, "chrome-profile");
const chromeProcess = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, "about:blank"], { stdio: "ignore" });
async function waitJson(url: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(url, { method: url.includes("/json/new") ? "PUT" : "GET" }); if (response.ok) return response.json(); } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Chrome endpoint unavailable: ${url}`);
}
const target = await waitJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`) as { webSocketDebuggerUrl: string };
const socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise<void>((resolve, reject) => { socket.addEventListener("open", () => resolve()); socket.addEventListener("error", () => reject(new Error("CDP socket failed"))); });
let commandId = 0; const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>(); const browserErrors: string[] = []; const failedApi: string[] = [];
socket.addEventListener("message", event => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) { const item = pending.get(message.id)!; pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); }
  else if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text);
  else if (message.method === "Network.responseReceived" && String(message.params.response.url).includes("/api/v1/") && message.params.response.status >= 400) failedApi.push(`${message.params.response.status} ${message.params.response.url}`);
});
const cdp = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => { const id = ++commandId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression: string) => (await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
const waitFor = async (expression: string, label: string) => {
  for (let attempt = 0; attempt < 120; attempt += 1) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  const debug = await evaluate("({url:location.href,text:document.body.innerText.slice(0,1600)})"); throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(debug)}`);
};
const screenshot = async (name: string) => { const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); fs.writeFileSync(path.join(evidenceDir, name), Buffer.from(shot.data, "base64")); };

try {
  await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Network.enable"); await waitFor("document.readyState === 'complete'", "initial page");
  await cdp("Page.navigate", { url: `${baseUrl}/login` });
  await waitFor(`location.origin === ${JSON.stringify(baseUrl)}`, "local app origin");
  const auth = JSON.stringify({ state: { token, user: { id: user.rows[0].id, email: user.rows[0].email, fullName: user.rows[0].full_name, companyId: ids.company, companyName: `${marker}-company` } }, version: 0 });
  await evaluate(`localStorage.setItem('bimlog-auth', ${JSON.stringify(auth)}); localStorage.setItem('bimlog-lang','en')`);
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${baseUrl}/projects/${project.rows[0].id}/meetings` });
  await waitFor(`document.body.innerText.includes(${JSON.stringify("Create Schedule Bucket")}) && document.body.innerText.includes(${JSON.stringify(`${marker}-001`)})`, "English M4 meeting card");
  await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Create Schedule Bucket'))?.click()");
  await waitFor(`document.querySelector('[role=dialog]')?.innerText.includes(${JSON.stringify("Review linked Submittals")})`, "English M4 dialog");
  await screenshot("desktop-en-schedule-bucket-dialog.png");
  await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(button=>button.textContent?.includes('Preview'))?.click()");
  await waitFor(`document.querySelector('[role=dialog]')?.innerText.includes(${JSON.stringify("2 selected")})`, "English preview counts");
  await evaluate("[...document.querySelectorAll('[role=dialog] button')].find(button=>button.textContent?.includes('Create Schedule Bucket'))?.click()");
  await waitFor(`!document.querySelector('[role=dialog]') && document.body.innerText.includes(${JSON.stringify("Open Schedule Bucket")}) && document.body.innerText.includes(${JSON.stringify("Sync Schedule Bucket")})`, "English M4 created relationship");
  await screenshot("desktop-en-schedule-bucket-created.png");
  const desktopOverflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
  assert.equal(desktopOverflow, false);
  await evaluate("[...document.querySelectorAll('button')].find(button=>button.textContent?.includes('Open Schedule Bucket'))?.click()");
  await waitFor(`location.pathname.endsWith('/schedule') && location.search.includes('bucket=')`, "Open canonical Schedule bucket");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(`${marker}-001`)}) || document.body.innerText.includes(${JSON.stringify("Pump package")})`, "Schedule task traceability");
  await screenshot("desktop-en-open-schedule-bucket.png");

  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("localStorage.setItem('bimlog-lang','es')"); await cdp("Page.navigate", { url: `${baseUrl}/projects/${project.rows[0].id}/meetings` });
  await waitFor(`document.body.innerText.includes(${JSON.stringify("Abrir grupo de planificacion")}) && document.body.innerText.includes(${JSON.stringify("Sincronizar grupo")})`, "Spanish M4 created relationship");
  await screenshot("mobile-390-es-schedule-bucket-created.png");
  const mobileOverflow = await evaluate("document.documentElement.scrollWidth > window.innerWidth");
  assert.equal(mobileOverflow, false);
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(failedApi, []);
  const report = { suite: "meeting-minutes-m4-browser", desktop: { width: 1280, language: "en", dialog: "desktop-en-schedule-bucket-dialog.png", created: "desktop-en-schedule-bucket-created.png", openSchedule: "desktop-en-open-schedule-bucket.png", horizontalOverflow: false }, mobile: { width: 390, language: "es", created: "mobile-390-es-schedule-bucket-created.png", horizontalOverflow: false }, browserErrors, failedApi };
  fs.writeFileSync(path.join(evidenceDir, "browser-proof.json"), `${JSON.stringify(report, null, 2)}\n`); console.log(JSON.stringify(report, null, 2));
} finally {
  socket.close(); chromeProcess.kill();
  await new Promise(resolve => { chromeProcess.once("exit", resolve); setTimeout(resolve, 1200); });
  try { fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 }); } catch { /* profile cache cleanup is non-product evidence hygiene */ }
  server.close();
  await pool.query("DELETE FROM activity_log WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM meeting_schedule_task_links WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM meeting_schedule_bucket_links WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM schedule_item_placements WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM schedule_buckets WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM project_milestones WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM meeting_submittal_links WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM meeting_minutes WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM submittals WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM project_members WHERE project_id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM projects WHERE id=ANY($1::int[])", [ids.projects]);
  await pool.query("DELETE FROM users WHERE id=ANY($1::int[])", [ids.users]);
  if (ids.company) await pool.query("DELETE FROM companies WHERE id=$1", [ids.company]);
  await pool.end();
}

process.exit(0);
