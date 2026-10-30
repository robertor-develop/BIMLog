import assert from 'node:assert/strict';
import express from 'express';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.MEETING_CREATE_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let rejected=true,completed=false,updates=0;let posts=0,reads=0,failedRead=true,validationFirst=true;const keys:string[]=[];const savedMeeting={id:7,projectId:91,title:'Fixture action meeting',meetingDate:'2026-10-30T10:00:00Z',updatedAt:'2026-10-30T10:00:00Z',attendeeCount:0,openActionItems:0,linkedRfis:[],linkedSubmittals:[],linkedLensViewpoints:[],linkedClashes:[],clashRefreshEvents:[],scheduleBuckets:[]};const savedAction={id:8,projectId:91,meetingId:7,description:'Fixture action created'};
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/projects/91/meetings')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/meetings',(_req,res)=>res.json([savedMeeting]));
app.post('/api/v1/projects/:id/meetings/:meetingId/action-items',(req,res)=>{posts++;assert.equal(req.params.id,'91');assert.equal(req.params.meetingId,'7');assert.match(req.get('Idempotency-Key')||'',/^meeting-action-[0-9a-f-]{36}$/i);assert.deepEqual(req.body,{items:[{description:savedAction.description}]});keys.push(req.get('Idempotency-Key')||'');if(validationFirst){validationFirst=false;res.status(400).json({error:'meeting_action_input_invalid'});return;}res.status(201).json([savedAction]);});
app.get('/api/v1/projects/:id/meetings/draft',(_req,res)=>res.json(null));
app.get('/api/v1/projects/:id/meetings/:meetingId',(_req,res)=>{reads++;if(failedRead){res.status(503).json({error:'fixture read unavailable'});return;}res.json({...savedMeeting,actionItems:[savedAction]});});
app.get('/api/v1/projects/:id/action-items',(_req,res)=>res.json([{id:7,projectId:91,description:'Fixture saved action',assignedToName:'Fixture assignee',status:completed?'completed':'open',dueDate:'2026-10-01T00:00:00Z',isOverdue:!completed}]));
app.patch('/api/v1/projects/:id/action-items/:itemId',(req,res)=>{assert.equal(req.params.id,'91');assert.equal(req.params.itemId,'7');assert.deepEqual(req.body,{status:'completed'});updates++;if(rejected){res.status(403).json({error:'fixture denied'});return;}completed=true;res.json({id:7,status:'completed'});});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3205,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-meeting-create-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9415',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3205/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let report:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9415/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3205'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};


 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Fixture action meeting');
 await evaluate("[...document.querySelectorAll('summary')].find(b=>b.textContent.includes('Add meeting action item')).click()");
 await evaluate("(()=>{const field=document.querySelector('textarea[aria-label=\"Action description\"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'Fixture action created');field.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await evaluate("[...document.querySelectorAll('details input[type=checkbox]')][0].click()");
 await evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save meeting action');button.click();button.click();})()");
 await wait('Review the action fields and correct invalid values');assert.equal(posts,1);assert.equal(reads,0);assert.equal(await evaluate("document.querySelector('details fieldset').disabled"),false);
 await evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save meeting action');button.click();button.click();})()"); await wait('The save receipt is retained');assert.equal(posts,2);assert.equal(reads,1);
 await cdp('Page.reload',{ignoreCache:true});await wait('Add meeting action item');failedRead=false;
 await evaluate("[...document.querySelectorAll('summary')].find(b=>b.textContent.includes('Add meeting action item')).click()");
 await wait('Verify saved action');await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Verify saved action').click()");
 await wait('Saved and reopened action #8');assert.equal(posts,2);assert.equal(reads,2);assert.notEqual(keys[0],keys[1]);
 await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await wait('Agregar acción de reunión');await evaluate("[...document.querySelectorAll('summary')].find(b=>b.textContent.includes('Agregar acción de reunión')).click()");
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);assert.deepEqual(runtimeErrors,[]);
 await evaluate("[...document.querySelectorAll('summary')].find(b=>b.textContent.includes('Agregar acción de reunión')).scrollIntoView({block:'start'})");const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'meeting-action-create-es-mobile.png'),Buffer.from(screenshot.result.data,'base64'));
 report={suite:'meeting-create-local-browser',fixtureOnly:true,explicitConfirmation:true,validationFailureEditable:true,correctedRequestNewKey:true,doubleOnePost:true,receiptReadFailureVisible:true,refreshRestoresReceipt:true,verifyGetOnly:true,exactSavedActionIdentity:true,spanish390NoOverflow:true,posts,reads,runtimeErrors};

}catch(error){console.error(error);throw error;}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-meeting-create-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(5000);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});}catch(error){const cleanup=spawnSync('powershell.exe',['-NoProfile','-Command','Remove-Item -LiteralPath $env:BIMLOG_OWNED_PROFILE -Recurse -Force -ErrorAction Stop'],{env:{...process.env,BIMLOG_OWNED_PROFILE:profile},windowsHide:true});assert.equal(cleanup.status,0);}
}
fs.writeFileSync(path.join(output,'meeting-create-local-browser.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
