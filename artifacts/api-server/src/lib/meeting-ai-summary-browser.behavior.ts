import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.MEETING_AI_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let rejected=true,completed=false,updates=0;let createdMeetings=0,summaryRequests=0,patches=0,providerFailed=true;const savedMeeting={id:7,projectId:91,title:'Saved meeting for AI',meetingDate:'2026-10-30T10:00:00Z',location:'Fixture room',notes:'Fixture source notes',updatedAt:'2026-10-30T10:00:00Z',attendeeCount:0,openActionItems:0,attendees:[],actionItems:[],linkedRfis:[],linkedSubmittals:[],linkedLensViewpoints:[],linkedClashes:[],clashRefreshEvents:[],scheduleBuckets:[],legacyAgendaItems:[]};
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/projects/91/meetings?meetingDraft=edit:7')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/meetings',(_req,res)=>res.json([savedMeeting]));
app.get('/api/v1/projects/:id/meetings/draft',(_req,res)=>res.json(null));
app.get('/api/v1/projects/:id/meetings/:meetingId',(_req,res)=>res.json(savedMeeting));
app.post('/api/v1/projects/:id/meetings',(_req,res)=>{createdMeetings++;res.status(201).json({...savedMeeting,id:8});});
app.post('/api/v1/projects/:id/meetings/:meetingId/ai-summary',(req,res)=>{summaryRequests++;assert.equal(req.params.meetingId,'7');if(providerFailed)res.status(503).json({error:'Fixture summary provider unavailable'});else {savedMeeting.updatedAt='2026-10-30T10:00:01Z';res.json({summary:'Fixture saved summary',action_items:[],meeting:{id:7,projectId:91,updatedAt:savedMeeting.updatedAt}});}});
app.get('/api/v1/projects/:id/action-items',(_req,res)=>res.json([{id:7,projectId:91,description:'Fixture saved action',assignedToName:'Fixture assignee',status:completed?'completed':'open',dueDate:'2026-10-01T00:00:00Z',isOverdue:!completed}]));
app.patch('/api/v1/projects/:id/action-items/:itemId',(req,res)=>{assert.equal(req.params.id,'91');assert.equal(req.params.itemId,'7');assert.deepEqual(req.body,{status:'completed'});updates++;if(rejected){res.status(403).json({error:'fixture denied'});return;}completed=true;res.json({id:7,status:'completed'});});
app.patch('/api/v1/projects/:id/meetings/:meetingId',(req,res)=>{patches++;assert.equal(req.body.expected_updated_at,savedMeeting.updatedAt);res.json(savedMeeting);});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3204,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-meeting-ai-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9414',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3204/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[],consoleErrors:string[]=[];let report:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9414/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3204'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')consoleErrors.push(JSON.stringify(message.params.args));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};


  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Generate Summary');
  await evaluate("(()=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Generate Summary');button.click();button.click();})()");await delay(800);
  assert.equal(createdMeetings,0,'Generating a summary for an existing meeting must not create another meeting');assert.equal(summaryRequests,1);
  await wait('Fixture summary provider unavailable');providerFailed=false;await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Generate Summary').click()");await wait('Fixture saved summary');await wait('Generate Summary');assert.equal(summaryRequests,2);assert.equal(createdMeetings,0);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save Changes').click()");await wait('Edit Meeting');assert.equal(patches,1);assert.deepEqual(runtimeErrors,[]);
  report={suite:'meeting-ai-local-browser',fixtureOnly:true,existingMeetingNoDuplicate:true,doubleClickOneRequest:true,providerErrorVisible:true,explicitRetrySuccess:true,noStuckLoading:true,summaryVersionAllowsSubsequentSave:true,patches,summaryRequests,createdMeetings,runtimeErrors,consoleErrors};

}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-meeting-ai-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(5000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'meeting-ai-local-browser.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
