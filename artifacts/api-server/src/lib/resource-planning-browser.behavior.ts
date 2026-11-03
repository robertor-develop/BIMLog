import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.RESOURCE_PLANNING_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let failedRead=false,historyFails=true,patches=0,histories=0;let rows=[{id:7,projectId:91,viewpointId:'fixture-vp',displayId:'HV-001',note:'Fixture original note',trade:'HVAC',floor:'1',priority:3,status:'open',lifecycleStatus:'active',revisionNumber:1,capturedAt:'2026-10-01T00:00:00Z'}];
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/projects/91/commercial/team-performance')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[{id:91,role:'project_admin'}]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/clash-reports',(_req,res)=>res.json([]));
app.get('/api/v1/projects/:id/clash-reports/lens-pull',(_req,res)=>{if(failedRead){res.status(503).json({error:'fixture unavailable'});return;}res.json({success:true,viewpoints:rows});});


let failRead=false,savePosts=0,profilePuts=0,applyPosts=0,evaluations=0;
const evaluation={people:[{userId:71,capacityHours:160,existingHours:8,scenarioHours:8,availableHours:152,utilization:.1,internalCost:null,billingValue:null,warnings:[]}],totals:{scenarioHours:8,internalCost:null,billingValue:null},warnings:[],decision:'review_required'};
const workspace:any={project:{id:91,code:'FIX',name:'Fixture Project'},canManage:true,canViewRates:false,canManageRates:false,members:[{id:71,name:'Fixture Admin',jobTitle:'Coordinator',role:'owner',profile:{id:'profile1',version:1,content:{weeklyCapacityHours:40,timezone:'America/New_York',workingDays:[1,2,3,4,5],leave:[],internalHourlyRate:null,billingHourlyRate:null}},crossProjectLoad:[],verifiedExperience:[]}],tasks:[{id:'t1',nameEn:'Fixture direct task',nameEs:'Tarea directa',status:'not_started',plannedHours:8,progress:0,assigneeUserId:71,version:1,workItem:'Coordination',assignmentId:null,assignmentVersion:null}],scenarios:[],methodology:'Fixture saved planning evidence'};
app.get('/api/v1/projects/:id/commercial/team-performance',(_req,res)=>res.json({project:workspace.project,period:{from:null,to:null},hourSourceTotals:{},methodology:{source:'Fixture',limitations:'Fixture only'},totals:{assignedTasks:0,completedTasks:0,plannedHours:'0',actualHours:'0',earnedHours:'0',approvedPackages:0,returnedPackages:0,efficiencyIndex:null},filters:{roles:[],workItems:[],packageTypes:[]},people:[]}));
const base='/api/v1/projects/:id/commercial/team-performance/resource-planning';
app.get(base,(_req,res)=>{if(failRead){res.status(503).json({error:'Fixture reopen unavailable'});return;}res.json(workspace);});
app.post(base+'/evaluate',async(_req,res)=>{evaluations++;await new Promise(resolve=>setTimeout(resolve,100));res.json(evaluation);});
app.post(base+'/scenarios',async(req,res)=>{savePosts++;await new Promise(resolve=>setTimeout(resolve,100));const saved={id:'scenario1',scenarioKey:'scenario-key',version:1,content:req.body,evaluation,applied:false};workspace.scenarios.push(saved);failRead=true;res.json(saved);});
app.put(base+'/profiles/:user',async(req,res)=>{profilePuts++;await new Promise(resolve=>setTimeout(resolve,100));const saved={id:'profile2',version:2,content:req.body.profile};workspace.members[0].profile=saved;failRead=true;res.json(saved);});
app.post(base+'/scenarios/:scenario/apply',async(req,res)=>{applyPosts++;await new Promise(resolve=>setTimeout(resolve,100));workspace.scenarios[0].applied=true;workspace.tasks[0].version=2;failRead=true;res.json({scenarioVersionId:req.params.scenario,applied:[{taskId:'t1',userId:71,newTaskVersion:2}],reason:req.body.reason});});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3168,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-resource-planning-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9378',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3168/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let reportResult:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9378/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3168'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};


 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Resource scheduling');
 const click=async(text:string,double=false)=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Missing button');b.click();${double?'b.click();':''}})()`);
 const input=async(label:string,value:string)=>evaluate(`(()=>{const label=[...document.querySelectorAll('label')].find(l=>l.textContent.startsWith(${JSON.stringify(label)}));const i=label.querySelector('input,textarea');Object.getOwnPropertyDescriptor(i instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await click('Resource scheduling');await wait('Resource Scheduling & Assignment Execution');await click('Add direct task assignment');await input('Scenario name','Fixture reviewed staffing');
 await click('Evaluate what-if',true);await wait('What-if evaluated');assert.equal(evaluations,1);
 await click('Save immutable version',true);await wait('Verify saved change');assert.equal(savePosts,1);assert.equal(await evaluate("document.body.innerText.includes('saved and reopened without')"),false);
 failRead=false;await click('Verify saved change');await wait('saved and reopened without changing live work');assert.equal(savePosts,1);
 await click('Save my availability',true);await wait('Verify saved change');assert.equal(profilePuts,1);failRead=false;await click('Verify saved change');await wait('Availability saved and reopened');assert.equal(profilePuts,1);
 await click('Review & apply');await input('Application reason','Reviewed fixture direct assignee');await evaluate("document.querySelector('.rs-confirm input').click()");await click('Apply reviewed assignees',true);await wait('Verify saved change');assert.equal(applyPosts,1);failRead=false;await click('Verify saved change');await wait('Reviewed direct task assignees applied and reopened');assert.equal(applyPosts,1);await wait('Applied');
 await cdp('Page.reload',{ignoreCache:true});await wait('Resource scheduling');await click('Resource scheduling');await wait('Applied');assert.equal(workspace.scenarios.length,1);
 await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await wait('Programación de recursos');await click('Programación de recursos');await wait('Aplicado');
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await evaluate("document.querySelector('.rs-card').scrollIntoView()");assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'resource-planning-mobile.png'),Buffer.from(screenshot.result.data,'base64'));assert.deepEqual(runtimeErrors,[]);
 workspace.canManage=false;await cdp('Page.reload',{ignoreCache:true});await wait('Programación de recursos');await click('Programación de recursos');await wait('Aplicado');assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar versión inmutable').disabled"),true);assert.equal(await evaluate("document.body.innerText.includes('Revisar y aplicar')"),false);
 reportResult={suite:'resource-planning-local-browser',fixtureOnly:true,evaluateDoubleOneRead:true,scenarioDoubleOneWrite:true,profileDoubleOneWrite:true,applyDoubleOneWrite:true,allKnownReceiptsRetryReadOnly:true,noPrematureSaveSuccess:true,refreshPersistence:true,spanishMobile:true,savePosts,profilePuts,applyPosts,evaluations,runtimeErrors};

}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-resource-planning-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(1000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'resource-planning-local-browser.json'),`${JSON.stringify(reportResult,null,2)}\n`);console.log(JSON.stringify(reportResult,null,2));


