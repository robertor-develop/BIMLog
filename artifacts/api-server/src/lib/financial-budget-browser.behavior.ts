import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
const root = process.cwd(),
  publicDir = path.join(root, "artifacts/bimlog/dist/public"),
  outputDir = process.env.FINANCIAL_BROWSER_EVIDENCE_DIR;
assert.ok(outputDir);
assert.ok(fs.existsSync(path.join(publicDir, "index.html")));
fs.mkdirSync(outputDir, { recursive: true });
const user = {
    id: 71,
    email: "approver@example.test",
    fullName: "Independent Approver",
    companyId: 31,
    companyName: "Disposable Company",
    isSuperAdmin: false,
  },
  snapshot = {
    id: "snapshot-1",
    budgetVersionId: "budget-v1",
    status: "approved",
    contentFingerprint: "a".repeat(64),
    snapshotFingerprint: "b".repeat(64),
    originalTotal: "125000.25",
    currentTotal: "125000.25",
    differenceFromOriginal: "0",
    currency: "USD",
    budgetVersion: 1,
    approvedAt: "2026-07-20T12:00:00.000Z",
    approvedById: 71,
    approvalLimit: "200000",
    lines: [
      {
        stable_line_id: "line-1",
        project_code: "01",
        project_name: "General Conditions",
        hierarchical_path: "01",
        description: "Approved project setup",
        amount: "125000.25",
        quantity: null,
        unit: null,
        unit_rate: null,
        notes: null,
        sort_order: 0,
      },
    ],
  },
  workspace = {
    project: {
      id: 91,
      name: "Evidence Project",
      code: "EP-01",
      companyName: "Disposable Company",
    },
    structures: [
      { id: "structure-1", version: 1, library_version: 3, status: "approved" },
    ],
    nodes: [
      {
        id: "node-1",
        project_code: "01",
        project_name: "General Conditions",
        active: true,
        mapping_provenance: "company_library",
      },
    ],
    budgets: [
      {
        id: "budget-v1",
        budget_id: "budget-1",
        version: 1,
        currency: "USD",
        status: "approved",
        purpose: "Original approved project budget",
        calculated_total: "125000.250000",
        content_fingerprint: "a".repeat(64),
        revision: 4,
        approved_snapshot_id: "snapshot-1",
      },
    ],
    snapshots: [snapshot],
    snapshot: null,
    boundary: {
      en: "Operational approved budgets only. No accounting actuals, payments, commitments, forecasts, or cash disbursements.",
      es: "Solo presupuestos operativos aprobados. Sin valores contables reales, pagos, compromisos, pronósticos ni desembolsos.",
    },
  };
const app = express(),
  proofCredential = crypto.randomUUID();
app.get("/browser-seed", (req, res) => {
  const lang = req.query.lang === "es" ? "es" : "en";
  res
    .type("html")
    .send(
      `<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({ state: { token: proofCredential, user }, version: 0 }))});localStorage.setItem('bimlog-lang','${lang}');location.replace('/projects/91/financial/budget')</script>`,
    );
});
app.get("/api/v1/auth/me", (_req, res) =>
  res.json({
    ...user,
    company: { name: user.companyName },
    notificationPreferences: {},
  }),
);
app.get("/api/v1/projects/91/financial/workspace", (_req, res) =>
  res.json(workspace),
);
app.get("/api/v1/projects/91/financial/snapshots/snapshot-1", (_req, res) =>
  res.json({ ...workspace, snapshot }),
);
app.get("/api/v1/notifications/unread-count", (_req, res) =>
  res.json({ count: 0 }),
);
app.get("/api/v1/notifications", (_req, res) => res.json([]));
app.all("/api/v1/*path", (_req, res) => res.json([]));
app.use(express.static(publicDir));
app.get("*path", (_req, res) =>
  res.sendFile(path.join(publicDir, "index.html")),
);
const server = app.listen(3134, "127.0.0.1"),
  browserPath =
    process.env.BIMLOG_BROWSER_PATH ||
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  profileDir = path.join(os.tmpdir(), `bimlog-budget-browser-${process.pid}`),
  browser = spawn(
    browserPath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--remote-debugging-port=9345",
      `--user-data-dir=${profileDir}`,
      "--window-size=1280,900",
      "http://127.0.0.1:3134/browser-seed?lang=en",
    ],
    { stdio: "ignore", windowsHide: true },
  ),
  delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let page: any;
for (let i = 0; i < 60; i++) {
  try {
    const list = (await fetch("http://127.0.0.1:9345/json/list").then((r) =>
      r.json(),
    )) as any[];
    page = list.find(
      (x) => x.type === "page" && String(x.url).includes("127.0.0.1:3134"),
    );
    if (page) break;
  } catch {}
  await delay(200);
}
assert.ok(page?.webSocketDebuggerUrl);
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise<void>((resolve, reject) => {
  socket.onopen = () => resolve();
  socket.onerror = () => reject(new Error("browser websocket failed"));
});
let seq = 0;
const pending = new Map<number, (v: any) => void>();
socket.onmessage = (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)!(m);
    pending.delete(m.id);
  }
};
const cdp = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<any>((resolve) => {
      const id = ++seq;
      pending.set(id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    }),
  evaluate = async (expression: string) => {
    const r = await cdp("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.result?.exceptionDetails)
      throw new Error(JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };
await cdp("Runtime.enable");
await cdp("Page.enable");
let body = "";
for (let i = 0; i < 60; i++) {
  await delay(250);
  body = String(await evaluate("document.body.innerText"));
  if (body.includes("Controlled budget workflow")) break;
}
assert.match(body, /Project Budget/);
assert.match(body, /Original Budget/);
assert.match(body, /Current Budget/);
assert.match(body, /Difference from Original/);
assert.match(body, /Operational approved budgets only/);
assert.equal(
  await evaluate("document.documentElement.scrollWidth<=window.innerWidth"),
  true,
);
const desktop = await cdp("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
fs.writeFileSync(
  path.join(outputDir, "financial-budget-desktop-en.png"),
  Buffer.from(desktop.result.data, "base64"),
);
await cdp("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await evaluate(
  "localStorage.setItem('bimlog-lang','es');location.href='/projects/91/financial/snapshots/snapshot-1'",
);
for (let i = 0; i < 60; i++) {
  await delay(250);
  body = String(await evaluate("document.body.innerText"));
  if (body.includes("Línea base aprobada inmutable")) break;
}
assert.match(body, /Instantánea de Línea Base Aprobada/);
assert.match(body, /Presupuesto Original/);
assert.match(body, /125000\.25 USD/);
assert.match(body, /navegador, PDF y XLSX/i);
assert.equal(
  await evaluate("document.documentElement.scrollWidth<=window.innerWidth"),
  true,
);
const errors = await evaluate("window.__bimlogBrowserErrors||[]");
assert.deepEqual(errors, []);
const mobile = await cdp("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: false,
});
fs.writeFileSync(
  path.join(outputDir, "financial-budget-mobile-es.png"),
  Buffer.from(mobile.result.data, "base64"),
);
const result = {
  suite: "cost-financial-control-build-2-browser",
  status: "passed",
  checks: [
    "desktop English budget workflow",
    "390px Spanish approved snapshot",
    "original/current/difference visible",
    "same snapshot values visible",
    "no horizontal overflow",
    "no browser exceptions",
  ],
  screenshots: [
    "financial-budget-desktop-en.png",
    "financial-budget-mobile-es.png",
  ],
};
fs.writeFileSync(
  path.join(outputDir, "financial-budget-browser.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
socket.close();
browser.kill();
await new Promise<void>((resolve) => server.close(() => resolve()));
