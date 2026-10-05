import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { answerWithCodex } from "./bimlog-assistant-runtime.mjs";

export const APP_ORIGIN = process.env.BIMLOG_ASSISTANT_APP_ORIGIN || "https://bimlog.app";
export const BRIDGE_PORT = 8798;
const localOrigin = `http://127.0.0.1:${BRIDGE_PORT}`;
const clean = (value, maximum) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, maximum);
export function boundedQuestion(body) {
  if (!body || typeof body.question !== "string" || !body.question.trim() || body.question.length > 2000) throw new Error("Enter a question of 1–2000 characters.");
  return { question: body.question.trim(), context: { route: clean(body.context?.route, 300), page: clean(body.context?.page, 160), section: clean(body.context?.section, 160), projectId: Number.isSafeInteger(body.context?.projectId) ? body.context.projectId : null, language: ["en", "es"].includes(body.context?.language) ? body.context.language : "en", focusedControl: clean(body.context?.focusedControl, 120) || null, controls: (Array.isArray(body.context?.controls) ? body.context.controls : []).slice(0, 60).map((value) => clean(value, 120)) }, history: (Array.isArray(body.history) ? body.history : []).slice(-8).filter((value) => ["user", "assistant"].includes(value.role)).map((value) => ({ role: value.role, text: clean(value.text, 2000), projectId: Number.isSafeInteger(value.projectId) ? value.projectId : null })) };
}
export function createAssistantBridge({ answer, now = Date.now }) {
  let token = randomBytes(32).toString("hex"); let expires = 0; let busy = false; const nonces = new Map();
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin; res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Content-Type-Options", "nosniff");
    const send = (status, data) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (req.headers.host !== `127.0.0.1:${BRIDGE_PORT}`) return send(403, { error: "Invalid host" });
    if (origin === APP_ORIGIN) { res.setHeader("Access-Control-Allow-Origin", APP_ORIGIN); res.setHeader("Vary", "Origin"); res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type"); res.setHeader("Access-Control-Allow-Private-Network", "true"); }
    if (req.method === "OPTIONS") return origin === APP_ORIGIN ? (res.writeHead(204), res.end()) : send(403, { error: "Origin denied" });
    if (req.method === "GET" && req.url === "/pair") {
      const nonce = randomBytes(24).toString("hex"); for (const [key, until] of nonces) if (until < now()) nonces.delete(key); if (nonces.size > 20) return send(429, { error: "Too many pairing requests" }); nonces.set(nonce, now() + 120000);
      res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'`); res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Connect BIMLog assistant</title><style>body{font:18px system-ui;max-width:600px;margin:60px auto;padding:24px;background:#f8fafc;color:#172033}button{padding:14px;background:#174da8;color:white;border:0;border-radius:10px;font:inherit}</style><h1>Connect BIMLog page assistant</h1><p>Connect BIMLog to your local restricted Codex runtime for eight hours. Only your question and visible control labels are sent—never form values or credentials.</p><p>The assistant cannot change records, code, builds, payments, email, or deployments.</p><button id="connect">Connect / Conectar</button><p id="status" role="status"></p><script nonce="${nonce}">document.querySelector('#connect').onclick=async()=>{if(!window.opener)return;const r=await fetch('/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nonce:'${nonce}'})});const d=await r.json();if(r.ok){window.opener.postMessage({type:'bimlog-assistant-paired',token:d.token},'${APP_ORIGIN}');document.querySelector('#status').textContent='Connected / Conectado';}};</script></html>`);
    }
    if (req.method !== "POST" || !["/pair", "/ask"].includes(req.url)) return send(404, { error: "Not found" });
    if ((req.url === "/pair" && origin !== localOrigin) || (req.url === "/ask" && origin !== APP_ORIGIN)) return send(403, { error: "Origin denied" });
    if (!String(req.headers["content-type"]).startsWith("application/json")) return send(415, { error: "JSON required" });
    let raw = ""; try { for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 24000) return send(413, { error: "Question too large" }); } } catch { return; }
    let input; try { input = JSON.parse(raw); } catch { return send(400, { error: "Invalid JSON" }); }
    if (req.url === "/pair") { if (!nonces.has(input.nonce) || nonces.get(input.nonce) < now()) return send(403, { error: "Pairing expired" }); nonces.delete(input.nonce); token = randomBytes(32).toString("hex"); expires = now() + 8 * 60 * 60 * 1000; return send(200, { token }); }
    const supplied = String(req.headers.authorization ?? "").replace(/^Bearer /, "");
    if (now() >= expires || supplied.length !== token.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) return send(401, { error: "Connect the desktop assistant again." });
    if (busy) return send(409, { error: "The assistant is answering another question. Please wait." });
    try { input = boundedQuestion(input); } catch (error) { return send(400, { error: error.message }); }
    busy = true; const controller = new AbortController(); res.on("close", () => { if (!res.writableEnded) controller.abort(); });
    try { send(200, await answer(input, controller.signal)); } catch (error) { if (!res.destroyed) send(503, { error: error.message }); } finally { busy = false; }
  }); server.requestTimeout = 150000; return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const executable = process.argv[2]; if (!executable?.endsWith(".exe")) throw new Error("Pass the installed Codex executable path.");
  createAssistantBridge({ answer: (input, signal) => answerWithCodex({ executable, cwd: process.cwd(), input, signal }) }).listen(BRIDGE_PORT, "127.0.0.1", () => console.log("BIMLog assistant ready on loopback port 8798. No background polling or scheduled work."));
}
