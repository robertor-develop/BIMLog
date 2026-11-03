import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.CLASH_REPORT_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let rejected=true,updates=0;const report={id:7,projectId:91,fileName:'Fixture saved report',format:'manual',status:'complete',totalClashes:1,createdAt:'2026-10-01T00:00:00Z'};let clashes=[{id:8,projectId:91,clashReportId:7,description:'Fixture clash',status:'open',priority:'P4'}];
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/projects/91/clash-reports?report=7')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/clash-reports',(_req,res)=>res.json([report]));app.get('/api/v1/projects/:id/clash-reports/:report',(_req,res)=>res.json({report,clashes}));
app.patch('/api/v1/projects/:id/clash-reports/:report/clashes/:clash',(req,res)=>{updates++;if(rejected){res.status(422).json({error:'fixture rejected'});return;}clashes[0]={...clashes[0],...req.body};res.json(clashes[0]);});
app.patch('/api/v1/projects/:id/clash-reports/:report/rename',(req,res)=>{if(rejected){res.status(403).json({error:'fixture denied'});return;}Object.assign(report,req.body);res.json(report);});
app.post('/api/v1/projects/:id/clash-reports/:report/rerank',(_req,res)=>res.status(428).json({error:'fixture provider unavailable'}));
app.post('/api/v1/projects/:id/clash-reports/:report/clashes',(_req,res)=>{const saved={id:9,projectId:91,clashReportId:7,description:'Created fixture clash',status:'open',priority:'P4'};clashes.push(saved);report.totalClashes++;res.status(201).json(saved);});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3147,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-clash-report-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9357',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3147/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let reportResult:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9357/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3147'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};

  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Fixture clash');
  const click=async(text:string)=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
  const status=async()=>evaluate("(()=>{const select=document.querySelector('select[aria-label=\"Clash status\"]');select.value='resolved';select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await status();await wait('Change could not be confirmed');assert.equal(clashes[0].status,'open');await click('Reload saved records');await wait('Fixture clash');rejected=false;await status();await wait('Saved response confirmed');assert.equal(clashes[0].status,'resolved');assert.equal(updates,2);
  await evaluate("(()=>{const input=document.querySelector('input[aria-label=\"Report filename\"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'Renamed fixture');input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();})()");await evaluate("document.querySelector('input[aria-label=\"Report filename\"]').blur()");await wait('Saved response confirmed');for(let i=0;i<50&&report.fileName!=='Renamed fixture';i++)await delay(100);assert.equal(report.fileName,'Renamed fixture');
  await click('+ Add Clash');await wait('Created fixture clash');await cdp('Page.reload',{ignoreCache:true});await wait('Created fixture clash');assert.equal(await evaluate("document.querySelector('input[aria-label=\"Report filename\"]').value"),'Renamed fixture');assert.equal(clashes[0].status,'resolved');
  await click('Back');await wait('Re-rank AI');await click('Re-rank AI');await wait('Change could not be confirmed');assert.equal(report.status,'complete');assert.deepEqual(runtimeErrors,[]);
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'clash-report-mobile.png'),Buffer.from(screenshot.result.data,'base64'));
  reportResult={suite:'clash-report-local-browser',fixtureOnly:true,rejectedUpdateNoFalseSuccess:true,reloadRecovery:true,savedStatusAndRename:true,createdClashReopen:true,rerankUnavailableVisible:true,realProviderCalls:0,runtimeErrors};
}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-clash-report-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(1000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'clash-report-local-browser.json'),`${JSON.stringify(reportResult,null,2)}\n`);console.log(JSON.stringify(reportResult,null,2));
