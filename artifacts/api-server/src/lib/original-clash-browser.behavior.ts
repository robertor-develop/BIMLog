import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.ORIGINAL_CLASH_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let failedRead=false,historyFails=true,patches=0,histories=0;let rows=[{id:7,projectId:91,viewpointId:'fixture-vp',displayId:'HV-001',note:'Fixture original note',trade:'HVAC',floor:'1',priority:3,status:'open',lifecycleStatus:'active',revisionNumber:1,capturedAt:'2026-10-01T00:00:00Z'}];
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/find-original-clash?projectId=91&clashId=7')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[{id:91,role:'project_admin'}]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/clash-reports',(_req,res)=>res.json([]));
app.get('/api/v1/projects/:id/clash-reports/lens-pull',(_req,res)=>{if(failedRead){res.status(503).json({error:'fixture unavailable'});return;}res.json({success:true,viewpoints:rows});});

let mode='success',reads=0;
app.get('/api/v1/projects/:id/clashes/:clash',async(req,res)=>{reads++;const captured=mode;const project=req.params.id;if(captured==='slow')await new Promise(resolve=>setTimeout(resolve,500));if(captured==='denied'){res.status(403).json({error:'denied'});return;}if(captured==='missing'){res.status(404).json({error:'missing'});return;}if(captured==='unavailable'){res.status(503).json({error:'unavailable'});return;}res.set('X-BIMLog-Project-Id',captured==='wrong'?'999':project).json({id:captured==='bad'?999:Number(req.params.clash),reportId:project==='92'?12:11});});
app.patch('/api/v1/projects/:id/clash-reports/lens-viewpoints/:view/edit',(req,res)=>{patches++;rows[0].lifecycleStatus='superseded';const saved={...rows[0],id:8,lifecycleStatus:'active',revisionNumber:2,note:req.body.note};rows.push(saved);failedRead=true;res.json({success:true,supersededId:7,viewpoint:saved});});
app.get('/api/v1/projects/:id/clash-reports/lens-viewpoints/:view/history',(_req,res)=>{histories++;if(historyFails){res.status(503).json({error:'fixture history unavailable'});return;}res.json({success:true,chain:[...rows].reverse(),events:[{id:1,actionType:'edit',userFullName:'Fixture editor',createdAt:'2026-10-01T00:00:00Z',details:'Fixture history recovered'}]});});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3167,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-original-clash-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9377',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3167/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let reportResult:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9377/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3167'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};


  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Find Original Clash');
  const click=async()=>evaluate("document.querySelector('main button[type=submit]').click()");
  const input=async(index:number,value:string)=>evaluate(`(()=>{const input=document.querySelectorAll('main input')[${index}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await input(1,'no');await click();await wait('positive server clash ID');assert.equal(reads,0);
  await input(1,'7');await evaluate("(()=>{const button=document.querySelector('main button[type=submit]');button.click();button.click();})()");await wait('Saved source verified');assert.equal(reads,1);assert.equal(await evaluate("document.querySelector('a[href*=report]').getAttribute('href')"),'/projects/91/clash-reports?report=11&clash=7');
  await cdp('Page.reload',{ignoreCache:true});await wait('Find Original Clash');assert.equal(await evaluate("document.querySelectorAll('main input')[1].value"),'7');assert.equal(await evaluate("document.body.innerText.includes('Saved source verified')"),false);await click();await wait('Saved source verified');
  for(const [next,text] of [['denied','Access denied.'],['missing','original clash is deleted'],['wrong','source could not be verified'],['bad','source could not be verified'],['unavailable','source could not be verified']]){mode=next;await click();await wait(text);assert.equal(await evaluate("document.body.innerText.includes('Saved source verified')"),false);}
  mode='slow';await click();await delay(60);await input(0,'92');mode='success';await click();await wait('Saved source verified');await delay(650);assert.equal(await evaluate("document.querySelector('a[href*=report]').getAttribute('href')"),'/projects/92/clash-reports?report=12&clash=7');
  await cdp('Page.navigate',{url:'http://127.0.0.1:3167/all-tools'});await wait('Search tools, tasks, and purposes');await evaluate("(()=>{const input=document.getElementById('all-tools-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Find Original Clash');input.dispatchEvent(new Event('input',{bubbles:true}));})()");await delay(100);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Find Original Clash')).click()");await wait('Find saved source');
  await input(1,'7');await click();await wait('Saved source verified');await evaluate("document.querySelector('a[href*=report]').click()");await wait('Clash Reports');
  await cdp('Page.navigate',{url:'http://127.0.0.1:3167/find-original-clash?projectId=91&clashId=7'});await wait('Find saved source');await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await wait('Buscar choque original');await click();await wait('Fuente guardada verificada');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'original-clash-mobile.png'),Buffer.from(screenshot.result.data,'base64'));assert.deepEqual(runtimeErrors,[]);
  reportResult={suite:'original-clash-local-browser',fixtureOnly:true,invalidNoRequest:true,doubleClickOneRead:true,exactSourceLink:true,refreshIdentityAndReverify:true,deniedMissingBadScopeMalformedUnavailableRecover:true,staleReplyIsolated:true,allToolsDiscoverable:true,sourceNavigation:true,spanishMobileNoOverflow:true,reads,runtimeErrors};

}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-original-clash-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(1000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'original-clash-local-browser.json'),`${JSON.stringify(reportResult,null,2)}\n`);console.log(JSON.stringify(reportResult,null,2));


