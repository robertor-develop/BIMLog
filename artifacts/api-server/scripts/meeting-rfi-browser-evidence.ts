import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import express from "express";

if (!process.env.PROD_DATABASE_URL) throw new Error("Load the isolated local test environment before running this evidence script.");
process.env.JWT_SECRET ||= "meeting-rfi-browser-local-evidence-secret";

const evidenceDir = process.argv[2];
if (!evidenceDir) throw new Error("Evidence directory is required.");
fs.mkdirSync(evidenceDir, { recursive: true });
const distDir = path.resolve("artifacts/bimlog/dist/public");
assert.ok(fs.existsSync(path.join(distDir, "index.html")), "Build the BIMLog web app before browser evidence.");

const [{ pool }, { signToken }, { default: app }] = await Promise.all([
  import("@workspace/db"), import("../src/middlewares/auth"), import("../src/app"),
]);
app.use(express.static(distDir));
app.use((req, res, next) => req.method === "GET" ? res.sendFile(path.join(distDir, "index.html")) : next());

const server = http.createServer(app);
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address(); assert.equal(typeof address, "object");
const baseUrl = `http://127.0.0.1:${address!.port}`;
const marker = `meeting-browser-${Date.now()}`;
const company = await pool.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${marker}-company`]);
const user = await pool.query<{ id: number; email: string; full_name: string }>("INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'proof',$2,$3) RETURNING id,email,full_name", [`${marker}@example.invalid`, marker, company.rows[0].id]);
const project = await pool.query<{ id: number }>("INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id", [`${marker} Project`, marker, user.rows[0].id]);
const role = await pool.query<{ value: string }>("SELECT value FROM config_options WHERE category='member_role' AND meta->>'permission' IN ('admin','write') LIMIT 1");
assert.ok(role.rows[0]?.value);
await pool.query("INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active')", [project.rows[0].id, user.rows[0].id, role.rows[0].value]);
await pool.query("INSERT INTO rfis(project_id,number,subject,description,status,priority,created_by_id,ball_in_court) VALUES($1,$2,$3,$4,'open','normal',$5,$6),($1,$7,$8,$9,'answered','normal',$5,$10)", [project.rows[0].id, `${marker}-001`, "Pump coordination", "Resolve pump room clearance", user.rows[0].id, "Mechanical GC", `${marker}-002`, "East riser sleeves", "Coordinate east riser sleeve layout", "Electrical GC"]);
const token = signToken({ userId: user.rows[0].id, email: user.rows[0].email, companyId: company.rows[0].id, fullName: user.rows[0].full_name, companyName: `${marker}-company` });

const chrome = ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"].find(fs.existsSync);
assert.ok(chrome, "Chrome not found");
const debugPort = 9337;
const profileDir = path.join(evidenceDir, "chrome-profile");
const chromeProcess = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, "about:blank"], { stdio: "ignore" });

async function waitJson(url: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { const response = await fetch(url, { method: url.includes("/json/new") ? "PUT" : "GET" }); if (response.ok) return response.json(); } catch { /* retry */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Chrome endpoint unavailable: ${url}`);
}

const target = await waitJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`) as { webSocketDebuggerUrl: string };
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise<void>((resolve, reject) => { socket.addEventListener("open", () => resolve()); socket.addEventListener("error", () => reject(new Error("CDP socket failed"))); });
let commandId = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
const browserErrors: string[] = [];
socket.addEventListener("message", event => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) {
    const item = pending.get(message.id)!; pending.delete(message.id);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text);
});
const cdp = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => {
  const id = ++commandId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression: string) => (await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
const waitFor = async (expression: string, label: string) => {
  for (let attempt = 0; attempt < 80; attempt += 1) { if (await evaluate(expression)) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  const debug = await evaluate("({url:location.href,text:document.body.innerText.slice(0,800),html:document.body.innerHTML.slice(0,800)})");
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(debug)}`);
};
const screenshot = async (name: string) => {
  const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(evidenceDir, name), Buffer.from(shot.data, "base64"));
};

try {
  await cdp("Page.enable"); await cdp("Runtime.enable");
  await waitFor("document.readyState === 'complete'", "initial page");
  const auth = JSON.stringify({ state: { token, user: { id: user.rows[0].id, email: user.rows[0].email, fullName: user.rows[0].full_name, companyId: company.rows[0].id, companyName: `${marker}-company` } }, version: 0 });
  await evaluate(`localStorage.setItem('bimlog-auth', ${JSON.stringify(auth)}); localStorage.setItem('bimlog-lang','en')`);
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${baseUrl}/projects/${project.rows[0].id}/meetings` });
  await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent?.includes('New Meeting'))", "English meeting page");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('New Meeting'))?.click()");
  await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent?.includes('Add Existing RFI'))", "English Add Existing RFI button");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Add Existing RFI'))?.click()");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(`${marker}-001`)})`, "English candidates");
  await screenshot("desktop-en-add-existing-rfi.png");
  await evaluate("document.querySelector('[role=dialog] input[type=checkbox]')?.click()");
  await evaluate(`(()=>{const input=document.querySelector('[role=dialog] input.input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify("-002")});input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await waitFor(`document.querySelector('[role=dialog]').innerText.includes(${JSON.stringify(`${marker}-002`)}) && !document.querySelector('[role=dialog]').innerText.includes(${JSON.stringify(`${marker}-001`)}) && [...document.querySelectorAll('button')].some(b=>b.textContent?.includes('Add Selected (1)'))`, "second search result");
  await evaluate("[...document.querySelectorAll('[role=dialog] input[type=checkbox]')].find(input=>!input.disabled)?.click()");
  await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent?.includes('Add Selected (2)'))", "two selections across searches");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Add Selected (2)'))?.click()");
  await waitFor(`!document.querySelector('[role=dialog]') && document.body.innerText.includes(${JSON.stringify(`${marker}-001`)}) && document.body.innerText.includes(${JSON.stringify(`${marker}-002`)})`, "cross-search multi-select result");
  await evaluate("[...document.querySelectorAll('div')].find(node=>node.textContent?.trim()==='RFIs')?.scrollIntoView({block:'center'})");
  await screenshot("desktop-en-cross-search-multi-select.png");

  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("localStorage.setItem('bimlog-lang','es')");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent?.includes('Nueva Reunión'))", "Spanish meeting page");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Nueva Reunión'))?.click()");
  await waitFor("[...document.querySelectorAll('button')].some(b=>b.textContent?.includes('Añadir RFI existente'))", "Spanish Add Existing RFI button");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent?.includes('Añadir RFI existente'))?.click()");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(`${marker}-002`)})`, "Spanish candidates");
  await screenshot("mobile-390-es-add-existing-rfi.png");
  const overflow = await evaluate("(()=>{const panel=document.querySelector('[role=dialog] > div');if(!panel)return true;const rect=panel.getBoundingClientRect();return rect.left<0||rect.right>innerWidth||panel.scrollWidth>panel.clientWidth})()");
  assert.equal(overflow, false, "390px selector must not overflow horizontally");

  assert.deepEqual(browserErrors, []);
  const report = { suite: "meeting-minutes-m1-browser", desktop: { width: 1280, language: "en", selectorScreenshot: "desktop-en-add-existing-rfi.png", crossSearchMultiSelectScreenshot: "desktop-en-cross-search-multi-select.png" }, mobile: { width: 390, language: "es", screenshot: "mobile-390-es-add-existing-rfi.png", horizontalOverflow: false }, browserErrors };
  fs.writeFileSync(path.join(evidenceDir, "browser-proof.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket.close(); chromeProcess.kill(); server.close();
  await pool.query("DELETE FROM activity_log WHERE project_id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM project_members WHERE project_id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM rfis WHERE project_id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM projects WHERE id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM users WHERE id=$1", [user.rows[0].id]);
  await pool.query("DELETE FROM companies WHERE id=$1", [company.rows[0].id]);
  await pool.end();
}

process.exit(0);
