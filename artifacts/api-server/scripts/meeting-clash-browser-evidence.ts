import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import express from "express";

if (!process.env.PROD_DATABASE_URL) throw new Error("Load the isolated local test environment first.");
process.env.JWT_SECRET ||= "meeting-clash-browser-local-evidence-secret";

const evidenceDir = process.argv[2];
if (!evidenceDir) throw new Error("Evidence directory required");
fs.mkdirSync(evidenceDir, { recursive: true });

const dist = path.resolve("artifacts/bimlog/dist/public");
assert.ok(fs.existsSync(path.join(dist, "index.html")), "Build the web app first");

const [{ pool }, { signToken }, { default: app }] = await Promise.all([
  import("@workspace/db"),
  import("../src/middlewares/auth"),
  import("../src/app"),
]);

app.use(express.static(dist));
app.use((req, res, next) => req.method === "GET" ? res.sendFile(path.join(dist, "index.html")) : next());

const server = http.createServer(app);
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.equal(typeof address, "object");
const baseUrl = `http://127.0.0.1:${address!.port}`;

const marker = `meeting-m3-browser-${Date.now()}`;
const company = await pool.query<{ id: number }>("INSERT INTO companies(name) VALUES($1) RETURNING id", [`${marker}-company`]);
const user = await pool.query<{ id: number; email: string; full_name: string }>(
  "INSERT INTO users(email,password_hash,full_name,company_id) VALUES($1,'proof',$2,$3) RETURNING id,email,full_name",
  [`${marker}@example.invalid`, marker, company.rows[0].id],
);
const project = await pool.query<{ id: number }>(
  "INSERT INTO projects(name,code,status,created_by_id) VALUES($1,$2,'active',$3) RETURNING id",
  [`${marker} Project`, marker, user.rows[0].id],
);
const role = await pool.query<{ value: string }>(
  "SELECT value FROM config_options WHERE category='member_role' AND meta->>'permission' IN ('admin','write') LIMIT 1",
);
assert.ok(role.rows[0]?.value);
await pool.query(
  "INSERT INTO project_members(project_id,user_id,role,status) VALUES($1,$2,$3,'active')",
  [project.rows[0].id, user.rows[0].id, role.rows[0].value],
);
const meeting = await pool.query<{ id: number }>(
  "INSERT INTO meeting_minutes(project_id,title,meeting_date,created_by_id,notes) VALUES($1,$2,now(),$3,$4) RETURNING id",
  [project.rows[0].id, `${marker} Coordination Meeting`, user.rows[0].id, "VIEWPOINTS:\nL9 | Legacy Co | OLD-1 | Legacy preserved | 08-30-26"],
);
const report = await pool.query<{ id: number }>(
  "INSERT INTO clash_reports(project_id,uploaded_by_id,file_name,format,status) VALUES($1,$2,$3,'manual','complete') RETURNING id",
  [project.rows[0].id, user.rows[0].id, `${marker} Report`],
);
await pool.query(
  `INSERT INTO clashes(clash_report_id,project_id,clash_id_original,description,level,discipline_1,assigned_to_name,test_name,status,due_date)
   VALUES($1,$2,$3,'Duct vs pipe','Level 1','Mechanical','Coordination Co','Group A','open','2026-08-20'),
         ($1,$2,$4,'Conduit follow up','Roof','Electrical','Electrical Co','Group B','follow_up','2026-08-25')`,
  [report.rows[0].id, project.rows[0].id, `${marker}-OPEN`, `${marker}-FOLLOW`],
);

const token = signToken({
  userId: user.rows[0].id,
  email: user.rows[0].email,
  companyId: company.rows[0].id,
  fullName: user.rows[0].full_name,
  companyName: `${marker}-company`,
});

const chrome = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find(fs.existsSync);
assert.ok(chrome, "Chrome not found");

const chromePort = 9353;
const profile = path.join(evidenceDir, `chrome-profile-${marker}`);
const chromeProcess = spawn(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--disable-extensions",
  `--remote-debugging-port=${chromePort}`,
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

const waitJson = async (url: string) => {
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(url, { method: url.includes("/json/new") ? "PUT" : "GET" });
      if (response.ok) return response.json();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Chrome unavailable");
};

const target = await waitJson(`http://127.0.0.1:${chromePort}/json/new?${encodeURIComponent(baseUrl)}`) as { webSocketDebuggerUrl: string };
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise<void>((resolve, reject) => {
  socket.addEventListener("open", () => resolve());
  socket.addEventListener("error", () => reject(new Error("CDP failed")));
});

let id = 0;
const pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
const browserErrors: string[] = [];
const networkFailures: string[] = [];
socket.addEventListener("message", event => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) {
    const p = pending.get(message.id)!;
    pending.delete(message.id);
    message.error ? p.reject(new Error(message.error.message)) : p.resolve(message.result);
  } else if (message.method === "Runtime.exceptionThrown") {
    browserErrors.push(message.params.exceptionDetails.text);
  } else if (message.method === "Network.responseReceived" && message.params.response.status >= 400) {
    networkFailures.push(`${message.params.response.status} ${message.params.response.url}`);
  } else if (message.method === "Network.loadingFailed") {
    networkFailures.push(`${message.params.errorText} ${message.params.requestId}`);
  }
});

const cdp = (method: string, params: Record<string, unknown> = {}) => new Promise<any>((resolve, reject) => {
  const command = ++id;
  pending.set(command, { resolve, reject });
  socket.send(JSON.stringify({ id: command, method, params }));
});
const evaluate = async (expression: string) => (await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;
const waitFor = async (expression: string, name: string) => {
  for (let i = 0; i < 160; i++) {
    if (await evaluate(expression)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const bodyText = await evaluate("document.body.innerText");
  await screenshot(`failure-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`);
  fs.writeFileSync(path.join(evidenceDir, "browser-failure.json"), `${JSON.stringify({ name, bodyText, browserErrors, networkFailures }, null, 2)}\n`);
  throw new Error(`Timed out: ${name}`);
};
const screenshot = async (name: string) => {
  const shot = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(evidenceDir, name), Buffer.from(shot.data, "base64"));
};

try {
  await cdp("Page.enable");
  await cdp("Runtime.enable");
  await cdp("Network.enable");
  const auth = JSON.stringify({
    state: {
      token,
      user: {
        id: user.rows[0].id,
        email: user.rows[0].email,
        fullName: user.rows[0].full_name,
        companyId: company.rows[0].id,
        companyName: `${marker}-company`,
      },
    },
    version: 0,
  });
  await cdp("Page.navigate", { url: `${baseUrl}/login` });
  await waitFor("document.readyState==='complete'", "login");
  await evaluate(`localStorage.setItem('bimlog-auth',${JSON.stringify(auth)});localStorage.setItem('bimlog-lang','en')`);
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: `${baseUrl}/projects/${project.rows[0].id}/meetings` });
  await waitFor("document.body.innerText.includes('Load Open & Follow-Up Clashes')", "English controls");
  const clicked = await evaluate("(() => { const button = [...document.querySelectorAll('button')].filter(b=>b.textContent?.includes('Load Open & Follow-Up Clashes')).at(-1); if (!button) return false; button.click(); return true; })()");
  assert.equal(clicked, true, "Load button not clicked");
  await waitFor(`document.body.innerText.includes(${JSON.stringify(`${marker}-OPEN`)}) && document.body.innerText.includes(${JSON.stringify(`${marker}-FOLLOW`)})`, "loaded clashes");
  await screenshot("desktop-en-clashes-loaded.png");
  const selects = await evaluate("[...document.querySelectorAll('select')].filter(s=>s.getAttribute('aria-label')?.startsWith('All ')).length");
  assert.equal(selects, 5);

  await cdp("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("localStorage.setItem('bimlog-lang','es')");
  await cdp("Page.reload", { ignoreCache: true });
  await waitFor("document.body.innerText.includes('Cargar Clashes Abiertos y de Seguimiento') && document.body.innerText.includes('Actualizar Clashes')", "Spanish controls");
  await screenshot("mobile-390-es-clashes.png");
  const overflow = await evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth");
  assert.equal(overflow, false);
  const apiNetworkFailures = networkFailures.filter(row => row.includes("/api/v1/"));
  assert.deepEqual(browserErrors, []);
  assert.deepEqual(apiNetworkFailures, []);

  const reportData = {
    suite: "meeting-minutes-m3-browser",
    desktop: { width: 1280, language: "en", screenshot: "desktop-en-clashes-loaded.png", filters: 5 },
    mobile: { width: 390, language: "es", screenshot: "mobile-390-es-clashes.png", horizontalOverflow: false },
    browserErrors,
    apiNetworkFailures,
    nonApiNetworkNotes: networkFailures.filter(row => !row.includes("/api/v1/")),
  };
  fs.writeFileSync(path.join(evidenceDir, "browser-proof.json"), `${JSON.stringify(reportData, null, 2)}\n`);
  console.log(JSON.stringify(reportData, null, 2));
} finally {
  socket.close();
  chromeProcess.kill();
  server.close();
  await pool.query("DELETE FROM activity_log WHERE project_id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM meeting_clash_refresh_events WHERE project_id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM meeting_clash_links WHERE project_id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM meeting_minutes WHERE project_id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM clashes WHERE project_id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM clash_reports WHERE project_id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM project_members WHERE project_id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM projects WHERE id=$1", [project.rows[0].id]);
  await pool.query("DELETE FROM users WHERE id=$1", [user.rows[0].id]);
  await pool.query("DELETE FROM companies WHERE id=$1", [company.rows[0].id]);
  await pool.end();
}

process.exit(0);
