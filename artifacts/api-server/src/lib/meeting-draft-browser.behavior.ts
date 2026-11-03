import assert from 'node:assert/strict';
import express from 'express';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.MEETING_DRAFT_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;

let readDown=true,saveDown=false,deleteDown=true,wrongIdentity=false,slowSave=false;let saves=0,deletes=0,canonicalCreates=0;const createdMeetings:any[]=[];let draft:any={id:5,projectId:91,userId:71,meetingId:null,draftKey:'new',payload:{title:'Retained draft ñ',meetingDate:'2026-10-30',meetingTime:'10:00',location:'Fixture location',agendaItems:['Inspect draft']},updatedAt:'2026-10-30T10:00:00.000Z',expiresAt:'2026-11-13T10:00:00.000Z'};
const meeting={id:7,projectId:91,title:'Canonical meeting unchanged',meetingDate:'2026-10-30T10:00:00Z',updatedAt:'2026-10-30T10:00:00Z',attendeeCount:0,openActionItems:0,attendees:[],actionItems:[],linkedRfis:[],linkedSubmittals:[],linkedLensViewpoints:[],linkedClashes:[],clashRefreshEvents:[],scheduleBuckets:[]};
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/projects/91/meetings')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({rfi_status:[{value:'open',label:'Open',labelEs:'Abierto'}],submittal_status:[{value:'draft',label:'Draft',labelEs:'Borrador'}],clash_status:[{value:'open',label:'Open',labelEs:'Abierto'}],member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,activeProjectRoles:[],activeProjects:[{id:91,role:'project_admin'}]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/meetings/:meetingId',(req,res,next)=>{if(!/^\d+$/.test(req.params.meetingId)){next();return;}res.json(meeting);});
app.get('/api/v1/projects/:id/meetings',(_req,res)=>res.json([meeting,...createdMeetings]));app.post('/api/v1/projects/:id/meetings',(req,res)=>{canonicalCreates++;const created={...meeting,id:8,title:req.body.title};createdMeetings.push(created);draft=null;res.status(201).json(created);});
app.get('/api/v1/projects/:id/action-items',(_req,res)=>res.json([]));
app.get('/api/v1/projects/:id/meetings/draft',(_req,res)=>{if(readDown){res.status(503).json({error:'fixture restore unavailable'});return;}res.json(draft&&wrongIdentity?{...draft,projectId:92}:draft);});
app.put('/api/v1/projects/:id/meetings/draft',async(req,res)=>{assert.equal(req.headers.authorization,'Bearer '+fixtureToken);if(saveDown){res.status(503).json({error:'fixture save unavailable'});return;}if(slowSave)await new Promise(r=>setTimeout(r,450));saves++;draft={id:5,projectId:91,userId:71,meetingId:req.body.meeting_id??null,draftKey:req.body.meeting_id?'edit:'+req.body.meeting_id:'new',payload:Object.fromEntries(Object.entries(req.body.payload).reverse()),updatedAt:new Date().toISOString(),expiresAt:'2026-11-13T10:00:00.000Z'};res.json(draft&&wrongIdentity?{...draft,projectId:92}:draft);});
app.delete('/api/v1/projects/:id/meetings/draft',(_req,res)=>{if(deleteDown){res.status(503).json({error:'fixture discard unavailable'});return;}deletes++;draft=null;res.json({ok:true});});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3208,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-meeting-draft-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9418',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3208/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[],consoleErrors:string[]=[];let report:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9418/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3208'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')consoleErrors.push(JSON.stringify(message.params.args));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};



 const reload=async()=>{const before=await evaluate("performance.timeOrigin");await cdp('Page.reload',{ignoreCache:true});for(let i=0;i<100;i++){if(await evaluate(`performance.timeOrigin!==${JSON.stringify(before)}&&document.readyState==='complete'`))return;await delay(100);}throw Error('Reload did not resolve');};


 await cdp('Runtime.enable');await cdp('Page.enable');await reload();await wait('Canonical meeting unchanged');
 const click=async(text:string)=>{for(let i=0;i<80;i++){const done=await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)return false;b.click();return true;})()`);if(done)return;await delay(100);}throw Error('Enabled control unavailable: '+text);};
 await click('New Meeting');await wait('Save Meeting');await delay(1400);assert.equal(saves,0,'Failed restore must not overwrite the saved draft with an empty form');

 await wait('Could not restore draft');assert.equal(draft.payload.title,'Retained draft ñ');
 readDown=false;wrongIdentity=true;await click('Retry draft restore');await delay(1200);assert.equal(saves,0);await wait('Could not restore draft');
 wrongIdentity=false;await click('Retry draft restore');await wait('Draft saved');
 const titleValue=()=>evaluate("document.querySelector('input[placeholder=\"e.g. Underground Coordination\"]').value");
 assert.equal(await titleValue(),'Retained draft ñ');
 saveDown=true;await evaluate("(()=>{const e=document.querySelector('input[placeholder=\"e.g. Underground Coordination\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Revised durable draft ñ');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await wait('Save failed - changes not safely stored');assert.equal(await titleValue(),'Revised durable draft ñ');
 saveDown=false;await click('Save draft now');await wait('Draft saved');assert.equal(draft.payload.title,'Revised durable draft ñ');

 slowSave=true;await click('Save draft now');await wait('Saving draft...');
 await evaluate("(()=>{const e=document.querySelector('input[placeholder=\"e.g. Underground Coordination\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Latest draft edit ñ');e.dispatchEvent(new Event('input',{bubbles:true}));})()");
 await delay(550);assert.equal(await evaluate("document.body.innerText.includes('Draft saved')"),false,'Old receipt must not mark newer edits saved');
 await wait('Draft saved');slowSave=false;assert.equal(draft.payload.title,'Latest draft edit ñ');

 await reload();await wait('Draft saved');assert.equal(await titleValue(),'Latest draft edit ñ');
 await evaluate("window.confirm=()=>false");await click('Discard Draft');assert.equal(deletes,0);assert.equal(await titleValue(),'Latest draft edit ñ');
 await evaluate("window.confirm=()=>true");await click('Discard Draft');await wait('Draft discard could not be verified');assert.equal(await titleValue(),'Latest draft edit ñ');assert.equal(deletes,0);
 await evaluate("localStorage.setItem('bimlog-lang','es')");await reload();await wait('Borrador guardado');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);
 await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Guardar borrador ahora').focus()");await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait('Borrador guardado');
 const shot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'meeting-draft-es-mobile.png'),Buffer.from(shot.result.data,'base64'));
 await evaluate("window.confirm=()=>true");deleteDown=false;await click('Descartar borrador');await wait('Canonical meeting unchanged');await delay(1400);assert.equal(deletes,1);assert.equal(draft,null,'Discarded draft must not reappear through a pending autosave');
 await reload();await wait('Canonical meeting unchanged');assert.equal(draft,null);assert.deepEqual(runtimeErrors,[]);

 draft={id:5,projectId:91,userId:71,meetingId:7,draftKey:'edit:7',payload:{title:'Stale draft must not overwrite'},canonicalUpdatedAt:'2020-01-01T00:00:00.000Z',updatedAt:'2026-10-30T10:00:00.000Z',expiresAt:'2026-11-13T10:00:00.000Z'};
 await evaluate("localStorage.setItem('bimlog-lang','en')");await cdp('Page.navigate',{url:'http://127.0.0.1:3208/projects/91/meetings?meetingDraft=edit:7'});await wait('This draft uses an older meeting version');assert.equal(await titleValue(),'Canonical meeting unchanged');assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save Changes').disabled"),true);
 await evaluate("window.confirm=()=>true");await click('Discard Draft');await delay(1300);assert.equal(await titleValue(),'Canonical meeting unchanged');assert.equal(draft,null,'Discarded stale draft must not be automatically recreated');
 await cdp('Page.navigate',{url:'http://127.0.0.1:3208/all-tools'});await wait('Personal Meeting Drafts');await evaluate("[...document.querySelectorAll('button.all-tools-card')].find(b=>b.textContent.includes('Personal Meeting Drafts')).click()");await wait('Save draft now');assert.equal(await evaluate("location.pathname"),'/projects/91/meetings');assert.deepEqual(runtimeErrors,[]);


 await evaluate("(()=>{const e=document.querySelector('input[placeholder=\"e.g. Underground Coordination\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Confirmed meeting from draft');e.dispatchEvent(new Event('input',{bubbles:true}));const d=document.querySelector('input[type=date]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(d,'2026-10-30');d.dispatchEvent(new Event('input',{bubbles:true}));})()");
 slowSave=true;await click('Save draft now');await wait('Saving draft...');await delay(100);await click('Save Meeting');await wait('New Meeting');await delay(1300);assert.equal(canonicalCreates,1);assert.equal(draft,null,'In-flight draft save must not recreate a draft after canonical meeting creation');assert.equal(meeting.title,'Canonical meeting unchanged');assert.deepEqual(runtimeErrors,[]);

 report={suite:'P177-draft-built-browser',fixtureOnly:true,restoreFailureDoesNotOverwrite:true,wrongIdentityRejected:true,retryRestoresExactDraft:true,saveFailurePreservesFields:true,explicitSaveReopen:true,oldReceiptDoesNotMarkNewEditsSaved:true,refreshRestores:true,staleDraftDoesNotOverwriteCanonical:true,staleDiscardResolves:true,allToolsDirectAccess:true,canonicalSaveDrainsDraftRequests:true,discardCancelAndFailurePreserve:true,discardVerifiedNoResurrection:true,spanish390:true,keyboard:true,saves,deletes,runtimeErrors,consoleErrors};

}catch(error){console.error(error);throw error;}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-meeting-draft-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(5000);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});}catch(error){const cleanup=spawnSync('powershell.exe',['-NoProfile','-Command','for($attempt=0;$attempt -lt 20;$attempt++){if(-not(Test-Path -LiteralPath $env:BIMLOG_OWNED_PROFILE)){exit 0};try{Remove-Item -LiteralPath $env:BIMLOG_OWNED_PROFILE -Recurse -Force -ErrorAction Stop;if(-not(Test-Path -LiteralPath $env:BIMLOG_OWNED_PROFILE)){exit 0}}catch{if(-not(Test-Path -LiteralPath $env:BIMLOG_OWNED_PROFILE)){exit 0};if($attempt -eq 19){throw}};Start-Sleep -Milliseconds 1000};exit 1'],{env:{...process.env,BIMLOG_OWNED_PROFILE:profile},windowsHide:true});assert.equal(cleanup.status,0,String(cleanup.stderr));assert.equal(fs.existsSync(profile),false);}
}
fs.writeFileSync(path.join(output,'meeting-draft-local-browser.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
