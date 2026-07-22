import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";

const root = process.cwd(), publicDir = path.join(root, "artifacts/bimlog/dist/public"), outputDir = process.env.FINANCIAL_BROWSER_EVIDENCE_DIR;
assert.ok(outputDir); assert.ok(fs.existsSync(path.join(publicDir, "index.html"))); fs.mkdirSync(outputDir, { recursive: true });
const user = { id: 71, email: "browser@example.test", fullName: "Internal Preparer", companyId: 31, companyName: "Disposable Company", isSuperAdmin: false };
const contract = { id: "contract-browser", bimlogId: "BIMLOG-CON-browser", legalNumber: "SC-2026-001", title: "Controlled Trade Contract", counterpartyName: "Internal Browser Fixture", perspective: "downstream", contractType: "subcontract", versionId: "version-browser", version: 1, status: "under_review", currency: "USD", originalValue: "125000.250001", executedAmendmentTotal: "0", currentCommitment: "125000.250001", contentFingerprint: "a".repeat(64), revision: 3 };
const executable = { ...contract, id: "contract-execution", versionId: "version-execution", legalNumber: "PO-2026-002", title: "Approved Purchase Order", status: "approved", originalValue: "25000.000001", currentCommitment: "25000.000001", contentFingerprint: "b".repeat(64), revision: 4 };
const snapshot = { id: "snapshot-browser", budgetVersion: 1, currency: "USD", currentTotal: "200000.250001", lines: [{ id: "budget-line-browser", project_cost_node_id: "node-browser", project_code: "01", description: "Approved exact allocation", amount: "200000.250001" }] };
const workspace = { snapshots: [snapshot], structures: [], nodes: [], budgets: [], boundary: { en: "Operational approved budgets only.", es: "Solo presupuestos operativos aprobados." }, snapshot };
const app = express(), credential = crypto.randomUUID();
app.get("/browser-seed", (req, res) => res.type("html").send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({ state: { token: credential, user }, version: 0 }))});localStorage.setItem('bimlog-lang','${req.query.lang === "es" ? "es" : "en"}');location.replace('/projects/91/financial/contracts')</script>`));
app.get("/api/v1/auth/me", (_req, res) => res.json({ ...user, company: { name: user.companyName }, notificationPreferences: {} }));
app.get("/api/v1/projects/91/financial/contracts", (_req, res) => res.json({ contracts: [contract, executable], totals: { executedCommitments: "150000.250002", currencies: ["USD"] } }));
app.get("/api/v1/projects/91/financial/workspace", (_req, res) => res.json(workspace));
app.get("/api/v1/projects/91/financial/snapshots/snapshot-browser", (_req, res) => res.json(workspace));
app.get("/api/v1/notifications/unread-count", (_req, res) => res.json({ count: 0 })); app.get("/api/v1/notifications", (_req, res) => res.json([])); app.all("/api/v1/*path", (_req, res) => res.json([]));
app.use(express.static(publicDir)); app.get("*path", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
const server = app.listen(3137, "127.0.0.1"), profile = path.join(os.tmpdir(), `bimlog-contract-browser-${process.pid}`), browser = spawn(process.env.BIMLOG_BROWSER_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", "--remote-debugging-port=9347", "--remote-allow-origins=*", `--user-data-dir=${profile}`, "--no-first-run", "--disable-gpu", "about:blank"], { stdio: "ignore", windowsHide: true });
browser.unref();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)); let page: any;
const phase = (value: string) => process.stderr.write(`[financial-contract-browser] ${value}\n`);
const watchdog = setTimeout(() => { phase("hard timeout after 45 seconds"); browser.kill(); server.closeAllConnections(); process.exit(124); }, 45000);
try {
  phase("discovering accepted Chrome CDP page");
  for (let i=0;i<80;i++) { try { const pages = await fetch("http://127.0.0.1:9347/json/list").then((r) => r.json()) as any[]; page = pages.find((x) => x.type === "page"); if (page) break; } catch {} await delay(100); }
  phase(page ? "CDP page discovered" : "CDP page not discovered");
  assert.ok(page?.webSocketDebuggerUrl, "headless browser page unavailable"); const socket = new WebSocket(page.webSocketDebuggerUrl); await Promise.race([new Promise<void>((resolve, reject) => { socket.onopen = () => resolve(); socket.onerror = () => reject(new Error("browser websocket failed")); }), delay(8000).then(() => { throw new Error("browser websocket open timed out"); })]);
  phase("CDP websocket opened");
  let seq=0; const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:any)=>void;timer:ReturnType<typeof setTimeout>}>(), browserErrors:string[]=[], failedApi:string[]=[]; socket.onmessage=(event)=>{const message=JSON.parse(String(event.data));if(message.id&&pending.has(message.id)){const item=pending.get(message.id)!;clearTimeout(item.timer);pending.delete(message.id);message.error?item.reject(message.error):item.resolve(message.result);}else if(message.method==="Runtime.exceptionThrown"||message.method==="Log.entryAdded")browserErrors.push(message.method);else if(message.method==="Network.loadingFailed")failedApi.push(String(message.params?.requestId??"request"));};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(new Error(`CDP ${method} timed out`)),8000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));}); const evaluate=async(expression:string)=>(await cdp("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true})).result?.value;
  await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Log.enable"); await cdp("Network.enable"); await cdp("Page.navigate",{url:"http://127.0.0.1:3137/browser-seed?lang=en"}); let body=""; for(let i=0;i<80;i++){await delay(200);body=String(await evaluate("document.body.innerText"));if(body.includes("Contracts & Commitments"))break;}
  phase("English desktop rendered");
  await evaluate(`([...document.querySelectorAll('button')].find((button)=>button.textContent?.includes('New contract')))?.click()`); await delay(300); body=String(await evaluate("document.body.innerText"));
  const desktopChecks={contracts:/Contracts & Commitments/.test(body),boundary:/Approval is separate from signed-document execution/.test(body),exact:/125000\.250001 USD/.test(body),sov:/Schedule of Values/.test(body),approval:/Confirm exact approval/.test(body),execution:/Attest signed execution/.test(body),overBudget:/exceeds budget or aggregate limits/.test(body),importPreview:/Import.+preview|preview.+confirm/i.test(body),amendment:/New amendment|Amendment workflow/i.test(body),overflow:await evaluate("document.documentElement.scrollWidth>window.innerWidth")};
  const desktop=await cdp("Page.captureScreenshot",{format:"png",captureBeyondViewport:false}); fs.writeFileSync(path.join(outputDir,"financial-contract-desktop-en.png"),Buffer.from(desktop.data,"base64"));
  phase("English desktop screenshot retained");
  await cdp("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true}); await evaluate("localStorage.setItem('bimlog-lang','es')"); await cdp("Page.navigate",{url:"http://127.0.0.1:3137/projects/91/financial/contracts"}); for(let i=0;i<80;i++){await delay(200);body=String(await evaluate("document.body.innerText"));if(body.includes("Contratos y Compromisos"))break;}
  const mobileChecks={contracts:/Contratos y Compromisos/.test(body),commitment:/Compromiso ejecutado/.test(body),approval:/Confirmar aprobaci.n exacta/.test(body),execution:/Atestar ejecuci.n firmada/.test(body),overflow:await evaluate("document.documentElement.scrollWidth>window.innerWidth"),width:await evaluate("window.innerWidth")}; const mobile=await cdp("Page.captureScreenshot",{format:"png",captureBeyondViewport:false}); fs.writeFileSync(path.join(outputDir,"financial-contract-mobile-es-390.png"),Buffer.from(mobile.data,"base64"));
  phase("Spanish 390px screenshot retained");
  const result={suite:"cost-financial-control-build-3-browser",mechanism:"accepted Telegram Build 6 Chrome harness",status:"evaluated",desktop:desktopChecks,mobile:mobileChecks,browserErrors,failedApi,screenshots:["financial-contract-desktop-en.png","financial-contract-mobile-es-390.png"]}; fs.writeFileSync(path.join(outputDir,"financial-contract-browser.json"),JSON.stringify(result,null,2)); console.log(JSON.stringify(result,null,2)); const passed=Object.entries(desktopChecks).every(([key,value])=>key==="overflow"?!value:value)&&Object.entries(mobileChecks).every(([key,value])=>key==="overflow"?!value:key==="width"?value===390:value)&&browserErrors.length===0&&failedApi.length===0;if(!passed)throw new Error(`Browser acceptance failed: ${JSON.stringify(result)}`);socket.close();
} finally { clearTimeout(watchdog); browser.kill(); server.closeAllConnections(); await Promise.race([new Promise<void>((resolve)=>server.close(()=>resolve())),delay(2000)]); phase("browser proof cleanup complete"); }
