import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.MEETING_LINK_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let failedRead=false,historyFails=true,patches=0,histories=0;let rows=[{id:7,projectId:91,viewpointId:'fixture-vp',displayId:'HV-001',note:'Fixture original note',trade:'HVAC',floor:'1',priority:3,status:'open',lifecycleStatus:'active',revisionNumber:1,capturedAt:'2026-10-01T00:00:00Z'}];
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/meeting-link-actions?projectId=91')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[{id:91,role:'project_admin'}]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/clash-reports',(_req,res)=>res.json([]));
app.get('/api/v1/projects/:id/clash-reports/lens-pull',(_req,res)=>{if(failedRead){res.status(503).json({error:'fixture unavailable'});return;}res.json({success:true,viewpoints:rows});});


let previews=0,executes=0,linked=false,failVerification=false,denied=false;let key='';
const timestamp='2026-10-01T12:00:00.000Z';
app.get('/api/v1/projects/:id/meetings',(_req,res)=>res.json([{id:7,title:'Fixture meeting',updatedAt:timestamp}]));
app.get('/api/v1/projects/:id/coordinator-actions',(_req,res)=>res.json({items:[{sourceModule:'submittal',sourceId:9,sourceUpdatedAt:timestamp,displayIdentifier:'SUB-009'},{sourceModule:'submittal',sourceId:10,sourceUpdatedAt:timestamp,displayIdentifier:'SUB-010'}]}));
const result=(body:any,preview:boolean)=>({projectId:91,meetingId:7,preview,summary:{added:linked?0:1,already_linked:linked?1:0,stale:1},outcomes:body.items.map((item:any)=>({...item,outcome:item.sourceId===10?'stale':linked?'already_linked':'added',reason:item.sourceId===10?'Fixture source changed':'Fixture canonical link',meetingLinkId:item.sourceId===9&&linked?31:null,meetingLinkPath:'/projects/91/meetings?meeting=7'}))});
app.post('/api/v1/projects/:id/coordinator-actions/meeting-links/preview',async(req,res)=>{previews++;await new Promise(resolve=>setTimeout(resolve,80));if(denied){res.status(403).json({error:'denied'});return;}if(failVerification){res.status(503).json({error:'unavailable'});return;}res.json(result(req.body,true));});
app.post('/api/v1/projects/:id/coordinator-actions/meeting-links/execute',async(req,res)=>{executes++;key=req.body.idempotencyKey;assert.equal(req.body.confirmed,true);assert.ok(key.length>8);await new Promise(resolve=>setTimeout(resolve,80));linked=true;failVerification=true;const saved=result(req.body,false);saved.outcomes[0].outcome='added';res.status(201).json(saved);});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3172,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-meeting-link-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9382',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3172/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let reportResult:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9382/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3172'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};


 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Link Actions to a Meeting');
 const click=async(text:string,double=false)=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});b.click();${double?'b.click();':''}})()`);
 await click('Load meetings and sources');await wait('SUB-009');await evaluate("(()=>{const select=document.querySelector('main select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'7');select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelectorAll('main tbody input').forEach(input=>input.click());})()");
 denied=true;await click('Preview exact selection');await wait('Project write access is required');assert.equal(executes,0);denied=false;await click('Preview exact selection',true);await wait('Preview — no changes made');await wait('stale');assert.equal(previews,2);
 await evaluate("document.querySelector('main section+label input')?.click()");const confirmation=await evaluate("[...document.querySelectorAll('main input[type=checkbox]')].find(i=>i.closest('label')?.textContent.includes('I reviewed'))?.checked");if(!confirmation)await evaluate("[...document.querySelectorAll('main input[type=checkbox]')].find(i=>i.closest('label')?.textContent.includes('I reviewed')).click()");
 await click('Execute reviewed links',true);await wait('Saved receipt received; link verification is pending');assert.equal(executes,1);assert.equal(await evaluate("document.body.innerText.includes('Saved link outcomes reopened')"),false);assert.equal(await evaluate("document.querySelector('a[href*=meeting]').getAttribute('href')"),'/projects/91/meetings?meeting=7');
 failVerification=false;await click('Verify saved links');await wait('Saved link outcomes reopened');assert.equal(executes,1);await wait('stale');await click('Start another selection');
 await cdp('Page.reload',{ignoreCache:true});await wait('Load meetings and sources');await click('Load meetings and sources');await wait('SUB-009');assert.equal(linked,true);
 await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await wait('Enlazar acciones a una reunión');await click('Cargar reuniones y fuentes');await wait('SUB-009');
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'meeting-link-mobile.png'),Buffer.from(screenshot.result.data,'base64'));assert.deepEqual(runtimeErrors,[]);
 reportResult={suite:'meeting-link-local-browser',fixtureOnly:true,previewNoMutation:true,denialActionable:true,perRowStaleVisible:true,doubleExecuteOneWrite:true,knownReceiptReopenRetryReadOnly:true,exactMeetingLink:true,refreshSelectionReset:true,spanishMobileNoOverflow:true,previews,executes,keyPresent:!!key,runtimeErrors};

}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-meeting-link-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(1000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'meeting-link-local-browser.json'),`${JSON.stringify(reportResult,null,2)}\n`);console.log(JSON.stringify(reportResult,null,2));


