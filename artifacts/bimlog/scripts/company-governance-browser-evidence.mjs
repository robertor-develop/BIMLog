import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const core=process.env.BIMLOG_PLAYWRIGHT_CORE;
const executable=process.env.BIMLOG_CHROMIUM_EXECUTABLE;
const output=process.env.BIMLOG_GOVERNANCE_EVIDENCE_OUTPUT;
if (!core || !executable || !output || !path.resolve(output).toUpperCase().startsWith("F:\\BIMLOG\\TESTPROOF\\"))
  throw new Error("Governance browser evidence requires local Chrome and an F:/BIMLog/TestProof output.");
const { chromium }=(await import(pathToFileURL(core).href)).default;
const origin=process.env.BIMLOG_GOVERNANCE_BROWSER_URL ?? "http://127.0.0.1:4183";
fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:executable});
const approvals=["create_work_item","complete_phase","complete_deliverable","economic_change","template_update","activate_version"];
const changes=["edit_phases","edit_tasks_roles","edit_allocation","change_apu","edit_approved_work_item","retire_version"];
const definition=()=>({schemaVersion:1,scope:{allWorkflows:false,workflowTemplateIds:["workflow-1"]},
  approvalRules:approvals.map(action=>({action,roles:["PROJECT_MANAGER"],threshold:action==="economic_change"?{currency:"USD",amountMinor:2500000}:null})),
  changeRules:changes.map(action=>({action,allowed:true,requiresReapproval:true,requiresNewVersion:["edit_phases","change_apu"].includes(action)})),
  versioning:{lockActivatedSnapshot:true,structuralChangeCreatesVersion:true,preserveHistory:true},
  permissions:[{role:"PROJECT_MANAGER",actions:["view","edit_draft","approve","publish","manage"]}],
  validation:{allocation_total_100:true,task_execute_role:true,phase_review_role:true,final_approval:true,
    required_documents:true,valid_apu:true,unique_phase_codes:true}});
const results=[];
async function scenario(width,language,mode){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(({language})=>{
    const token=`fixture.${btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000)}))}.fixture`;
    localStorage.setItem("bimlog-auth",JSON.stringify({state:{token,
      user:{id:7,firstName:"Test",lastName:"PMO",email:"fixture@example.invalid"}},version:1}));
    localStorage.setItem("bimlog-lang",language);
  },{language});
  const page=await context.newPage();
  const failures=[];
  page.on("pageerror",error=>failures.push(error.message));
  page.on("requestfailed",request=>{if(request.url().includes("/api/v1/company/")) failures.push(request.failure()?.errorText ?? "failed request");});
  let version={policyId:"policy-1",code:"SHOP_GOV",name:"Shop Governance",versionId:"policy-v1",
    version:1,revision:1,state:mode==="read-only"?"published":"draft",definition:definition(),fingerprint:null,
    reviewEligibility:{eligible:false,code:"WORKFLOW_POLICY_INDEPENDENT_CHECKER_REQUIRED"}};
  let history=[];
  let detailReads=0;
  await context.route("**/api/v1/**",async route=>{
    const request=route.request(),pathname=new URL(request.url()).pathname,method=request.method();
    const respond=(body,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
    if(pathname==="/api/v1/auth/access-profile") return respond({facts:{authenticated:true,isSuperAdmin:false,isCompanyPmo:mode!=="read-only",activeProjectRoles:[],activeProjects:[]},decisions:{company_workflows:{allow:true,code:"COMPANY_MEMBER"}}});
    if(pathname==="/api/v1/company/workflow-governance-policies" && method==="GET"){
      if(mode==="loading") return new Promise(()=>undefined);
      if(mode==="denied") return respond({code:"WORKFLOW_POLICY_PMO_REQUIRED"},403);
      return respond({canManage:mode!=="read-only",versions:mode==="empty"?[]:
        [{id:"policy-1",code:version.code,name:version.name,versionId:version.versionId,
          version:version.version,revision:version.revision,state:version.state,fingerprint:version.fingerprint}]});
    }
    if(pathname==="/api/v1/company/delivery-workflows" && method==="GET"){
      if(mode==="error") return respond({code:"WORKFLOW_LIST_FAILED"},500);
      return respond({versions:[{id:"workflow-1",code:"SLEEVE",name:"Sleeve",state:"published"}]});
    }
    if(pathname==="/api/v1/company/workflow-governance-policies/policy-1" && method==="GET") {
      detailReads++;
      return respond({versions:[version],history});
    }
    if(pathname==="/api/v1/company/workflow-governance-policies/policy-1/versions/policy-v1" && method==="PATCH"){
      const body=request.postDataJSON(); if(body.expectedRevision!==version.revision) return respond({code:"WORKFLOW_POLICY_NOT_DRAFT_OR_STALE"},409);
      version={...version,revision:version.revision+1,definition:body.definition};
      history=[...history,{versionId:version.versionId,action:"edited",actorId:7,createdAt:new Date().toISOString(),details:{revision:version.revision}}];
      return respond({version});
    }
    if(pathname==="/api/v1/company/master-catalogs/capabilities") return respond({canManage:mode!=="read-only"});
    if(pathname==="/api/v1/projects") return respond([]);
    if(pathname==="/api/v1/notifications") return respond([]);
    if(pathname==="/api/v1/living-brief/eligibility") return respond({eligible:false});
    if(pathname==="/api/v1/users/me/company-profile") return respond({companyName:"Fixture Company"});
    if(pathname.endsWith("/me")) return respond({id:7,firstName:"Test",lastName:"PMO",isSuperAdmin:false});
    return respond({});
  });
  await page.goto(`${origin}/company-workflow-governance`,{waitUntil:"domcontentloaded",timeout:30000});
  const es=language==="es";
  await page.getByRole("heading",{name:es?"Políticas de gobernanza":"Governance Policies"}).waitFor();
  if(mode==="loading") await page.getByText(es?"Cargando políticas...":"Loading policies...").waitFor();
  else if(mode==="denied"){
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator(".wgp-editor").count(),0,"denied screen must not render a policy editor");
  } else if(mode==="error"){
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator(".wgp-editor").count(),0,"failed workflow list must not render an editor");
  } else if(mode==="empty"){
    await page.getByText(es?"No hay políticas publicadas disponibles.":"No published policies are available.").waitFor();
    assert.equal(await page.getByRole("button",{name:es?"Nueva política":"New policy"}).count(),1);
  } else {
    await page.getByRole("button",{name:/Shop Governance SHOP_GOV/}).click();
    await page.getByRole("heading",{name:"Shop Governance"}).waitFor();
    const threshold=page.getByLabel(`${es?"Cambio económico":"Economic change"} threshold`);
    if(mode==="read-only"){
      assert.equal(await page.getByRole("button",{name:es?"Guardar borrador":"Save draft"}).count(),0);
      assert.equal(await threshold.isDisabled(),true);
    } else {
      assert.equal(await page.getByRole("button",{name:es?"Aprobar con verificador financiero":"Approve with Finance checker"}).isDisabled(),true);
      await page.getByText(es?"Otro administrador PMO de la empresa debe revisar este borrador. Quien lo creó o editó por última vez no puede aprobarlo.":"A different company PMO administrator must review this draft. Its creator and latest editor cannot approve it.").waitFor();
      assert.equal(await threshold.inputValue(),"2500000");
      await threshold.fill("2800000");
      await page.locator(".wgp-dirty").waitFor();
      assert.equal(detailReads,1,"selection must not trigger a second effect load that discards edits");
      await page.getByRole("button",{name:es?"Descartar cambios":"Discard changes"}).click();
      assert.equal(await threshold.inputValue(),"2500000");
      await threshold.fill("3000000");
      await page.getByRole("button",{name:es?"Guardar borrador":"Save draft"}).click();
      await page.locator(".wgp-notice").waitFor();
      assert.equal(version.definition.approvalRules[3].threshold.amountMinor,3000000,"PATCH must persist the edited amount");
      await page.reload({waitUntil:"domcontentloaded"});
      await page.getByRole("button",{name:/Shop Governance SHOP_GOV/}).click();
      await page.waitForFunction((name)=>document.querySelector(`input[aria-label="${name}"]`)?.value==="3000000",
        `${es?"Cambio económico":"Economic change"} threshold`);
    }
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  const mainOverflow=await page.evaluate(()=>{const node=document.querySelector(".wgp-main");return node ? node.scrollWidth-node.clientWidth : 0;});
  if(mainOverflow>1) console.log(JSON.stringify({width,language,mode,overflow:mainOverflow,
    offenders:await page.evaluate(()=>{const main=document.querySelector(".wgp-main"),edge=main?.getBoundingClientRect().right??0;
      return [...document.querySelectorAll(".wgp-main *")].map(node=>({tag:node.tagName,className:String(node.className),right:Math.round(node.getBoundingClientRect().right),scrollWidth:node.scrollWidth,clientWidth:node.clientWidth}))
        .filter(row=>row.right>edge+1).slice(0,12);})}));
  assert.ok(overflow<=1,`${width}px ${language} ${mode}: horizontal overflow ${overflow}`);
  assert.ok(mainOverflow<=1,`${width}px ${language} ${mode}: main-panel horizontal overflow ${mainOverflow}`);
  assert.deepEqual(failures,[],`${width}px ${language} ${mode}: browser errors`);
  await page.screenshot({path:path.join(output,`${width}-${language}-${mode}.png`),fullPage:true});
  results.push({width,language,mode,overflow,mainOverflow});
  await context.close();
}
try{
  for(const width of [1280,390]) for(const language of ["en","es"])
    for(const mode of ["pmo","read-only","empty","denied","error","loading"]) await scenario(width,language,mode);
  fs.writeFileSync(path.join(output,"results.json"),JSON.stringify({status:"PASS",fixture:true,scenarios:results},null,2));
  console.log(JSON.stringify({status:"PASS",scenarios:results.length,output},null,2));
} finally { await browser.close(); }
