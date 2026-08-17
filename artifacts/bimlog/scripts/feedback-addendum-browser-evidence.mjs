import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightCore = process.env.BIMLOG_PLAYWRIGHT_CORE;
const chromiumExecutable = process.env.BIMLOG_CHROMIUM_EXECUTABLE;
const baseUrl = process.env.BIMLOG_FEEDBACK_EVIDENCE_URL;
if (!playwrightCore || !chromiumExecutable || !baseUrl) throw new Error("Explicit Playwright, Chromium, and isolated URL bindings are required.");
const { chromium } = (await import(pathToFileURL(playwrightCore).href)).default;
const output = path.resolve("artifacts/bimlog/evidence/feedback-addendum-v-F-1.60.35.8"); mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable });
const chromiumVersion = await browser.version();
const assertions = [];

async function scenario(language, width, fileName) {
  const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 } });
  await context.addInitScript(({ language }) => {
    localStorage.setItem("bimlog-lang", language);
    localStorage.setItem("bimlog-auth", JSON.stringify({ state: { token: "local-browser-fixture", user: { id: 501, email: "fixture@example.invalid", fullName: "Local Fixture", isSuperAdmin: false } }, version: 0 }));
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => { throw new DOMException("fixture denied", "NotAllowedError"); },
      getDisplayMedia: async () => { throw new DOMException("fixture denied", "NotAllowedError"); },
    }});
    const fixture = { id: 801, stableId: "FB-EVIDENCE801", message: language === "es" ? "La captura conserva el contexto y la evidencia." : "Capture keeps context and evidence.", status: "verified", version: 3, dispositionReason: language === "es" ? "Verificado con evidencia local." : "Verified with local evidence.", targetRelease: "v F-1.60.35.8" };
    window.fetch = async (input, init = {}) => { const url = String(input); const method = String(init.method || "GET"); let body = {};
      if (url.endsWith("/api/v1/feedback") && method === "POST") body = { success: true, feedback: fixture };
      else if (url.includes("/assets") && method === "POST") body = { assets: [{ id: 901, scanState: "quarantined" }], scanner: "activation-required" };
      else if (url.endsWith("/api/v1/feedback/mine")) body = { feedback: [fixture] };
      else if (url.endsWith("/history")) body = { feedback: fixture, history: [{ id: 1, eventType: "created", createdAt: "2026-08-17T12:00:00.000Z" }, { id: 2, eventType: "triage_updated", reason: fixture.dispositionReason, createdAt: "2026-08-17T12:10:00.000Z" }] };
      else if (url.endsWith("/assets")) body = { assets: [{ id: 901, name: "field-note.txt", scanState: "quarantined", downloadUrl: null }] };
      else if (url.endsWith("/reopen") && method === "POST") body = { success: true, feedback: { ...fixture, status: "triaged", version: 4 } };
      else return new Response(JSON.stringify({ code: "FIXTURE_ROUTE_DENIED" }), { status: 403, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify(body), { status: method === "POST" ? 201 : 200, headers: { "Content-Type": "application/json" } }); };
  }, { language });
  const page = await context.newPage();
  const pageErrors = []; page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(`${baseUrl}/feedback-evidence`, { waitUntil: "networkidle" });
  const opener = page.getByRole("button", { name: language === "es" ? "Enviar comentarios a BIMLog" : "Send BIMLog feedback" });
  if (!await opener.count()) { await page.screenshot({ path: path.join(output, `diagnostic-${language}-${width}.png`), fullPage: true }); throw new Error(`${language}-${width}: feedback opener absent at ${page.url()} errors=${pageErrors.join(" | ")} body=${(await page.locator("body").innerText()).slice(0, 240)}`); }
  await opener.click();
  await page.getByRole("textbox").fill(language === "es" ? "La captura conserva el contexto y la evidencia." : "Capture keeps context and evidence.");
  await page.getByText(language === "es" ? "Grabar voz" : "Record voice").click();
  const micError = language === "es" ? "Se denegó el permiso del micrófono." : "Microphone permission was denied.";
  await page.getByText(micError).waitFor(); assertions.push(`${language}-${width}: microphone denial visible`);
  await page.getByText(language === "es" ? "Capturar pantalla" : "Capture screen").click();
  const captureError = language === "es" ? "Se canceló o denegó compartir pantalla. No se capturó nada." : "Screen sharing was cancelled or denied. Nothing was captured.";
  await page.getByText(captureError).waitFor(); assertions.push(`${language}-${width}: capture denial visible`);
  const input = page.locator('input[type="file"]');
  await input.setInputFiles({ name: "field-note.txt", mimeType: "text/plain", buffer: Buffer.from("bounded local fixture") });
  await page.getByText(/field-note\.txt/).waitFor(); assertions.push(`${language}-${width}: supported file visible`);
  await page.screenshot({ path: path.join(output, fileName), fullPage: true });
  const dialog = page.getByRole("dialog");
  const box = await dialog.boundingBox(); if (!box || box.x < 0 || box.x + box.width > width) throw new Error(`${language}-${width}: dialog overflow`);
  assertions.push(`${language}-${width}: dialog contained`);
  await page.getByRole("button", { name: language === "es" ? "Enviar" : "Send", exact: true }).click();
  await page.getByText(/FB-EVIDENCE801/).waitFor(); assertions.push(`${language}-${width}: successful governed submission visible`);
  await page.waitForTimeout(1000); await opener.click(); await page.getByRole("button", { name: language === "es" ? "Mis comentarios" : "My feedback" }).click();
  await page.getByText("FB-EVIDENCE801").waitFor(); await page.getByRole("button", { name: language === "es" ? "Historial" : "History" }).click();
  await page.getByText("triage_updated").waitFor(); await page.getByText(/field-note\.txt/).waitFor(); assertions.push(`${language}-${width}: customer backlog, history, decision, and quarantined attachment visible`);
  await page.screenshot({ path: path.join(output, fileName.replace(".png", "-backlog.png")), fullPage: true });
  await context.close();
}

await scenario("en", 1440, "feedback-en-desktop.png");
await scenario("es", 390, "feedback-es-390.png");
await browser.close();
const files = ["feedback-en-desktop.png", "feedback-en-desktop-backlog.png", "feedback-es-390.png", "feedback-es-390-backlog.png"].map(name => ({ name, sha256: createHash("sha256").update(readFileSync(path.join(output, name))).digest("hex") }));
writeFileSync(path.join(output, "manifest.json"), `${JSON.stringify({ label: "BIMLog — Feedback Addendum Remediation Writer", release: "v F-1.60.35.8", sourceCommit: process.env.BIMLOG_FEEDBACK_SOURCE_COMMIT || "uncommitted-follow-up", runtime: { playwrightCore: "1.55.0", chromium: chromiumVersion }, assertions, files, limits: "Actual production App and FeedbackWidget on an intentionally nonexistent isolated route, with local browser permission-denial and file fixtures; no API, DB, scanner, transcription provider, or customer integration claim." }, null, 2)}\n`);
console.log(`feedback browser evidence: ${assertions.length}/${assertions.length} passed`);
