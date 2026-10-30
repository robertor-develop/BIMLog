import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const root = path.resolve(process.cwd(), "../.."),
  publicDir = path.join(root, "artifacts/bimlog/dist/public"),
  outputDir = process.env.FINANCIAL_BROWSER_EVIDENCE_DIR;
assert.ok(outputDir, "FINANCIAL_BROWSER_EVIDENCE_DIR is required.");
assert.ok(
  fs.existsSync(path.join(publicDir, "index.html")),
  "Production web build is required.",
);
fs.mkdirSync(outputDir, { recursive: true });
const user = {
  id: 71,
  email: "financial-admin@example.test",
  fullName: "Build 1 Financial Admin",
  companyId: 31,
  companyName: "Build 1 Evidence Company",
  isSuperAdmin: false,
};
const state = {
  scope: { companyId: 31, projectId: null, scopeType: "company" },
  projectScopes: [{ id: 91, name: "Evidence Project" }],
  status: "active",
  commercial: {
    decision: "deny",
    code: "ENT_COMING_LATER",
    state: "coming_later",
    authorizesExecution: false,
  },
  context: {
    baseCurrency: "CAD",
    reportingCurrency: "USD",
    permittedTransactionCurrencies: ["CAD", "USD", "EUR"],
    version: 2,
    effectiveFrom: "2026-07-20T12:00:00.000Z",
    effectiveTo: null,
  },
  authorities: [
    {
      grantId: "grant-admin",
      authority: "financial_administrator",
      scopeType: "company",
      effectiveFrom: "2026-07-20T12:00:00.000Z",
      effectiveTo: null,
    },
  ],
  approvalLimits: [],
  canManage: true,
  canAudit: true,
  canBootstrapControlPlane: false,
  explanation: {
    en: "Only the explicit authorities shown are effective; commercial availability remains a separate required gate.",
    es: "Solo las autoridades explícitas mostradas están vigentes; la disponibilidad comercial sigue siendo un requisito independiente.",
  },
};
const admin = {
  contexts: [
    {
      id: "context-2",
      base_currency: "CAD",
      reporting_currency: "USD",
      permitted_transaction_currencies: ["CAD","USD","EUR"],
      scope_type: "company",project_id:null,reason:"Synthetic saved currency context",created_by_id:71,created_at:"2026-07-20T12:00:00.000Z",
      version: 2,
      effective_from: "2026-07-20T12:00:00.000Z",
      effective_to: null,
    },
  ],
  grants: [
    {
      id: "grant-admin",
      full_name: user.fullName,
      email: user.email,
      authority: "financial_administrator",
      version: 1,
      revoked_at: null,
      user_id:71,scope_type:"company",project_id:null,effective_from:"2026-07-20T12:00:00.000Z",effective_to:null,reason:"Synthetic administrator grant",granted_by_id:71,
    },
  ],
  policies: [
    {
      id: "policy-1",
      transaction_category: "change_order",
      currency: "CAD",
      max_amount: "25000.000000",
      version: 1,
    },
  ],
  suspensions: [],
  users: [
    { id: 71, full_name: user.fullName, email: user.email },
    { id: 72, full_name: "Evidence Reviewer", email: "reviewer@example.test" },
  ],
  projects: [{ id: 91, name: "Evidence Project" }],
  journal: [
    {
      event_type: "authority_granted",
      entity_id: "grant-admin",
      reason_code: "FIN_AUTHORITY_GRANTED",
      occurred_at: "2026-07-20T12:00:00.000Z",
      explanation_en: "An explicit financial authority was granted.",
      explanation_es: "Se concedió una autoridad financiera explícita.",
    },
  ],
};
const app = express();
const fixtureToken=`${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-browser-fixture`;
app.use(express.json({ limit: "32kb" }));
app.get("/browser-seed", (req, res) => {
  const lang = req.query.lang === "es" ? "es" : "en";
  res
    .type("html")
    .send(
      `<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({ state: { token: fixtureToken, user, changedAt:Date.now() }, version: 1 }))});localStorage.setItem('bimlog-lang','${lang}');location.replace('/settings/financial-controls')</script>`,
    );
});
app.get("/api/v1/auth/me", (_req, res) =>
  res.json({
    ...user,
    company: { name: user.companyName },
    notificationPreferences: {},
  }),
);
app.get("/api/v1/financial-controls/state", (_req, res) => res.json(state));
let malformedAdmin=false;
app.post('/fixture/admin-shape',(req,res)=>{malformedAdmin=req.body.invalid===true;res.json({ok:true});});
app.get("/api/v1/financial-controls/admin", (_req, res) => res.json(malformedAdmin?{...admin,contexts:[{}]}:admin));
app.get("/api/v1/projects", (_req, res) => res.json([]));
app.get("/api/v1/notifications/unread-count", (_req, res) =>
  res.json({ count: 0 }),
);
app.get("/api/v1/notifications", (_req, res) => res.json([]));
app.all("/api/v1/*path", (_req, res) => res.json([]));
app.use(express.static(publicDir));
app.get("*path", (_req, res) =>
  res.sendFile(path.join(publicDir, "index.html")),
);
const server = app.listen(3133, "127.0.0.1"),
  browserPath =
    process.env.BIMLOG_BROWSER_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  profileDir = path.join(
    os.tmpdir(),
    `bimlog-financial-browser-${process.pid}`,
  ),
  browser = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--remote-debugging-port=9344",
      `--user-data-dir=${profileDir}`,
      "--window-size=1280,900",
      "http://127.0.0.1:3133/browser-seed?lang=en",
    ],
    { stdio: "ignore", windowsHide: true },
  );
let shutdownBrowser:(()=>Promise<void>)|null=null;
let completedResult:unknown=null;
try {
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let page: any;
for (let i = 0; i < 60; i++) {
  try {
    const list = (await fetch("http://127.0.0.1:9344/json/list").then(
      (response) => response.json(),
    )) as any[];
    page = list.find(
      (item) =>
        item.type === "page" && String(item.url).includes("127.0.0.1:3133"),
    );
    if (page) break;
  } catch (_expectedFailure) { void _expectedFailure; }
  await delay(200);
}
assert.ok(
  page?.webSocketDebuggerUrl,
  "Headless browser debugging endpoint unavailable.",
);
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise<void>((resolve, reject) => {
  socket.onopen = () => resolve();
  socket.onerror = () => reject(new Error("Browser websocket failed."));
});
let sequence = 0;
const pending = new Map<number, (value: any) => void>();
const runtimeErrors:string[]=[],apiFailures:string[]=[];
socket.onmessage = (event) => {
  const message = JSON.parse(String(event.data));
  if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));
  if(message.method==='Network.responseReceived'&&String(message.params.response.url).includes('127.0.0.1:3133/api/')&&message.params.response.status>=400)apiFailures.push(`${message.params.response.status} ${message.params.response.url}`);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)!(message);
    pending.delete(message.id);
  }
};
const cdp = (method: string, params: Record<string, unknown> = {}) =>
  new Promise<any>((resolve) => {
    const id = ++sequence;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
const evaluate = async (expression: string) => {
  const response = await cdp("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.result?.exceptionDetails)
    throw new Error(JSON.stringify(response.result.exceptionDetails));
  return response.result?.result?.value;
};
shutdownBrowser=async()=>{
  const exited=new Promise<void>(resolve=>browser.once('exit',()=>resolve()));
  if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({id:++sequence,method:'Browser.close'}));
  if(browser.exitCode===null)await Promise.race([exited,delay(5000)]);
  socket.close();
};
await cdp("Runtime.enable");
await cdp("Page.enable");
await cdp('Network.enable');await cdp('Page.reload',{ignoreCache:true});
let body = "";
for (let i = 0; i < 60; i++) {
  await delay(250);
  body = String(await evaluate("document.body.innerText"));
  if (body.includes("Financial context version")) break;
}
assert.match(body, /Cost & Financial Control/,JSON.stringify(runtimeErrors));
assert.match(body, /Commercial gate/);
assert.match(body, /ENT_COMING_LATER/);
assert.match(
  body,
  /This foundation does not create financial records or move money/,
);
assert.match(body, /financial administrator/i);
const desktop = await evaluate(
  "document.documentElement.scrollWidth<=window.innerWidth&&document.querySelector('select')?.offsetWidth>0",
);
assert.equal(desktop, true);
const desktopShot = await cdp("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
fs.writeFileSync(
  path.join(outputDir, "financial-controls-desktop-en.png"),
  Buffer.from(desktopShot.result.data, "base64"),
);
await evaluate(`fetch('/fixture/admin-shape',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invalid:true})}).then(()=>{[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Refresh current financial scope')).click()})`);
for(let i=0;i<60;i++){await delay(100);body=String(await evaluate('document.body.innerText'));if(body.includes('Invalid financial administration response'))break;}
assert.match(body,/Invalid financial administration response/);assert.match(body,/Retry selected financial scope/);
await evaluate(`fetch('/fixture/admin-shape',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({invalid:false})}).then(()=>{[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Retry selected financial scope')).click()})`);
for(let i=0;i<60;i++){await delay(100);body=String(await evaluate('document.body.innerText'));if(body.includes('Financial context version'))break;}
assert.match(body,/Financial context version/);
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await evaluate("localStorage.setItem('bimlog-lang','es');location.reload()");
for (let i = 0; i < 60; i++) {
  await delay(250);
  body = String(await evaluate("document.body.innerText"));
  if (body.includes("Versión del contexto financiero")) break;
}
assert.match(body, /Control de Costos y Finanzas/);
assert.match(body, /Control comercial/);
assert.match(
  body,
  /No se creó ninguna transacción financiera|no crea registros financieros ni mueve dinero/,
);
const mobile = await evaluate(
  "document.documentElement.scrollWidth<=window.innerWidth&&document.querySelector('select')?.offsetWidth>0",
);
assert.equal(mobile, true);
const mobileShot = await cdp("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
fs.writeFileSync(
  path.join(outputDir, "financial-controls-mobile-es.png"),
  Buffer.from(mobileShot.result.data, "base64"),
);
const result = {
  suite: "cost-financial-control-build-1-browser",
  status: "passed",
  browser: "Microsoft Edge headless",
  productionComponent: true,
  checks: [
    "desktop English settings rendered",
    "mobile 390x844 Spanish settings rendered",
    "no horizontal overflow",
    "commercial denial visible",
    "explicit authority visible",
    "no financial records or money movement claim visible",
    "malformed administration response fails visibly and retry recovers",
    "no browser runtime exceptions or local API failures",
  ],
  screenshots: [
    "financial-controls-desktop-en.png",
    "financial-controls-mobile-es.png",
  ],
  runtimeErrors,apiFailures,
};
assert.deepEqual(runtimeErrors,[]);assert.deepEqual(apiFailures,[]);
completedResult=result;
} finally {
  await shutdownBrowser?.();
  if(browser.exitCode===null)browser.kill();
  server.closeIdleConnections();server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const expectedProfile=path.resolve(os.tmpdir(),`bimlog-financial-browser-${process.pid}`);
  if(path.resolve(profileDir)!==expectedProfile)throw new Error('Task browser profile identity mismatch');
  await new Promise(resolve=>setTimeout(resolve,1000));
  fs.rmSync(expectedProfile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(outputDir,"financial-control-browser.json"),`${JSON.stringify(completedResult,null,2)}\n`);
console.log(JSON.stringify(completedResult,null,2));
