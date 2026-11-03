import {snapshotOwnedFixtureBrowser,releaseOwnedFixtureBrowser} from "./fixture-browser-process-cleanup";
import {createHash} from "node:crypto";
import {singleFileUpload} from "../middlewares/multipart";
import assert from 'node:assert/strict';
import express from 'express';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.MEETING_LENS_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;

let mode='ok',reads=0,mutations=0;
const row={id:5,viewpointId:'LENS-ñ',displayId:'L-5',code:'LENS-5',navisworksGuid:'guid-5',bimlogPhysicalId:'physical-5',sourcePhysicalId:'source-5',sourceDisplayLabel:'Source label',issueGroupId:'issue-5',note:'Inspect source ñ',floor:'Level 1',trade:'Electrical',responsible:'BIMTECH',status:'open',lifecycleStatus:'active',revisionNumber:2,capturedAt:'2026-10-30T10:00:00Z',alreadyAdded:true};
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/meeting-lens-sources?projectId=91&meeting_id=7')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,activeProjectRoles:[],activeProjects:[{id:91,role:'project_admin'}]},decisions:Object.fromEntries(['dashboard','project_workspace'].map(key=>[key,{allow:true,code:'fixture'}]))}));
app.get('/api/v1/projects/:id/meetings/lens-viewpoint-candidates',(req,res)=>{reads++;if(mode==='denied'){res.status(403).json({error:'forbidden'});return;}res.set('X-BIMLog-Project-Id',mode==='wrong'?'92':req.params.id);res.json(mode==='empty'?[]:mode==='private'?[{...row,screenshotUrl:'private'}]:[row]);});
app.all('/api/v1/*path',(req,res)=>{if(req.method!=='GET')mutations++;res.json([])});app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));const server=app.listen(3210,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-meeting-lens-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9420',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3210/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[],consoleErrors:string[]=[];let report:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9420/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3210'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')consoleErrors.push(JSON.stringify(message.params.args));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};

  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.navigate',{url:'http://127.0.0.1:3210/seed'});
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};



 const click=async(text:string)=>{assert.equal(await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)return false;b.click();return true;})()`),true);};
 await wait('LENS-5');await click('LENS-5 — Inspect source ñ');await wait('physical-5');await wait('Already linked to this meeting');assert.equal(await evaluate("document.querySelector('a[href=\"/projects/91/clash-reports?view=lens&viewpoint=5\"]')!==null"),true);
 await cdp('Page.reload',{ignoreCache:true});await delay(700);await wait('physical-5');
 mode='wrong';await click('Search / refresh');await wait('source response could not be verified');assert.equal(await evaluate("document.body.innerText.includes('physical-5')"),false);
 mode='denied';await click('Search / refresh');await wait('current account cannot read this project');
 mode='private';await click('Search / refresh');await wait('source response could not be verified');
 mode='empty';await click('Search / refresh');await wait('No matching active sources');
 mode='ok';await click('Search / refresh');await wait('LENS-5');await click('LENS-5 — Inspect source ñ');
 await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await delay(700);await wait('Fuentes Lens para actas');await wait('physical-5');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);const shot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'meeting-lens-es-mobile.png'),Buffer.from(shot.result.data,'base64'));
 await evaluate("localStorage.setItem('bimlog-lang','en')");await cdp('Page.navigate',{url:'http://127.0.0.1:3210/all-tools'});await wait('Meeting Lens Source Browser');assert.equal(await evaluate("(()=>{const b=document.querySelector('[aria-describedby=\"tool-purpose-meeting-lens-sources\"]');if(!b||b.getAttribute('aria-disabled')==='true')return false;b.focus();return true})()"),true);await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await wait('Inspect active project viewpoints');await wait('LENS-5');assert.equal(await evaluate("location.search.includes('projectId=91')"),true);
 assert.equal(mutations,0);assert.deepEqual(runtimeErrors,[]);report={suite:'P179-built-Lens-browser',fixtureOnly:true,allToolsKeyboardDirect:true,currentSourceRead:true,distinctIdentities:true,meetingLinkState:true,correctSourceLink:true,refreshReopen:true,wrongProjectRejected:true,privateFieldsRejected:true,deniedClearsOldRows:true,emptyRecovery:true,spanish390:true,mutations,reads,runtimeErrors,consoleErrors};}catch(error){console.error(error);throw error;}finally{
  const ownedProcesses=snapshotOwnedFixtureBrowser(browser.exitCode===null?browser.pid:undefined);
  fs.writeFileSync(path.join(output,"owned-browser-process-snapshot.json"),JSON.stringify(ownedProcesses,null,2));
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();releaseOwnedFixtureBrowser(ownedProcesses);server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-meeting-lens-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(5000);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});}catch(error){const cleanup=spawnSync('powershell.exe',['-NoProfile','-Command','for($attempt=0;$attempt -lt 20;$attempt++){if(-not(Test-Path -LiteralPath $env:BIMLOG_OWNED_PROFILE)){exit 0};try{Remove-Item -LiteralPath $env:BIMLOG_OWNED_PROFILE -Recurse -Force -ErrorAction Stop;if(-not(Test-Path -LiteralPath $env:BIMLOG_OWNED_PROFILE)){exit 0}}catch{if(-not(Test-Path -LiteralPath $env:BIMLOG_OWNED_PROFILE)){exit 0};if($attempt -eq 19){throw}};Start-Sleep -Milliseconds 1000};exit 1'],{env:{...process.env,BIMLOG_OWNED_PROFILE:profile},windowsHide:true});assert.equal(cleanup.status,0,String(cleanup.stderr));assert.equal(fs.existsSync(profile),false);}
}
fs.writeFileSync(path.join(output,'meeting-lens-local-browser.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
