import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import express from 'express';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.APPROVED_SNAPSHOT_REVIEW_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Admin',companyId:31,companyName:'Fixture',isSuperAdmin:true};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let failedRead=false,historyFails=true,patches=0,histories=0;let rows=[{id:7,projectId:91,viewpointId:'fixture-vp',displayId:'HV-001',note:'Fixture original note',trade:'HVAC',floor:'1',priority:3,status:'open',lifecycleStatus:'active',revisionNumber:1,capturedAt:'2026-10-01T00:00:00Z'}];
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/projects/91/financial/snapshots/snapshot-one')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/config',(_req,res)=>res.json({member_role:[{value:'project_admin',label:'Project administrator',labelEs:'Administrador de proyecto',meta:{permission:'admin'}}]}));
app.get('/api/v1/auth/access-profile',(_req,res)=>res.json({facts:{authenticated:true,isSuperAdmin:true,canAccessLivingBrief:false,isCompanyPmo:false,isFinancialAdministrator:false,activeProjectRoles:[],activeProjects:[{id:91,role:'project_admin'}]},decisions:Object.fromEntries(['dashboard','project_workspace','project_administration','total_control','living_brief','company_catalogs','company_pricing','company_workflows','feedback_administration'].map(key=>[key,{allow:true,code:'fixture_super_admin'}]))}));
app.get('/api/v1/projects/:id',(_req,res)=>res.json({id:91,code:'FIX',name:'Fixture Project',status:'active',createdById:71,companyId:31}));
app.get('/api/v1/projects/:id/members',(_req,res)=>res.json([{id:1,userId:71,role:'project_admin',status:'active',fullName:user.fullName}]));
app.get('/api/v1/projects/:id/clash-reports',(_req,res)=>res.json([]));
app.get('/api/v1/projects/:id/clash-reports/lens-pull',(_req,res)=>{if(failedRead){res.status(503).json({error:'fixture unavailable'});return;}res.json({success:true,viewpoints:rows});});


let mode='good',downloads=0,xlsxDownloads=0;const languages:string[]=[];const fingerprint='a'.repeat(64),pdfBytes=Buffer.from('%PDF-1.7\n% synthetic local download-control fixture\n%%EOF'),pdfHash=createHash('sha256').update(pdfBytes).digest('hex'),xlsxBytes=Buffer.concat([Buffer.from([80,75,3,4]),Buffer.from('synthetic local workbook download-control fixture')]);
const snapshot={id:'snapshot-one',budgetVersionId:'budget-v1',budgetVersion:1,status:'approved',currency:'USD',total:'300',originalTotal:'300',currentTotal:'300',differenceFromOriginal:'0',contentFingerprint:fingerprint,snapshotFingerprint:'b'.repeat(64),approvedAt:'2026-10-01',approvedById:90,approvalLimit:'1000',lines:[{id:'line-one',stable_line_id:'L1',project_code:'01',project_name:'Drawing',hierarchical_path:'01',description:'Fixture drawing work',amount:'300',quantity:'10',unit:'Hours',unit_rate:'30',notes:'Fixture note',sort_order:0}]};
app.get('/api/v1/projects/:id/financial/snapshots/:snapshot',(req,res)=>res.json({project:{id:mode==='wrongread'?999:Number(req.params.id),name:'Fixture Project',code:'FIX',companyName:'Fixture'},libraries:[],structures:[],nodes:[],budgets:[],snapshots:[snapshot],snapshot,boundary:{en:'Operational baseline',es:'Línea base operativa'}}));
for(const format of ['pdf','xlsx'])app.get('/api/v1/projects/:id/financial/snapshots/:snapshot/export.'+format,async(req,res)=>{
 if(format==='pdf'){downloads++;languages.push(String(req.query.lang));}else xlsxDownloads++;
 const captured=mode;if(captured==='slow')await new Promise(r=>setTimeout(r,600));
 if(captured==='denied'){res.status(403).json({error:{en:'Current export authority required'}});return;}
 const body=captured==='badbody'?Buffer.from('invalid file body'):format==='pdf'?pdfBytes:xlsxBytes;
 res.type(captured==='mime'?'text/plain':format==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').set({'Cache-Control':'private, no-store','X-BIMLog-Project-Id':captured==='wrongproject'?'999':req.params.id,'X-BIMLog-Snapshot-Id':captured==='wrongsnapshot'?'other':snapshot.id,'X-BIMLog-Budget-Version':captured==='wrongversion'?'2':'1','X-BIMLog-Snapshot-Fingerprint':captured==='wrongfingerprint'?'c'.repeat(64):snapshot.snapshotFingerprint,'X-BIMLog-Budget-Content-Fingerprint':captured==='wrongcontent'?'c'.repeat(64):fingerprint,'Content-Disposition':'attachment; filename="../../'+(captured==='slow'?'stale':captured==='wrongextension'?'wrong.exe':'snapshot-reported.'+format)+'"'});
 if(captured!=='nohash')res.set('X-BIMLog-Artifact-SHA256',captured==='badhash'?'0'.repeat(64):createHash('sha256').update(body).digest('hex'));res.send(body);
});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3196,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-approved-snapshot-review-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9406',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3196/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let reportResult:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9406/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3196'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};


 await cdp('Runtime.enable');await cdp('Page.enable');assert.ok(!(await cdp('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:path.resolve(output),eventsEnabled:true})).error);await cdp('Page.reload',{ignoreCache:true});await wait('Download XLSX Workbook');

 const click=async(text:string,double=false)=>{await evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled);if(!b)throw Error('Missing enabled '+${JSON.stringify(text)});b.click();${double?'b.click();':''}})()`);if(mode==='slow')return;await delay(150);for(let i=0;i<60;i++){if(await evaluate("![...document.querySelectorAll('button')].some(b=>b.textContent.includes('Preparing')||b.textContent.includes('Preparando'))"))break;await delay(50);}};
 for(const format of ['pdf','xlsx']){
 const target=path.join(output,'snapshot-reported.'+format);if(fs.existsSync(target))fs.unlinkSync(target);
 for(const invalid of ['denied','wrongproject','wrongsnapshot','wrongversion','wrongfingerprint','wrongcontent','mime','badhash','badbody','nohash']){
 mode=invalid;await click(format==='pdf'?'Generate PDF Report':'Download XLSX Workbook');
 await wait(invalid==='denied'?'Current export authority required':['badhash','badbody','nohash'].includes(invalid)?'integrity verification failed':'does not match this exact approved');assert.equal(fs.existsSync(target),false);
 }
 mode='good';const before=format==='pdf'?downloads:xlsxDownloads;await click(format==='pdf'?'Generate PDF Report':'Download XLSX Workbook',true);await wait('Exact approved snapshot '+format.toUpperCase()+' downloaded after SHA-256 verification');
 for(let i=0;i<60&&!fs.existsSync(target);i++)await delay(100);assert.deepEqual(fs.readFileSync(target),format==='pdf'?pdfBytes:xlsxBytes);assert.equal(format==='pdf'?downloads:xlsxDownloads,before+1);
 }
 mode='wrongextension';await click('Generate PDF Report');for(let i=0;i<60&&!fs.existsSync(path.join(output,'approved-budget-baseline.pdf'));i++)await delay(100);assert.ok(fs.existsSync(path.join(output,'approved-budget-baseline.pdf')));
 mode='slow';await click('Download XLSX Workbook');await cdp('Page.navigate',{url:'http://127.0.0.1:3196/projects/92/financial/snapshots/snapshot-one'});await delay(900);assert.equal(fs.existsSync(path.join(output,'stale')),false);
 mode='wrongread';await cdp('Page.navigate',{url:'http://127.0.0.1:3196/projects/91/financial/snapshots/snapshot-one'});await wait('Snapshot evidence is incomplete');assert.equal(await evaluate("document.body.innerText.includes('Fixture drawing work')"),false);
 mode='good';await cdp('Page.reload',{ignoreCache:true});await wait('Fixture drawing work');await cdp('Page.reload',{ignoreCache:true});await wait('Fixture drawing work');
 await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await wait('Descargar libro XLSX');await click('Generar reporte PDF');await wait('Instantánea aprobada exacta PDF descargada');assert.equal(languages.at(-1),'es');
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate("document.documentElement.scrollWidth<=innerWidth"),true);const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'approved-snapshot-mobile.png'),Buffer.from(screenshot.result.data,'base64'));
 await cdp('Page.navigate',{url:'http://127.0.0.1:3196/all-tools'});await evaluate("localStorage.setItem('bimlog-lang','en')");await cdp('Page.reload',{ignoreCache:true});await wait('Search tools, tasks, and purposes');await evaluate("(()=>{const i=document.querySelector('#all-tools-search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Approved Budget Snapshot');i.dispatchEvent(new Event('input',{bubbles:true}));})()");await delay(150);assert.equal(await evaluate("document.body.innerText.includes('Approved Budget Snapshot and Verified Exports')"),true);assert.deepEqual(runtimeErrors,[]);
 reportResult={suite:'approved-snapshot-local-browser',fixtureOnly:true,actualSnapshotWorkspace:true,exactPDFAndXLSXBytes:true,scopeVersionFingerprintsMimeMagicAndHashRefused:true,doubleClickOneRequest:true,filenameSanitized:true,wrongExtensionFallback:true,scopeAbort:true,wrongReadRefused:true,refreshReopen:true,spanishPDF:true,mobile390NoOverflow:true,allToolsDiscoverable:true,downloads,xlsxDownloads,runtimeErrors};

}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-approved-snapshot-review-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(5000);try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});}catch(error){const cleanup=spawnSync('powershell.exe',['-NoProfile','-Command','Remove-Item -LiteralPath $env:BIMLOG_OWNED_PROFILE -Recurse -Force -ErrorAction Stop'],{env:{...process.env,BIMLOG_OWNED_PROFILE:profile},windowsHide:true});assert.equal(cleanup.status,0);assert.equal(fs.existsSync(profile),false);}
}
fs.writeFileSync(path.join(output,'approved-snapshot-review-local-browser.json'),`${JSON.stringify(reportResult,null,2)}\n`);console.log(JSON.stringify(reportResult,null,2));

