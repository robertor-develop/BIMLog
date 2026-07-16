import fs from "fs";
import http from "http";
import path from "path";
import { spawn, spawnSync } from "child_process";

const [,, apiBase, token, out] = process.argv;
const webRoot = path.resolve(import.meta.dirname, "../../bimlog/dist/public");
const authState = JSON.stringify({ state: { token, user: { id: 1, email: "browser@example.test", fullName: "Browser Evidence" } }, version: 0 });
fs.mkdirSync(out, { recursive: true });

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" })[ext] || "application/octet-stream";
}

const platform = http.createServer(async (req, res) => {
  try {
    const requestUrl = new URL(req.url || "/", "http://127.0.0.1");
    if (requestUrl.pathname.startsWith("/api/")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const upstream = await fetch(`${apiBase}${requestUrl.pathname}${requestUrl.search}`, {
        method: req.method,
        headers: { authorization: req.headers.authorization || "", "content-type": req.headers["content-type"] || "application/json" },
        body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : Buffer.concat(chunks),
      });
      res.writeHead(upstream.status, Object.fromEntries([...upstream.headers].filter(([name]) => !["content-encoding", "content-length"].includes(name))));
      res.end(Buffer.from(await upstream.arrayBuffer()));
      return;
    }
    const requested = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, "");
    let file = path.resolve(webRoot, requested || "index.html");
    if (!file.startsWith(webRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(webRoot, "index.html");
    res.writeHead(200, { "content-type": contentType(file), "cache-control": "no-store" });
    if (path.basename(file) === "index.html") {
      const html = fs.readFileSync(file, "utf8").replace("</head>", `<script>localStorage.setItem('bimlog-auth',${JSON.stringify(authState)})</script></head>`);
      res.end(html);
    } else res.end(fs.readFileSync(file));
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(error instanceof Error ? error.message : "platform evidence server failure");
  }
});
await new Promise(resolve => platform.listen(0, "127.0.0.1", resolve));
const platformOrigin = `http://127.0.0.1:${platform.address().port}`;

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const cdpPort = 9335;
const profileDir = path.join(out, "profile");
const proc = spawn(chrome, ["--headless=new", `--remote-debugging-port=${cdpPort}`, "--remote-allow-origins=*", `--user-data-dir=${profileDir}`, "--no-first-run", "--disable-gpu", "about:blank"], { windowsHide: true });
proc.unref();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let chromeStopped = false;
async function stopChrome() {
  if (chromeStopped) return;
  chromeStopped = true;
  proc.kill();
  await Promise.race([new Promise(resolve => proc.once("exit", resolve)), wait(2500)]);
  if (process.platform === "win32" && proc.pid) spawnSync("taskkill", ["/PID", String(proc.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  await wait(500);
}

try {
  let target;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
      target = targets.find(candidate => candidate.type === "page" && candidate.url === "about:blank") || targets.find(candidate => candidate.type === "page" && !candidate.url.endsWith("background.html"));
      if (target) break;
    } catch {}
    await wait(100);
  }
  if (!target) throw new Error("Chrome CDP unavailable");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer); pending.delete(message.id);
      message.error ? reject(message.error) : resolve(message.result);
    }
  };
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const commandId = ++id;
    const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 10000);
    pending.set(commandId, { resolve, reject, timer });
    ws.send(JSON.stringify({ id: commandId, method, params }));
  });
  await command("Page.enable");
  await command("Runtime.enable");
  await command("Page.navigate", { url: platformOrigin });
  await wait(700);
  await command("Runtime.evaluate", { expression: `localStorage.setItem('bimlog-auth',${JSON.stringify(authState)})` });
  const results = [];
  for (const [name, width, height] of [["desktop", 1440, 1100], ["mobile", 390, 844]]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: name === "mobile" });
    await command("Page.navigate", { url: `${platformOrigin}/settings/notifications` });
    await wait(2200);
    const dom = await command("Runtime.evaluate", { expression: `(()=>({text:document.body.innerText,route:location.pathname,center:!!document.querySelector('[data-testid="notification-center"]'),overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,disabled:[...document.querySelectorAll('[data-available="false"]')].length,controls:document.querySelectorAll('input,button,select').length}))()`, returnByValue: true });
    const shot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(shot.data, "base64"));
    results.push({ name, width, height, ...dom.result.value });
  }
  fs.writeFileSync(path.join(out, "browser-results.json"), JSON.stringify(results, null, 2));
  ws.close();
  await stopChrome();
  const failed = results.some(result => !result.center || result.overflow || result.route !== "/settings/notifications" || result.disabled < 7);
  console.log(JSON.stringify(results));
  process.exitCode = failed ? 1 : 0;
} finally {
  await stopChrome();
  await new Promise(resolve => platform.close(resolve));
  fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
}
