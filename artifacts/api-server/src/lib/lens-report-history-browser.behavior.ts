import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.LENS_REPORT_HISTORY_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let failedRead=false,historyFails=true,patches=0,histories=0;let rows=[{id:7,projectId:91,viewpointId:'fixture-vp',displayId:'HV-001',note:'Fixture original note',trade:'HVAC',floor:'1',priority:3,status:'open',lifecycleStatus:'active',revisionNumber:1,capturedAt:'2026-10-01T00:00:00Z'}];
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/projects/91/clash-reports?view=lens')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}},{value:'viewer',label:'Reader',meta:{permission:'read'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:user.isSuperAdmin?'project_admin':'viewer',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/clash-reports',(_req,res)=>res.json([]));
app.get('/api/v1/projects/:id/clash-reports/lens-pull',(_req,res)=>{if(failedRead){res.status(503).json({error:'fixture unavailable'});return;}res.json({success:true,viewpoints:rows});});

let reportMode='failure';let reports=[{id:19,reportNumber:'FIX-LV-019',generatedAt:'2026-10-01T00:00:00Z',viewpointCount:1}];
app.get('/api/v1/projects/:id/clash-reports/lens-viewpoints/reports',(_req,res)=>{if(reportMode!=='success'){res.status(reportMode==='denied'?403:503).json({message:'Fixture report history unavailable'});return;}res.json({projectId:91,reports});});
app.delete('/api/v1/projects/:id/clash-reports/lens-viewpoints/reports/:report',async(req,res)=>{patches++;await new Promise(resolve=>setTimeout(resolve,100));reports=[];reportMode='failure';res.json({success:true,id:Number(req.params.report)});});
app.patch('/api/v1/projects/:id/clash-reports/lens-viewpoints/:view/edit',(req,res)=>{patches++;rows[0].lifecycleStatus='superseded';const saved={...rows[0],id:8,lifecycleStatus:'active',revisionNumber:2,note:req.body.note};rows.push(saved);failedRead=true;res.json({success:true,supersededId:7,viewpoint:saved});});
app.get('/api/v1/projects/:id/clash-reports/lens-viewpoints/:view/history',(_req,res)=>{histories++;if(historyFails){res.status(503).json({error:'fixture history unavailable'});return;}res.json({success:true,chain:[...rows].reverse(),events:[{id:1,actionType:'edit',userFullName:'Fixture editor',createdAt:'2026-10-01T00:00:00Z',details:'Fixture history recovered'}]});});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3160,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-lens-report-history-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9370',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3160/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let reportResult:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9370/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3160'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};

  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Fixture original note');
  const click=async(text:string)=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);

  await wait('Fixture report history unavailable');reportMode='success';await click('Reload report history');await wait('FIX-LV-019');
  reportMode='denied';await click('Reload report history');await wait('Fixture report history unavailable');assert.equal(await evaluate("document.body.innerText.includes('FIX-LV-019')"),false);
  reportMode='success';await click('Reload report history');await wait('FIX-LV-019');await evaluate("window.confirm=()=>true;(()=>{const row=[...document.querySelectorAll('tr')].find(r=>r.innerText.includes('FIX-LV-019'));const button=[...row.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete');button.click();button.click();})()");await wait('history could not be reopened');assert.equal(patches,1);assert.equal(await evaluate("document.body.innerText.includes('Report record deleted; audit retained.')"),false);
  reportMode='success';await click('Reload report history');await wait('No reports generated yet.');await cdp('Page.reload',{ignoreCache:true});await wait('No reports generated yet.');
  reports=[{id:20,reportNumber:'FIX-LV-020',generatedAt:'2026-10-01T00:00:00Z',viewpointCount:1}];user.isSuperAdmin=false;await evaluate("(()=>{const auth=JSON.parse(localStorage.getItem('bimlog-auth'));auth.state.user.isSuperAdmin=false;localStorage.setItem('bimlog-auth',JSON.stringify(auth));})()");await cdp('Page.reload',{ignoreCache:true});await wait('FIX-LV-020');assert.equal(await evaluate("[...document.querySelectorAll('tr')].find(r=>r.innerText.includes('FIX-LV-020')).querySelectorAll('button').length"),0);assert.deepEqual(runtimeErrors,[]);
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'lens-report-history-mobile.png'),Buffer.from(screenshot.result.data,'base64'));
  reportResult={suite:'lens-report-history-local-browser',fixtureOnly:true,visibleFailureAndReload:true,deniedClearsRecords:true,doubleDeleteOneRequest:true,failedReopenNoSuccess:true,emptyRefreshPersistence:true,readOnlyNoDeleteControl:true,patches,runtimeErrors};

}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-lens-report-history-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(1000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'lens-report-history-local-browser.json'),`${JSON.stringify(reportResult,null,2)}\n`);console.log(JSON.stringify(reportResult,null,2));
