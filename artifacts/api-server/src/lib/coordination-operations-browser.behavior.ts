import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.COORDINATION_OPERATIONS_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let failedRead=false,historyFails=true,patches=0,histories=0;let rows=[{id:7,projectId:91,viewpointId:'fixture-vp',displayId:'HV-001',note:'Fixture original note',trade:'HVAC',floor:'1',priority:3,status:'open',lifecycleStatus:'active',revisionNumber:1,capturedAt:'2026-10-01T00:00:00Z'}];
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/coordination-operations?projectId=91')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[{id:91,role:'project_admin'}]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/clash-reports',(_req,res)=>res.json([]));
app.get('/api/v1/projects/:id/clash-reports/lens-pull',(_req,res)=>{if(failedRead){res.status(503).json({error:'fixture unavailable'});return;}res.json({success:true,viewpoints:rows});});


let denied=false,malformed=false,posts=0;const paths:string[]=[];const summary={projectId:91,observedAt:new Date().toISOString(),counts:{files:0,revisions:0,currentFiles:0,activeJobs:0,attentionJobs:0,activeCredentials:0},latestFiles:[],recentJobs:[]};
app.get('/api/v1/projects/:id/coordination-hub/summary',(req,res)=>{if(malformed){res.type('application/json').send('{bad');return;}res.json({...summary,projectId:Number(req.params.id)});});
app.get('/api/v1/projects/:id/coordination-hub/credential-validation-operations',(_req,res)=>res.json({projectId:91,limit:20,operations:[]}));
app.post('/api/v1/projects/:id/coordination-hub/*operation',async(req,res)=>{posts++;paths.push(req.path);await new Promise(resolve=>setTimeout(resolve,100));if(denied){res.status(403).json({error:'denied'});return;}const operation=req.params.operation.join('/');if(operation==='credentials'||operation.endsWith('/rotate')){assert.ok(req.body.credential.tokenBase64Url);assert.equal(Buffer.from(req.body.credential.tokenBase64Url,'base64url').toString(),'synthetic-fixture-bearer-token');}res.json({result:operation==='jobs'?'queued':operation.endsWith('/validate')?'activated':'created',credentialId:'fixture-credential',revisionId:operation==='revisions'?'fixture-revision':undefined,jobId:operation==='jobs'?'fixture-job':undefined,state:operation==='credentials'?'pending_validation':undefined});});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3171,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-coordination-operations-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9381',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3171/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let reportResult:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9381/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3171'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};


 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Coordination Connector Operations');
 const click=async(text:string,double=false)=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});b.click();${double?'b.click();':''}})()`);
 const fill=async(selector:string,value:string)=>evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(i instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await click('Reload saved evidence');await wait('Saved project evidence');await wait('Credential validation evidence');
 for(const label of ['Enroll SharePoint credential','Rotate active credential','Validate pending credential','Map SharePoint folders','Register file revision','Queue connector job']){
  await click(label);if(label.includes('credential')&&!label.startsWith('Enroll'))await fill('main input:not([inputmode]):not([type=password]):not([type=checkbox])','fixture-credential');
  if(label.startsWith('Enroll')||label.startsWith('Rotate'))await fill('main input[type=password]','synthetic-fixture-bearer-token');
  await evaluate("document.querySelector('main input[type=checkbox]').click()");const before=posts;await click('Submit reviewed operation',true);await wait('Server response — verify saved evidence');assert.equal(posts,before+1);assert.equal(await evaluate("document.body.innerText.includes('synthetic-fixture-bearer-token')"),false);if(label.startsWith('Enroll')||label.startsWith('Rotate'))assert.equal(await evaluate("document.querySelector('main input[type=password]').value"),'');
 }
 assert.equal(paths.length,6);assert.ok(paths.some(value=>value.endsWith('/credentials/fixture-credential/validate')));assert.ok(paths.some(value=>value.endsWith('/credentials/fixture-credential/rotate')));
 denied=true;await click('Register file revision');await evaluate("document.querySelector('main input[type=checkbox]').click()");await click('Submit reviewed operation');await wait('Access denied for this operation');assert.equal(await evaluate("document.body.innerText.includes('Server response — verify saved evidence')"),false);
 malformed=true;await click('Reload saved evidence');await wait('server response could not be read');malformed=false;
 await cdp('Page.navigate',{url:'http://127.0.0.1:3171/all-tools'});await wait('Search tools, tasks, and purposes');await fill('#all-tools-search','Coordination Connector Operations');await delay(100);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Coordination Connector Operations')).click()");await wait('Reload saved evidence');
 await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await wait('Operaciones de conectores de coordinación');await click('Recargar evidencia guardada');await wait('Evidencia guardada del proyecto');
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'coordination-operations-mobile.png'),Buffer.from(screenshot.result.data,'base64'));assert.deepEqual(runtimeErrors,[]);
 reportResult={suite:'coordination-operations-local-browser',fixtureOnly:true,all8RouteControls:true,eachDoubleClickOnePost:true,secretsClearedAndAbsentFromReceipt:true,deniedNoFalseReceipt:true,allToolsDiscoverable:true,spanishWorkflow:true,posts,paths,runtimeErrors};

}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-coordination-operations-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(1000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'coordination-operations-local-browser.json'),`${JSON.stringify(reportResult,null,2)}\n`);console.log(JSON.stringify(reportResult,null,2));


