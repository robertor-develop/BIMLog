import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const playwrightCore = process.env.BIMLOG_PLAYWRIGHT_CORE;
const chromiumExecutable = process.env.BIMLOG_CHROMIUM_EXECUTABLE;
const output = process.env.BIMLOG_WORKFLOW_EVIDENCE_OUTPUT;
if (!playwrightCore || !chromiumExecutable || !output ||
  !path.resolve(output).toUpperCase().startsWith("F:\\BIMLOG\\TESTPROOF\\"))
  throw new Error("Workflow browser evidence requires installed Chrome and a disposable F:/BIMLog/TestProof output.");
const { chromium } = (await import(pathToFileURL(playwrightCore).href)).default;
const origin = process.env.BIMLOG_WORKFLOW_BROWSER_URL ?? "http://127.0.0.1:4183";
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless:true, executablePath:chromiumExecutable });
const results = [];
const initialDefinition = { schemaVersion:1,deliverableTypes:["SLEEVE"],
  roles:{ execute:"PRODUCER",review:"REVIEWER",approve:"APPROVER" },
  phases:[{ id:"production",code:"PRODUCTION",name:"Production",order:1,
    tasks:[{ id:"produce",code:"PRODUCE",name:"Prepare deliverable",order:1,requiredDocuments:[] }],
    completionRule:"all_tasks_complete",qcRequired:false,approvalRequired:false }],
  transitions:[],reopen:{ role:"approve",reasonRequired:true } };
const source = { versionId:"apu-v1",name:"Sleeve APU",version:1,currency:"USD",
  provenance:{ definition:{ economicAllocation:{ directProductionNodeIds:["labor"],phases:[
    { phaseId:"pre",code:"PRE",name:"Preliminary",percent:"45.00" },
    { phaseId:"record",code:"RECORD",name:"For Record",percent:"55.00" },
  ] } } } };
async function scenario(width, language, mode) {
  const context = await browser.newContext({ viewport:{ width,height:900 } });
  await context.addInitScript(({ language }) => {
    const token = `fixture.${btoa(JSON.stringify({ exp:Math.floor(Date.now()/1000)+3600, iat:Math.floor(Date.now()/1000) }))}.fixture`;
    localStorage.setItem("bimlog-auth",JSON.stringify({ state:{ token,
      user:{ id:7,firstName:"Test",lastName:"PMO",email:"fixture@example.invalid" } },version:1 }));
    localStorage.setItem("bimlog-lang",language);
  },{ language });
  let version = { templateId:"workflow-1",code:"SLEEVE",name:"Sleeve Standard",
    versionId:"workflow-v1",version:1,state:mode === "read-only" ? "published" : "draft",
    revision:1,definition:structuredClone(initialDefinition),fingerprint:null };
  const failures = [];
  const page = await context.newPage();
  page.on("pageerror",error => failures.push(error.message));
  page.on("requestfailed",request => {
    if (request.url().includes("/api/v1/company/")) failures.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  await context.route("**/api/v1/**", async route => {
    const request = route.request(), pathname = new URL(request.url()).pathname, method = request.method();
    const respond = (body,status=200) => route.fulfill({ status,contentType:"application/json",body:JSON.stringify(body) });
    if (pathname === "/api/v1/auth/access-profile") return respond({
      facts:{ authenticated:true,isSuperAdmin:false,canAccessLivingBrief:false,isCompanyPmo:mode !== "read-only",isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[] },
      decisions:{ company_workflows:{ allow:true,code:"COMPANY_MEMBER" } },
    });
    if (pathname === "/api/v1/company/delivery-workflows" && method === "GET") {
      if (mode === "denied") return respond({ code:"FORBIDDEN" },403);
      return respond({ canManage:mode !== "read-only",versions:mode === "empty" ? [] :
        [{ id:"workflow-1",code:"SLEEVE",name:"Sleeve Standard",versionId:version.versionId,
          version:version.version,state:version.state }] });
    }
    if (pathname === "/api/v1/company/delivery-workflows/options") return respond({ mode:"default_first",options:[] });
    if (pathname === "/api/v1/company/pricing-templates/options")
      return respond({ options:mode === "no-apu" ? [] : [source] });
    if (pathname === "/api/v1/company/delivery-workflows/workflow-1" && method === "GET")
      return respond({ versions:[version],history:[] });
    if (pathname === "/api/v1/company/delivery-workflows/preview" && method === "POST") {
      const definition = request.postDataJSON().definition;
      if (!definition.phases[0].code.trim()) return respond({ code:"WORKFLOW_TEXT_INVALID",field:"phases[0].code" },400);
      if (definition.economicAllocation && (definition.phases.length !== 2 ||
        definition.phases[0].id !== "pre" || definition.phases[1].id !== "record"))
        return respond({ code:"WORKFLOW_ALLOCATION_PHASE_MISMATCH" },409);
      return respond({ fingerprint:"f".repeat(64),phaseCount:definition.phases.length,
        taskCount:definition.phases.reduce((n,phase) => n+phase.tasks.length,0),
        allocation:definition.economicAllocation ? { currency:"USD",directProductionAmount:"1000.00",
          method:definition.economicAllocation.proposal.method,fingerprint:"a".repeat(64),
          rows:[{ phaseId:"pre",name:"Preliminary",apuDefaultPercent:"45.00",workflowPercent:"45.00",
            deltaPercent:"0.00",deltaDirection:0,amount:"450.00" },
            { phaseId:"record",name:"For Record",apuDefaultPercent:"55.00",workflowPercent:"55.00",
              deltaPercent:"0.00",deltaDirection:0,amount:"550.00" }] } : null });
    }
    if (pathname === "/api/v1/company/delivery-workflows/workflow-1/versions/workflow-v1" && method === "PATCH") {
      const body = request.postDataJSON();
      version = { ...version,revision:version.revision+1,definition:body.definition };
      return respond({ version });
    }
    if (pathname === "/api/v1/company/master-catalogs/capabilities") return respond({ canManage:mode !== "read-only" });
    if (pathname === "/api/v1/projects") return respond([]);
    if (pathname === "/api/v1/notifications") return respond([]);
    if (pathname === "/api/v1/living-brief/eligibility") return respond({ eligible:false });
    if (pathname === "/api/v1/users/me/company-profile") return respond({ companyName:"Fixture Company" });
    if (pathname.endsWith("/me")) return respond({ id:7,firstName:"Test",lastName:"PMO",isSuperAdmin:false });
    return respond({});
  });
  await page.goto(`${origin}/company-workflows`,{ waitUntil:"domcontentloaded",timeout:30000 });
  const es = language === "es";
  if (mode === "denied") await page.getByRole("alert").waitFor();
  else if (mode === "empty") await page.getByText(es ? /No hay flujos de empresa/ : /No company workflow has been created/).waitFor();
  else {
    await page.getByLabel(es ? "Plantilla de empresa" : "Company template").selectOption("workflow-1");
    await page.getByRole("heading",{ name:/Sleeve Standard/ }).waitFor();
    if (mode === "read-only") assert.equal(await page.getByText(es ? "Editar definición borrador" : "Edit draft definition").count(),0);
    else {
      const economic = page.getByRole("group",{ name:es ? "Asignación económica (opcional)" : "Economic allocation (optional)" });
      if (mode === "no-apu") await economic.getByText(es ? /No hay un APU publicado/ : /No published company APU/).waitFor();
      else {
        const phaseName = page.getByLabel(es ? "Nombre de fase" : "Phase name", { exact:true }).first();
        await phaseName.fill("UNSAVED TEST PHASE");
        const template = page.getByLabel(es ? "Plantilla de empresa" : "Company template");
        await template.selectOption("");
        await page.getByRole("alertdialog").getByRole("button", { name:es ? "Seguir editando" : "Keep editing" }).click();
        assert.equal(await phaseName.inputValue(), "UNSAVED TEST PHASE");
        assert.equal(await template.inputValue(), "workflow-1");
        await template.selectOption("");
        await page.keyboard.press("Escape");
        assert.equal(await phaseName.inputValue(), "UNSAVED TEST PHASE");
        await template.selectOption("");
        await page.getByRole("alertdialog").getByRole("button", { name:es ? "Descartar y cambiar" : "Discard and switch" }).click();
        await template.selectOption("workflow-1");
        await page.getByRole("heading",{ name:/Sleeve Standard/ }).waitFor();
        assert.equal(await phaseName.inputValue(), "Production");
        const phaseCode = page.getByLabel(es ? "Código de fase" : "Phase code", { exact:true }).first();
        await phaseCode.fill("");
        await page.getByRole("button", { name:es ? "Validar y previsualizar" : "Validate and preview" }).click();
        await page.getByRole("alert").filter({ hasText:es ? "Fase 1 · Código: Complete" : "Phase 1 · Code: Complete" }).waitFor();
        assert.equal(await page.getByRole("button", { name:es ? "Guardar borrador" : "Save draft" }).isDisabled(), true);
        await page.getByRole("button", { name:es ? "Cerrar mensaje" : "Dismiss message" }).click();
        assert.equal(await phaseCode.inputValue(), "");
        await phaseCode.fill("PRODUCTION");
        await economic.getByLabel(es ? "APU Comercial publicado" : "Published Commercial APU").selectOption("apu-v1");
        await economic.getByRole("button",{ name:es ? "Aplicar fases predeterminadas del APU al borrador" : "Apply APU default phases to draft" }).click();
        await page.getByRole("alertdialog").getByRole("button", { name:es ? "Conservar fases actuales" : "Keep current phases" }).click();
        assert.equal(await page.getByLabel(es ? "Código de fase" : "Phase code", { exact:true }).first().inputValue(), "PRODUCTION");
        await economic.getByRole("button",{ name:es ? "Aplicar fases predeterminadas del APU al borrador" : "Apply APU default phases to draft" }).click();
        await page.getByRole("alertdialog").getByRole("button", { name:es ? "Aplicar fases del APU" : "Apply APU phases", exact:true }).click();
        await page.getByRole("alertdialog").waitFor({ state:"hidden" });
        await page.screenshot({ path:path.join(output,`${width}-${language}-after-alignment.png`), fullPage:true });
        fs.writeFileSync(path.join(output,`${width}-${language}-after-alignment.txt`), await page.locator("body").innerText());
        await economic.getByText(/Preliminary 45.00%/).waitFor();
        await page.getByRole("button",{ name:es ? "Validar y previsualizar" : "Validate and preview" }).click();
        await page.getByText(es ? "Distribucion de produccion directa" : "Direct Production allocation").waitFor();
        await page.getByText(/450.00 USD/).waitFor();
        await page.getByRole("button",{ name:es ? "Guardar borrador" : "Save draft" }).click();
        await page.reload({ waitUntil:"domcontentloaded" });
        await page.getByLabel(es ? "Plantilla de empresa" : "Company template").selectOption("workflow-1");
        assert.equal(await economic.getByLabel(es ? "APU Comercial publicado" : "Published Commercial APU").inputValue(),"apu-v1");
        await economic.getByLabel(es ? "Método de asignación" : "Allocation method").selectOption("custom");
        await economic.getByLabel(es ? "Motivo para aprobacion financiera" : "Reason for Finance approval").fill("Fixture rationale");
        await economic.scrollIntoViewIfNeeded();
        await page.mouse.move(width-20,880);
        await page.screenshot({ path:path.join(output,`${width}-${language}-economic.png`) });
      }
    }
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow <= 1,`${width}px ${language} ${mode}: horizontal overflow ${overflow}`);
  assert.deepEqual(failures,[],`${width}px ${language} ${mode}: browser errors`);
  results.push({ width,language,mode,overflow });
  await context.close();
}
try {
  for (const width of [1280,390]) for (const language of ["en","es"])
    for (const mode of ["pmo","read-only","no-apu","empty","denied"])
      await scenario(width,language,mode);
  fs.writeFileSync(path.join(output,"results.json"),JSON.stringify({ status:"PASS",fixture:true,scenarios:results },null,2));
  console.log(JSON.stringify({ status:"PASS",scenarios:results.length,output },null,2));
} finally { await browser.close(); }
