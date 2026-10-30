import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.SETUP_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Reader',companyId:31,companyName:'Fixture',isSuperAdmin:false};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let unavailable=true,saveDenied=false,saves=0;
let completionDenied=true,completions=0;
let deliveryUnavailable=true,deliveries=0,verificationUnavailable=true,verificationExpired=false,verificationCalls=0;
let state={email:user.email,companyName:'Fixture Company',emailVerifiedAt:null as string|null,workProfile:'bim_coordinator',preferredDisciplines:['Architecture'],preferredDocumentTypes:['Shop Drawings'],completedSteps:[] as string[],completedAt:null as string|null,projectCount:1,firstValueReached:false,firstValueEvidence:null};
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/my-setup')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.post('/api/v1/onboarding/email-verification',(_req,res)=>{deliveries++;if(deliveryUnavailable){res.status(503).json({error:'EMAIL_DELIVERY_NOT_CONFIGURED'});return;}res.status(202).json({status:'sent',expiresAt:'2026-10-31T00:00:00Z'});});
app.post('/api/v1/onboarding/email-verification/confirm',(req,res)=>{verificationCalls++;assert.ok(String(req.body.token).length>=32);if(verificationUnavailable){res.status(503).json({error:'fixture unavailable'});return;}if(verificationExpired){res.status(409).json({error:'fixture expired'});return;}res.json({verified:true});});
app.post('/api/v1/onboarding/complete',(_req,res)=>{if(completionDenied){res.status(409).json({error:'fixture prerequisites changed'});return;}completions++;state.completedAt='2026-10-30T00:00:00Z';res.json({completedAt:state.completedAt});});
app.get('/api/v1/onboarding',(_req,res)=>{if(unavailable){res.status(503).json({error:'fixture unavailable'});return;}res.json(state);});
app.patch('/api/v1/onboarding',(req,res)=>{if(saveDenied){res.status(403).json({error:'fixture denied'});return;}saves++;state={...state,workProfile:req.body.workProfile,preferredDisciplines:req.body.preferredDisciplines,preferredDocumentTypes:req.body.preferredDocumentTypes,completedSteps:req.body.guidePaused?['guide_paused']:[]};res.json({saved:true});});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3140,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-setup-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9350',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3140/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let report:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9350/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3140'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};

  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Setup could not be verified');
  const click=async(text:string)=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
  unavailable=false;await click('Reload saved setup');await wait('Fixture Company');await wait('Verification pending; you can return later');
  assert.equal(deliveries,0);await click('Send verification email to my account');await wait('Verification delivery is not configured');assert.equal(state.emailVerifiedAt,null);deliveryUnavailable=false;await click('Send verification email to my account');await wait('Verification email sent to fixture@example.test');assert.equal(state.emailVerifiedAt,null);
  await evaluate("(()=>{const select=document.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,'designer');select.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await evaluate("(()=>{const label=[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Electrical');label.querySelector('input').click();const pause=[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Pause first-use'));pause.querySelector('input').click();})()");
  await click('Save my preferences');await wait('Preferences saved');assert.equal(saves,1);assert.equal(state.workProfile,'designer');assert.ok(state.preferredDisciplines.includes('Electrical'));assert.deepEqual(state.completedSteps,['guide_paused']);
  await cdp('Page.reload',{ignoreCache:true});await wait('Fixture Company');assert.equal(await evaluate("document.querySelector('select').value"),'designer');assert.equal(await evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.trim()==='Electrical').querySelector('input').checked"),true);
  saveDenied=true;await click('Save my preferences');await wait('Save could not be confirmed');assert.equal(saves,1);saveDenied=false;await click('Reload saved setup');await wait('Fixture Company');
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Mark my setup complete').disabled"),true);assert.equal(completions,0);
  state.emailVerifiedAt='2026-10-30T00:00:00Z';await click('Reload saved setup');await wait('Verified');
  const confirm=async()=>evaluate("[...document.querySelectorAll('label')].find(l=>l.textContent.includes('I reviewed the saved prerequisites')).querySelector('input').click()");
  await confirm();await click('Mark my setup complete');await wait('Completion could not be confirmed');assert.equal(completions,0);
  completionDenied=false;await click('Reload saved setup');await wait('Fixture Company');await confirm();await click('Mark my setup complete');await wait('Saved completion time');assert.equal(completions,1);
  await cdp('Page.reload',{ignoreCache:true});await wait('Saved completion time');assert.equal(await evaluate("document.body.innerText.includes('2026-10-30T00:00:00Z')"),true);
  await cdp('Page.navigate',{url:'http://127.0.0.1:3140/verify-email?token=synthetic-local-browser-verification-token'});await wait('Verification could not be confirmed');verificationUnavailable=false;await click('Retry verification');await wait('Email verified');assert.equal(await evaluate("location.search"),'');
  verificationExpired=true;await cdp('Page.navigate',{url:'http://127.0.0.1:3140/verify-email?token=synthetic-expired-browser-verification-token'});await wait('This link has expired or was already used');const callsBefore=verificationCalls;await cdp('Page.navigate',{url:'http://127.0.0.1:3140/verify-email?token=short'});await wait('This verification link is incomplete or invalid');assert.equal(verificationCalls,callsBefore);
  await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.navigate',{url:'http://127.0.0.1:3140/my-setup'});await wait('Mis preferencias de configuración');await wait('Perfil de trabajo');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);assert.deepEqual(runtimeErrors,[]);
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'my-setup-mobile.png'),Buffer.from(screenshot.result.data,'base64'));
  report={suite:'my-setup-local-browser',fixtureOnly:true,realAccountChanges:0,loadRecovery:true,saveProfileAndPreferences:true,pauseGuide:true,refreshReopen:true,rejectedSaveNoMutation:true,emailDeferred:true,spanish:true,mobileNoOverflow:true,runtimeErrors};
}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-setup-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(1000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'my-setup-local-browser.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));


