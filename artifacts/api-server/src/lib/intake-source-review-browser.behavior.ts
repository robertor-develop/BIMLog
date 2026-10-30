import {normalizeJobIntakeData,jobIntakeCompletion,previewSmartIntakeMapping} from './job-intake-contract';
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import express from 'express';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.INTAKE_SOURCE_REVIEW_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let failedRead=false,historyFails=true,patches=0,histories=0;let rows=[{id:7,projectId:91,viewpointId:'fixture-vp',displayId:'HV-001',note:'Fixture original note',trade:'HVAC',floor:'1',priority:3,status:'open',lifecycleStatus:'active',revisionNumber:1,capturedAt:'2026-10-01T00:00:00Z'}];
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/projects/91/intake?stage=documents&resume=prerequisite')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[{id:91,role:'project_admin'}]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/clash-reports',(_req,res)=>res.json([]));
app.get('/api/v1/projects/:id/clash-reports/lens-pull',(_req,res)=>{if(failedRead){res.status(503).json({error:'fixture unavailable'});return;}res.json({success:true,viewpoints:rows});});


let mode='good',reads=0,previews=0,applies=0,removals=0,uploads=0,saves=0,failRemovalRead=false;
const capabilities={package:false,budget:false,contracts:false,costValuePlanner:false,anyCommercial:false,fullCommercialActivation:false};
let data=normalizeJobIntakeData({identity:{jobName:'Fixture source intake',jobCode:'SRC',clientName:'Fixture client',currency:'USD'}});
const document={id:'document-one',fileId:99,fileName:'retained-source.csv',fileType:'text/csv',category:'takeoff',sourceHash:'a'.repeat(64),extractionStatus:'structured_preview',extractionSummary:{sheets:[{name:'Sheet1',rowCount:3,columnCount:2,rows:[['Name','Quantity'],['Drawing','12'],['Review','4']]}]},removedAt:null as string|null};
let revision=1;const events:any[]=[];const payload=(pid=91)=>{const completion=jobIntakeCompletion(data,[document],capabilities);return{id:'fixture-intake',project:{id:pid,name:'Fixture Project',code:'FIX'},status:'draft',revision,data,completion,activationConfirmation:{revision,fingerprint:completion.fingerprint,ready:completion.ready},capabilities,documents:[document],events,members:[],assignmentEligibility:{eligible:[],excluded:[]},activation:null,activationMode:null,activationSummary:{},activatedContractId:null};};
app.get('/api/v1/master-catalogs/clients',(_req,res)=>res.json({governed:false,entries:[]}));
app.get('/api/v1/master-catalogs/:kind',(_req,res)=>res.json({governed:false,entries:[]}));
app.get('/api/v1/company/delivery-workflows/options',(_req,res)=>res.json({mode:'defaults_allowed',options:[]}));
app.get('/api/v1/projects/:id/directory',(_req,res)=>res.json([]));
app.get('/api/v1/projects/:id/intake',(req,res)=>{reads++;if(failRemovalRead){failRemovalRead=false;res.status(503).json({error:{en:'Task-local saved read unavailable'}});return;}res.json(payload(Number(req.params.id)));});
app.put('/api/v1/projects/:id/intake',(req,res)=>{saves++;data=normalizeJobIntakeData(req.body.data);revision++;res.json(payload(Number(req.params.id)));});
app.post('/api/v1/projects/:id/intake/documents',async(_req,res)=>{uploads++;document.removedAt=null;revision++;res.status(201).json({revision,documentId:document.id});});
app.post('/api/v1/projects/:id/intake/documents/:doc/mapping-preview',async(req,res)=>{previews++;const captured=mode;if(captured==='slow')await new Promise(r=>setTimeout(r,600));const preview=previewSmartIntakeMapping({documentId:document.id,sourceHash:document.sourceHash,fileName:document.fileName,sheets:document.extractionSummary.sheets,...req.body});res.json({...preview,documentId:captured==='wrongsource'?'other':document.id});});
app.post('/api/v1/projects/:id/intake/documents/:doc/mapping-apply',(req,res)=>{applies++;data=normalizeJobIntakeData({...data,scopeItems:[{id:'mapped-one',name:'Drawing',quantity:'12',plannedHours:'12',unit:'Drawings',contractId:'PRIMARY'}]});revision++;events.unshift({eventType:'contract_items_imported',afterRevision:revision,evidence:{documentId:document.id,sourceHash:document.sourceHash,mappingFingerprint:req.body.mappingFingerprint}});res.json(payload(Number(req.params.id)));});
app.delete('/api/v1/projects/:id/intake/documents/:doc',(req,res)=>{removals++;document.removedAt=new Date().toISOString();revision++;events.unshift({eventType:'source_document_removed',afterRevision:revision,evidence:{documentId:document.id,sourceHash:document.sourceHash}});failRemovalRead=true;res.json({revision});});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3198,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-intake-source-review-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9408',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3198/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let reportResult:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9408/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3198'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}; runtimeErrors=${JSON.stringify(runtimeErrors)}: ${await evaluate("document.body?.innerText??''")}`);};




 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('retained-source.csv');
 const click=async(text:string,double=false)=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled);if(!b)throw Error('Missing '+${JSON.stringify(text)});b.click();${double?'b.click();':''}})()`);await delay(180);};
 await click('Inspect & map Contract Items');mode='wrongsource';await click('Preview mapped rows');await wait('Mapping evidence does not match');assert.equal(applies,0);
 mode='good';const before=previews;await click('Preview mapped rows',true);await wait('2 valid rows');assert.equal(previews,before+1);assert.equal(await evaluate("document.querySelector('.ji-preview').innerText.includes('12')"),true);
 await click('Confirm and append to draft',true);await wait('2 Contract Items imported and saved.');assert.equal(applies,1);await cdp('Page.reload',{ignoreCache:true});await wait('retained-source.csv');assert.equal(data.scopeItems[0].name,'Drawing');
 await click('Remove document');assert.equal(removals,0);await click('Keep document');assert.equal(removals,0);await click('Remove document');await click('Confirm removal of this exact source',true);await wait('Task-local saved read unavailable');assert.equal(removals,1);await click('Retry removal verification',true);for(let i=0;i<50;i++){if(!(await evaluate("document.body.innerText.includes('retained-source.csv')")))break;await delay(100);}assert.equal(removals,1);assert.ok(document.removedAt);
 const uploadPath=path.join(output,'fixture-source.csv');fs.writeFileSync(uploadPath,'Name,Quantity\\nDrawing,12\\n');await cdp('DOM.enable');const dom=await cdp('DOM.getDocument');const input=await cdp('DOM.querySelector',{nodeId:dom.result.root.nodeId,selector:'input[type=file][name=file]'});await cdp('DOM.setFileInputFiles',{nodeId:input.result.nodeId,files:[uploadPath]});await click('Upload',true);await wait('Source document preserved and indexed.');assert.equal(uploads,1);
 await click('Inspect & map Contract Items');mode='slow';await click('Preview mapped rows');await cdp('Page.navigate',{url:'http://127.0.0.1:3198/projects/92/intake?stage=documents&resume=prerequisite'});await delay(900);mode='good';await wait('retained-source.csv');assert.equal(await evaluate("document.querySelector('.ji-preview')===null"),true);
 await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await wait('Documentos fuente (opcional)');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'intake-source-mobile.png'),Buffer.from(screenshot.result.data,'base64'));
 await cdp('Page.navigate',{url:'http://127.0.0.1:3198/all-tools'});await evaluate("localStorage.setItem('bimlog-lang','en')");await cdp('Page.reload',{ignoreCache:true});await wait('Search tools, tasks, and purposes');await evaluate("(()=>{const i=document.querySelector('#all-tools-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Intake Sources and Mapping');i.dispatchEvent(new Event('input',{bubbles:true}));})()");await delay(150);assert.equal(await evaluate("document.body.innerText.includes('Intake Sources and Mapping')"),true);assert.deepEqual(runtimeErrors,[]);
 reportResult={suite:'intake-source-local-browser',fixtureOnly:true,actualFullWorkspace:true,wrongMappingSourceRefused:true,exactPreviewAndDoubleOneApply:true,refreshReopen:true,explicitRemovalKeepCancel:true,removalGETOnlyReceiptRetry:true,doubleOneUpload:true,scopeAbortNoStalePreview:true,spanish390NoOverflow:true,allToolsDiscoverable:true,reads,previews,applies,removals,uploads,saves,runtimeErrors};

}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-intake-source-review-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(5000);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});}catch(error){const cleanup=spawnSync('powershell.exe',['-NoProfile','-Command','Remove-Item -LiteralPath $env:BIMLOG_OWNED_PROFILE -Recurse -Force -ErrorAction Stop'],{env:{...process.env,BIMLOG_OWNED_PROFILE:profile},windowsHide:true});assert.equal(cleanup.status,0);assert.equal(fs.existsSync(profile),false);}
}
fs.writeFileSync(path.join(output,'intake-source-review-local-browser.json'),`${JSON.stringify(reportResult,null,2)}\n`);console.log(JSON.stringify(reportResult,null,2));





