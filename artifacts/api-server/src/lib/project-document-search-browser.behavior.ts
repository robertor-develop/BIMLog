import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.PROJECT_DOCUMENT_SEARCH_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let failedRead=false,historyFails=true,patches=0,histories=0;let rows=[{id:7,projectId:91,viewpointId:'fixture-vp',displayId:'HV-001',note:'Fixture original note',trade:'HVAC',floor:'1',priority:3,status:'open',lifecycleStatus:'active',revisionNumber:1,capturedAt:'2026-10-01T00:00:00Z'}];
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/project-document-search?projectId=91')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[{id:91,role:'project_admin'}]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/clash-reports',(_req,res)=>res.json([]));
app.get('/api/v1/projects/:id/clash-reports/lens-pull',(_req,res)=>{if(failedRead){res.status(503).json({error:'fixture unavailable'});return;}res.json({success:true,viewpoints:rows});});


let mode='good',searches=0,questions=0,downloads=0;
const docs=[{id:7,fileName:'Fixture.pdf',fileType:'pdf',uploadedByName:'Fixture reader',uploadedAt:'2026-10-01T00:00:00Z',matchType:'pdf_content',excerpt:'Floor seven evidence',version:2,status:'compliant',isSuperseded:false,isHistoricalRecord:false},{id:8,fileName:'Historical.ifc',fileType:'ifc',uploadedByName:'Fixture reader',uploadedAt:'2026-09-01T00:00:00Z',matchType:'bim_metadata',excerpt:'Level=7',version:1,status:'compliant',isSuperseded:true,isHistoricalRecord:true}];
app.get('/api/v1/projects/:id/documents/search',async(req,res)=>{searches++;const captured=mode,query=String(req.query.q);if(captured==='slow')await new Promise(resolve=>setTimeout(resolve,500));if(captured==='denied'){res.status(403).json({error:'denied'});return;}const rows=captured==='empty'?[]:docs.map((row,index)=>({...row,fileName:query==='old'?'Old-result'+index+'.pdf':row.fileName}));res.set('X-BIMLog-Project-Id',captured==='wrong'?'999':req.params.id).json({results:rows,query,total:rows.length});});
app.post('/api/v1/projects/:id/documents/ai-search',async(req,res)=>{questions++;await new Promise(resolve=>setTimeout(resolve,100));if(mode==='setup'){res.status(428).json({error:'AI setup required'});return;}assert.equal(typeof req.body.question,'string');res.set('X-BIMLog-Project-Id',req.params.id).json({answer:'Fixture answer based on excerpts; verify the originals.',relevantFiles:docs,totalFiles:2,contextTruncated:true});});
app.get('/api/v1/projects/:id/files/:file/download',(_req,res)=>{downloads++;res.type('application/pdf').send(Buffer.from('fixture exact original bytes'));});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3174,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-project-document-search-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9384',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3174/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let reportResult:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9384/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3174'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};


 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Search Project Documents');
 const click=async(text:string,double=false)=>evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});b.click();${double?'b.click();':''}})()`);
 const field=async(selector:string,value:string)=>evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(i instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await field('main form input','Floor');await click('Search saved documents',true);await wait('Fixture.pdf');assert.equal(searches,1);await wait('Superseded');
 await evaluate("window.fixtureDownloads=[];HTMLAnchorElement.prototype.click=function(){const entry={filename:this.download,text:null};window.fixtureDownloads.push(entry);fetch(this.href).then(r=>r.text()).then(text=>entry.text=text);};");await click('Download this original file');for(let i=0;i<100&&!(await evaluate("window.fixtureDownloads[0]?.text"));i++)await delay(50);assert.equal(await evaluate("window.fixtureDownloads[0].text"),'fixture exact original bytes');assert.equal(downloads,1);
 mode='setup';await field('main textarea','Which floor is current?');await click('Ask AI about documents');await wait('AI setup is required');assert.equal(questions,1);assert.equal(await evaluate("document.body.innerText.includes('AI draft answer')"),false);
 mode='good';await click('Ask AI about documents',true);await wait('AI draft answer');await wait('not a complete document review');assert.equal(questions,2);
 mode='denied';await click('Search saved documents');await wait('Access denied');assert.equal(await evaluate("document.body.innerText.includes('Fixture.pdf')"),false);
 mode='wrong';await click('Search saved documents');await wait('response did not match');mode='empty';await click('Search saved documents');await wait('No source documents matched');
 mode='slow';await field('main form input','old');await click('Search saved documents');await delay(50);await field('main form input','new');mode='good';await click('Search saved documents');await wait('Fixture.pdf');await delay(600);assert.equal(await evaluate("document.body.innerText.includes('Old-result')"),false);
 await cdp('Page.reload',{ignoreCache:true});await wait('Search saved documents');assert.equal(await evaluate("document.querySelector('main form input').value"),'new');assert.equal(await evaluate("document.body.innerText.includes('Fixture.pdf')"),false);
 await cdp('Page.navigate',{url:'http://127.0.0.1:3174/all-tools'});await wait('Search tools, tasks, and purposes');await field('#all-tools-search','Search Project Documents');await delay(100);await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Search Project Documents')).click()");await wait('Search saved documents');
 await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await wait('Buscar documentos del proyecto');await field('main form input','Floor');await click('Buscar documentos guardados');await wait('Fixture.pdf');
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'project-document-search-mobile.png'),Buffer.from(screenshot.result.data,'base64'));assert.deepEqual(runtimeErrors,[]);
 reportResult={suite:'project-document-search-local-browser',fixtureOnly:true,doubleSearchOneRead:true,versionStatesVisible:true,exactOriginalDownload:true,AIsetupFailureRecoverable:true,AIdoubleOneRequest:true,truncationVisible:true,deniedWrongScopeEmpty:true,editedQueryAbortsStaleResponse:true,refreshQueryButNoStaleResults:true,allToolsDiscoverable:true,spanishMobileNoOverflow:true,searches,questions,downloads,runtimeErrors};

}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-project-document-search-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(1000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'project-document-search-local-browser.json'),`${JSON.stringify(reportResult,null,2)}\n`);console.log(JSON.stringify(reportResult,null,2));


