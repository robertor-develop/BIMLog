import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.BRIEF_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());
const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let users=[{id:72,email:'member@example.test',fullName:'Fixture Member',isSuperAdmin:false,canAccessLivingBrief:false},{id:71,email:user.email,fullName:user.fullName,isSuperAdmin:true,canAccessLivingBrief:false}];
let failList=false,failSave=false,posts=0,docsMode='ok',recoveryVersion=1,resetDenied=true,resetCount=0;
const fixtureDoc={key:'fixture',name:'Fixture source',label:{en:'Fixture source',es:'Fuente de prueba'},content:'# Verified fixture content',status:'Current',sourceCommit:'fixture-source',contentSha256:'a'.repeat(64),reconciledThroughCommit:'fixture-source',semanticReviewedThroughCommit:'fixture-source',semanticReviewTask:'fixture-review',semanticReviewResult:'reviewed_no_semantic_change',semanticReviewedAt:'2026-10-29T00:00:00Z',deployedSourceCommit:'fixture-source',sourceChangedAt:'2026-10-29T00:00:00Z',mirrorSyncedAt:null,mirrorContentSha256:null};
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/living-brief')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:true,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/living-brief/eligibility',(_req,res)=>res.json({eligible:true,isSuperAdmin:true}));
app.post('/api/v1/living-brief/unlock',(_req,res)=>res.json({briefToken:'synthetic-only'}));
app.get('/api/v1/living-brief/password/recovery',(_req,res)=>res.json({credentialConfigured:true,expectedCredentialVersion:recoveryVersion}));
app.post('/api/v1/living-brief/password',(req,res)=>{assert.equal(req.body.expectedCredentialVersion,recoveryVersion);assert.equal(req.body.confirmation,'RESET_LIVING_BRIEF_GATE');if(resetDenied){res.status(409).json({error:'RECOVERY_VERSION_STALE'});return;}resetCount++;recoveryVersion++;res.json({ok:true});});
app.get('/api/v1/living-brief/docs',(_req,res)=>{if(docsMode==='unavailable'){res.status(503).json({error:'fixture unavailable'});return;}if(docsMode==='denied'){res.status(403).json({error:'fixture revoked'});return;}res.json({docs:docsMode==='malformed'?[{key:'broken'}]:docsMode==='empty'?[]:[fixtureDoc]});});
app.get('/api/v1/living-brief/access',(_req,res)=>{if(failList){res.status(503).json({error:'fixture unavailable'});return;}res.json({users});});
app.post('/api/v1/living-brief/access',(req,res)=>{posts++;if(failSave){res.status(403).json({error:'fixture denied'});return;}assert.equal(req.body.userId,72);assert.equal(typeof req.body.grant,'boolean');users=users.map(u=>u.id===72?{...u,canAccessLivingBrief:req.body.grant}:u);setTimeout(()=>res.json({ok:true}),150);});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3136,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-brief-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9346',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3136/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let report:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9346/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3136'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}await evaluate("document.querySelector('details')?.setAttribute('open','')");throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};

  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Copy Full Brief');
  const click=async(text:string)=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
  await click('Admin');await wait('Grant access');assert.equal(await evaluate("document.querySelectorAll('button[aria-label*=fixture]').length"),0);
  await click('Grant access');await wait('Revoke access');assert.equal(users[0].canAccessLivingBrief,true);assert.equal(posts,1);
  await cdp('Page.reload',{ignoreCache:true});await wait('Copy Full Brief');await click('Admin');await wait('Revoke access');
  await click('Revoke access');await wait('Grant access');assert.equal(users[0].canAccessLivingBrief,false);assert.equal(posts,2);
  failSave=true;await click('Grant access');await wait('Permission change was rejected');assert.equal(users[0].canAccessLivingBrief,false);
  failSave=false;await click('Reload saved permissions');await wait('Grant access');
  failList=true;await click('Reload saved permissions');await wait('Access list could not be loaded');assert.equal(await evaluate("document.querySelectorAll('button[aria-label*=member]').length"),0);
  failList=false;await click('Reload saved permissions');await wait('Grant access');
  await click('Load recovery status');await wait('Configured credential version: 1');
  const fill=async(placeholder:string,value:string)=>evaluate(`(()=>{const input=[...document.querySelectorAll('input')].find(i=>i.placeholder===${JSON.stringify(placeholder)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent==='Reset gate credential').disabled"),true);
  await fill('Confirm account password','synthetic-fixture-account');await fill('New gate password (12+ chars)','synthetic-fixture-gate');await fill('Audit reason','Synthetic isolated reset acceptance');await fill('RESET_LIVING_BRIEF_GATE','RESET_LIVING_BRIEF_GATE');await click('Reset gate credential');await wait('RECOVERY_VERSION_STALE');assert.equal(resetCount,0);
  resetDenied=false;await click('Load recovery status');await wait('Configured credential version: 1');await fill('Confirm account password','synthetic-fixture-account');await fill('New gate password (12+ chars)','synthetic-fixture-gate');await click('Reset gate credential');await wait('Gate credential updated');assert.equal(resetCount,1);assert.equal(await evaluate("[...document.querySelectorAll('input[type=password]')].every(i=>i.value==='')"),true);
  await wait('Verified fixture content');docsMode='unavailable';await click('Reload');await wait('Documents are unavailable.');assert.equal(await evaluate("document.body.innerText.includes('Verified fixture content')"),false);assert.equal(await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Copy Full Brief').disabled"),true);
  docsMode='malformed';await click('Reload');await wait('Invalid Living Brief documents response');
  docsMode='empty';await click('Reload');await wait('No source documents returned');
  docsMode='ok';await click('Reload');await wait('Verified fixture content');
  docsMode='denied';await click('Reload');await wait('Opening Living Brief');assert.equal(await evaluate("document.body.innerText.includes('Verified fixture content')"),false);
  docsMode='ok';await click('Retry');await wait('Verified fixture content');
  await cdp('Page.reload',{ignoreCache:true});await wait('Verified fixture content');await click('Admin');await wait('Grant access');
  await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await wait('Copiar Brief completo');await click('Administrar');await wait('Conceder acceso');await wait('Siempre autorizado');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);assert.deepEqual(runtimeErrors,[]);
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'living-brief-access-mobile.png'),Buffer.from(screenshot.result.data,'base64'));
  report={suite:'living-brief-access-local-browser',fixtureOnly:true,realPermissionsChanged:0,grant:true,revoke:true,refreshReopen:true,saveDenied:true,listUnavailableRecovery:true,recoveryVersion:true,staleResetRejected:true,syntheticReset:true,secretFieldsCleared:true,documentUnavailableRecovery:true,malformedDocuments:true,emptyDocuments:true,revokedDocumentsCleared:true,documentRefreshReopen:true,mobileNoOverflow:true,runtimeErrors};
}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-brief-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(1000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'living-brief-access-local-browser.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));


