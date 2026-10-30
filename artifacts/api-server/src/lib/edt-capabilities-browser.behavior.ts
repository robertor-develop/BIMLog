import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.EDT_CAPABILITIES_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let failedRead=false,historyFails=true,patches=0,histories=0;let rows=[{id:7,projectId:91,viewpointId:'fixture-vp',displayId:'HV-001',note:'Fixture original note',trade:'HVAC',floor:'1',priority:3,status:'open',lifecycleStatus:'active',revisionNumber:1,capturedAt:'2026-10-01T00:00:00Z'}];
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/edt-permissions?projectId=91')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[{id:91,role:'project_admin'}]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/clash-reports',(_req,res)=>res.json([]));
app.get('/api/v1/projects/:id/clash-reports/lens-pull',(_req,res)=>{if(failedRead){res.status(503).json({error:'fixture unavailable'});return;}res.json({success:true,viewpoints:rows});});


let mode='good',role='PROJECT_LEADER',reads=0;
app.get('/api/v1/projects/:id/edt-engine/capabilities',async(req,res)=>{reads++;const captured=mode;if(captured==='slow')await new Promise(r=>setTimeout(r,500));if(captured==='denied'){res.status(403).json({error:'fixture access denied'});return;}if(captured==='unavailable'){res.status(503).json({error:'fixture temporarily unavailable'});return;}res.json({projectId:captured==='wrong'?999:Number(req.params.id),eligibleRole:role,grants:captured==='malformed'?['SUPER_ADMIN']:captured==='empty'?[]:role==='PROJECT_LEADER'?['JOB_OPERATE','JOB_ACTIVATION_REQUEST']:['JOB_OPERATE','TIME_SUBMIT']});});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3176,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-edt-permissions-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9386',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3176/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let reportResult:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9386/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3176'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};


 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Your EDT Permissions');
 const click=async(text:string,double=false)=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});b.click();${double?'b.click();':''}})()`);
 const field=async(selector:string,value:string)=>evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await field('main input','');await click('Read current EDT permissions');await wait('Enter an authorized project ID');assert.equal(reads,0);
 await field('main input','91');await click('Read current EDT permissions',true);await wait('Project Leader');await wait('Request EDT activation');assert.equal(reads,1);assert.equal(await evaluate("document.querySelector('main a[href*=operations]').getAttribute('href')"),'/projects/91/operations');
 role='DRAFTER';await click('Read current EDT permissions');await wait('Drafter / project member');await wait('Submit worked time');assert.equal(await evaluate("document.body.innerText.includes('Request EDT activation')"),false);
 mode='denied';await click('Read current EDT permissions');await wait('fixture access denied');assert.equal(await evaluate("document.body.innerText.includes('Submit worked time')"),false);
 mode='unavailable';await click('Read current EDT permissions');await wait('fixture temporarily unavailable');mode='wrong';await click('Read current EDT permissions');await wait('another project');mode='malformed';await click('Read current EDT permissions');await wait('incomplete');mode='empty';await click('Read current EDT permissions');await wait('No EDT actions are granted');
 mode='good';await click('Read current EDT permissions');await wait('Submit worked time');await cdp('Page.reload',{ignoreCache:true});await wait('Your EDT Permissions');assert.equal(await evaluate("document.body.innerText.includes('Submit worked time')"),false);await click('Read current EDT permissions');await wait('Submit worked time');
 mode='slow';await click('Read current EDT permissions');await delay(40);await field('main input','92');await delay(650);assert.equal(await evaluate("document.body.innerText.includes('Submit worked time')"),false);mode='good';
 await cdp('Page.navigate',{url:'http://127.0.0.1:3176/all-tools'});await wait('Search tools, tasks, and purposes');await field('#all-tools-search','Your EDT Permissions');await delay(100);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Your EDT Permissions')).click()");await wait('Your EDT Permissions');
 await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await wait('Sus permisos EDT');await click('Consultar permisos EDT actuales');await wait('Registrar tiempo trabajado');await wait('Acciones EDT permitidas');
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'edt-permissions-mobile.png'),Buffer.from(screenshot.result.data,'base64'));assert.deepEqual(runtimeErrors,[]);
 reportResult={suite:'edt-permissions-local-browser',fixtureOnly:true,invalidNoRequest:true,doubleOneRead:true,plainLanguageRolesPermissions:true,roleChangeRefresh:true,deniedUnavailableWrongMalformedRecovery:true,truthfulEmpty:true,refreshNoStaleAuthority:true,scopeChangeAbortsStale:true,allToolsDiscoverable:true,spanish390NoOverflow:true,reads,runtimeErrors};

}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-edt-permissions-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(1000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'edt-permissions-local-browser.json'),`${JSON.stringify(reportResult,null,2)}\n`);console.log(JSON.stringify(reportResult,null,2));




