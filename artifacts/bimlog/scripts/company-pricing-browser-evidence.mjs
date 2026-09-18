import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightCore = process.env.BIMLOG_PLAYWRIGHT_CORE;
const chromiumExecutable = process.env.BIMLOG_CHROMIUM_EXECUTABLE;
if (!playwrightCore || !chromiumExecutable) throw new Error("Browser runtime paths are required.");
const { chromium } = (await import(pathToFileURL(playwrightCore).href)).default;
const origin = process.env.BIMLOG_PRICING_BROWSER_URL ?? "http://127.0.0.1:4183";
const output = path.resolve(process.env.BIMLOG_PRICING_EVIDENCE_OUTPUT ?? "evidence/block09-company-pricing-browser");
fs.mkdirSync(output, { recursive: true });

const initialDefinition = { schemaVersion: 1, currency: "USD", industry: "BIM Services", name: "Shop Drawing", nodes: [{ id: "labor", label: "Labor", method: "hours_hourly_rate", hours: "2", hourlyRate: "50" }] };
const version = { templateId: "template-1", versionId: "version-1", version: 1, status: "draft", provenance: { code: "SHOP", definition: initialDefinition } };
const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable });
const results = [];

async function scenario({ width, language, mode }) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addInitScript(({ language }) => {
    localStorage.setItem("bimlog-auth", JSON.stringify({ state: { token: "browser-fixture-token", user: { id: 7, firstName: "Test", lastName: "PMO", email: "fixture@example.invalid" } }, version: 0 }));
    localStorage.setItem("bimlog-lang", language);
  }, { language });
  let current = { ...structuredClone(version), status: mode === "published" ? "published" : "draft" };
  const failures = [];
  await context.route("**/api/v1/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();
    const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (pathname === "/api/v1/company/pricing-templates" && method === "GET") {
      if (mode === "denied") return respond({ code: "FORBIDDEN" }, 403);
      if (mode === "loading") return new Promise(() => {});
      return respond({ canManage: mode === "pmo" || mode === "published", templates: mode === "empty" ? [] : [current] });
    }
    if (pathname === "/api/v1/company/pricing-templates/template-1" && method === "GET") return respond({ versions: [current] });
    if (pathname === "/api/v1/company/pricing-templates/preview" && method === "POST") return respond({ total: "100.00", currency: "USD", lines: [{ id: "labor" }] });
    if (pathname === "/api/v1/company/pricing-templates/template-1/versions" && method === "POST") {
      const body = request.postDataJSON();
      current = { ...current, version: 2, versionId: "version-2", provenance: { ...current.provenance, definition: body.definition } };
      return respond({ version: current });
    }
    if (pathname === "/api/v1/company/pricing-templates/template-1/retire" && method === "POST") {
      current = { ...current, version: 2, versionId: "version-2", status: "retired" };
      return respond({ version: current });
    }
    if (pathname === "/api/v1/company/master-catalogs/capabilities") return respond({ canManage: mode === "pmo" });
    if (pathname === "/api/v1/projects") return respond([]);
    if (pathname === "/api/v1/notifications") return respond([]);
    if (pathname === "/api/v1/living-brief/eligibility") return respond({ eligible: false });
    if (pathname === "/api/v1/users/me/company-profile") return respond({ companyName: "Fixture Company" });
    if (pathname.endsWith("/me")) return respond({ id: 7, firstName: "Test", lastName: "PMO", isSuperAdmin: false });
    return respond({});
  });
  const page = await context.newPage();
  page.on("pageerror", error => failures.push(error.message));
  page.on("requestfailed", request => { if (request.url().includes("/api/v1/company/pricing-templates")) failures.push(`${request.url()}: ${request.failure()?.errorText}`); });
  await page.goto(`${origin}/company-pricing-templates`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  const translated = language === "es";
  if (mode === "loading") await page.getByText(translated ? "Cargando plantillas de precios…" : "Loading pricing templates…").waitFor();
  else if (mode === "denied") {
    await page.getByRole("alert").getByText(translated ? "No tiene permiso de la empresa para ver las plantillas de precios." : "You do not have company permission to view pricing templates.").waitFor();
    assert.equal(await page.getByRole("region", { name: translated ? "Editor de plantilla" : "Template editor" }).count(), 0, "denial must not display editor data");
  }
  else if (mode === "empty") await page.getByText(translated ? "Todavía no hay plantillas de precios." : "No pricing templates yet.").waitFor();
  else await page.getByRole("button", { name: /SHOP · Shop Drawing/ }).waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 1, `${width}px ${language} ${mode}: horizontal overflow ${overflow}px`);
  if (width === 390) {
    const menu = await page.getByRole("button", { name: translated ? /Abrir navegación/ : /Open.*navigation/ }).boundingBox();
    const back = await page.getByRole("button", { name: translated ? "Volver a la Sede" : "Back to Headquarters" }).boundingBox();
    assert.ok(menu && back && back.y >= menu.y + menu.height, "mobile return action must not hide behind navigation control");
  }
  const file = `${width}-${language}-${mode}.png`;
  await page.screenshot({ path: path.join(output, file), fullPage: true });
  if (mode === "pmo") {
    await page.getByRole("button", { name: /SHOP · Shop Drawing/ }).click();
    await page.getByRole("button", { name: translated ? "Vista previa" : "Preview", exact: true }).click();
    await page.getByText(translated ? /Vista previa calculada: 100.00 USD/ : /Calculated preview: 100.00 USD/).waitFor();
    await page.getByLabel(translated ? "Nombre" : "Name", { exact: true }).first().fill("Revised Shop Drawing");
    assert.equal(await page.getByText(/Calculated preview:|Vista previa calculada:/).count(), 0, "stale preview must disappear after edit");
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("button", { name: translated ? "Nueva plantilla" : "New template" }).click();
    assert.equal(await page.getByLabel(translated ? "Nombre" : "Name", { exact: true }).first().inputValue(), "Revised Shop Drawing", "cancel must retain draft");
    page.once("dialog", dialog => dialog.dismiss());
    await page.getByRole("button", { name: translated ? "Volver a la Sede" : "Back to Headquarters" }).click();
    assert.ok(page.url().endsWith("/company-pricing-templates"), "cancel must prevent navigation away from unsaved changes");
    await page.getByLabel(translated ? "Motivo para el historial de auditoría" : "Reason for audit history").fill("Browser fixture correction");
    await page.getByRole("button", { name: translated ? "Guardar nueva versión borrador" : "Save new draft version" }).click();
    await page.getByText(translated ? "Nueva versión borrador guardada." : "New draft version saved.").waitFor();
    assert.equal(await page.getByLabel(translated ? "Nombre" : "Name", { exact: true }).first().inputValue(), "Revised Shop Drawing");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /SHOP · Revised Shop Drawing/ }).click();
    assert.equal(await page.getByLabel(translated ? "Nombre" : "Name", { exact: true }).first().inputValue(), "Revised Shop Drawing", "saved version must reopen after refresh");
    await page.getByLabel(translated ? "Nombre" : "Name", { exact: true }).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${width}-${language}-saved-reopened.png`) });
    const economic = page.getByRole("group", { name: translated ? "Fases predeterminadas de producción directa" : "Direct Production phase defaults" });
    await economic.getByRole("checkbox", { name: translated ? "Definir fases económicas predeterminadas" : "Define economic phase defaults" }).check();
    assert.equal(await economic.getByRole("checkbox", { name: /Labor \(labor\)/ }).isChecked(), true);
    await economic.getByRole("button", { name: translated ? "Agregar fase" : "Add phase" }).click();
    await economic.getByLabel(translated ? "Porcentaje" : "Percent").nth(0).fill("60.00");
    await economic.getByLabel(translated ? "Porcentaje" : "Percent").nth(1).fill("40.00");
    await economic.getByLabel(translated ? "Nombre" : "Name").nth(1).fill("For Record");
    await economic.getByLabel(translated ? "ID estable" : "Stable ID").nth(1).fill("record");
    await economic.getByLabel(translated ? "Código" : "Code").nth(1).fill("RECORD");
    await economic.getByText(translated ? "Total de asignación: 100.00%" : "Allocation total: 100.00%").waitFor();
    await page.getByLabel(translated ? "Motivo para el historial de auditoría" : "Reason for audit history").fill("Economic phase defaults fixture");
    await page.getByRole("button", { name: translated ? "Guardar nueva versión borrador" : "Save new draft version" }).click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /SHOP · Revised Shop Drawing/ }).click();
    assert.equal(await economic.getByRole("checkbox", { name: translated ? "Definir fases económicas predeterminadas" : "Define economic phase defaults" }).isChecked(), true);
    assert.equal(await economic.getByLabel(translated ? "Porcentaje" : "Percent").nth(1).inputValue(), "40.00");
    await economic.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${width}-${language}-economic-saved-reopened.png`) });
  }
  if (mode === "read-only") {
    await page.getByRole("button", { name: /SHOP · Shop Drawing/ }).click();
    assert.equal(await page.getByLabel(translated ? "Nombre" : "Name", { exact: true }).first().isDisabled(), true);
    assert.equal(await page.getByRole("button", { name: translated ? "Nueva plantilla" : "New template" }).isDisabled(), true);
    assert.equal(await page.getByRole("checkbox", { name: translated ? "Definir fases económicas predeterminadas" : "Define economic phase defaults" }).isDisabled(), true);
  }
  if (mode === "published") {
    await page.getByRole("button", { name: /SHOP · Shop Drawing/ }).click();
    await page.getByLabel(translated ? "Motivo para el historial de auditoría" : "Reason for audit history").fill("Controlled retirement fixture");
    await page.getByRole("button", { name: translated ? /Retirar \(requiere aprobación financiera\)/ : /Retire \(Finance approval required\)/ }).click();
    await page.getByRole("group", { name: translated ? "Confirmar retiro de plantilla" : "Confirm template retirement" }).waitFor();
    await page.getByRole("group", { name: translated ? "Confirmar retiro de plantilla" : "Confirm template retirement" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `${width}-${language}-retirement-confirm.png`) });
    await page.getByRole("button", { name: translated ? "Cancelar" : "Cancel", exact: true }).click();
    assert.equal(await page.getByRole("group", { name: translated ? "Confirmar retiro de plantilla" : "Confirm template retirement" }).count(), 0);
    await page.getByRole("button", { name: translated ? /Retirar \(requiere aprobación financiera\)/ : /Retire \(Finance approval required\)/ }).click();
    await page.getByRole("button", { name: translated ? "Confirmar retiro" : "Confirm retirement" }).click();
    await page.getByText(translated ? /Retirada en una nueva versión inmutable/ : /Retired in a new immutable version/).waitFor();
  }
  assert.deepEqual(failures, [], `${width}px ${language} ${mode}: browser errors`);
  results.push({ width, language, mode, screenshot: file, overflow });
  await context.close();
}

try {
  for (const width of [1280, 390]) for (const language of ["en", "es"]) for (const mode of ["pmo", "read-only", "denied", "empty", "loading", "published"]) await scenario({ width, language, mode });
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ status: "PASS", fixture: true, source: "production route and component with intercepted API", scenarios: results }, null, 2));
  console.log(JSON.stringify({ status: "PASS", scenarios: results.length, output }, null, 2));
} finally { await browser.close(); }
