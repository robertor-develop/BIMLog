import assert from 'node:assert/strict';
import express from 'express';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const output=process.env.CATALOG_BROWSER_EVIDENCE_DIR;if(!output)throw new Error('Local evidence directory required');fs.mkdirSync(output,{recursive:true});
const app=express();app.use(express.json());const user={id:71,email:'fixture@example.test',fullName:'Fixture Reader',companyId:31,companyName:'Fixture',isSuperAdmin:false};
const fixtureToken=`e30.${Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.synthetic-local-fixture`;
let unavailable=false;const requests:string[]=[];
app.get('/seed',(_req,res)=>res.type('html').send(`<script>localStorage.setItem('bimlog-auth',${JSON.stringify(JSON.stringify({state:{token:fixtureToken,user,changedAt:Date.now()},version:1}))});localStorage.setItem('bimlog-lang','en');location.replace('/master-catalogs')</script>`));
app.get('/api/v1/auth/me',(_req,res)=>res.json(user));
app.get('/api/v1/master-catalogs/:catalog',(req,res)=>{requests.push(req.originalUrl);if(unavailable){res.status(503).json({error:'fixture unavailable'});return;}if(req.query.projectId==='99'){res.status(403).json({error:'fixture denied'});return;}res.json({catalog:req.params.catalog,governed:true,entries:[{id:'saved-'+req.params.catalog,code:'FIX',name:'Fixture '+req.params.catalog,aliases:['fixture-alias'],state:'active',version:3,source:'company'}]});});
app.all('/api/v1/*path',(_req,res)=>res.json([]));app.use(express.static(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public')));app.get('*path',(_req,res)=>res.sendFile(path.resolve(process.cwd(),'../../artifacts/bimlog/dist/public/index.html')));
const server=app.listen(3137,'127.0.0.1');await new Promise<void>((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
const profile=path.resolve(os.tmpdir(),`bimlog-catalog-browser-${process.pid}`),browser=spawn(process.env.BIMLOG_BROWSER_PATH??'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9347',`--user-data-dir=${profile}`,'--window-size=1280,900','http://127.0.0.1:3137/seed'],{stdio:'ignore',windowsHide:true});
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));let socket:WebSocket|null=null;let seq=0;const pending=new Map<number,(value:any)=>void>(),runtimeErrors:string[]=[];let report:unknown=null;
try{
  let page:any;for(let i=0;i<60;i++){try{const pages=await fetch('http://127.0.0.1:9347/json/list').then(response=>response.json()) as any[];page=pages.find(value=>value.type==='page'&&String(value.url).includes('127.0.0.1:3137'));if(page)break;}catch(_expectedStartupFailure){void _expectedStartupFailure;}await delay(200);}assert.ok(page?.webSocketDebuggerUrl);
  socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Fixture browser websocket failed'));});socket.onmessage=event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(JSON.stringify(message.params.exceptionDetails));if(message.id&&pending.has(message.id)){pending.get(message.id)!(message);pending.delete(message.id);}};
  const cdp=(method:string,params:Record<string,unknown>={})=>new Promise<any>(resolve=>{const id=++seq;pending.set(id,resolve);socket!.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression:string)=>{const response=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(response.result?.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result?.result?.value;};
  const wait=async(text:string)=>{for(let i=0;i<100;i++){if(String(await evaluate("document.body?.innerText??''")).includes(text))return;await delay(100);}throw new Error(`Fixture UI did not show ${text}: ${await evaluate("document.body?.innerText??''")}`);};

  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.reload',{ignoreCache:true});await wait('Fixture services');
  const click=async(text:string)=>evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}).click()`);
  const input=async(index:number,value:string)=>evaluate(`(()=>{const input=document.querySelectorAll('input')[${index}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  for(const kind of ['clients','disciplines','phases','services']){await evaluate(`(()=>{const select=document.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(select,${JSON.stringify(kind)});select.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait('Fixture '+kind);await wait('saved-'+kind);}
  await input(1,'fixture-alias');await wait('1 of 1 entries');await input(1,'no-match');await wait('0 of 1 entries');await input(1,'');
  await input(0,'-1');await click('Apply scope');await wait('Use a positive whole project ID');assert.equal(requests.some(value=>value.includes('projectId=-1')),false);
  await input(0,'99');await click('Apply scope');await wait('Access to this project catalog was denied');assert.equal(await evaluate("document.body.innerText.includes('saved-services')"),false);
  await input(0,'91');await click('Apply scope');await wait('Fixture services');assert.equal(requests.some(value=>value.endsWith('services?projectId=91')),true);
  unavailable=true;await click('Reload saved catalog');await wait('Catalog unavailable or invalid');unavailable=false;await click('Reload saved catalog');await wait('Fixture services');
  await cdp('Page.reload',{ignoreCache:true});await wait('Fixture services');await evaluate("localStorage.setItem('bimlog-lang','es')");await cdp('Page.reload',{ignoreCache:true});await wait('Catálogos maestros disponibles');await wait('Fuente');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);assert.deepEqual(runtimeErrors,[]);
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,'master-catalog-mobile.png'),Buffer.from(screenshot.result.data,'base64'));
  report={suite:'master-catalog-local-browser',fixtureOnly:true,realCatalogChanges:0,allFourCatalogs:true,aliasesSearch:true,invalidScopeNoRequest:true,deniedScopeClearsRecords:true,projectScope:true,reloadRecovery:true,refreshReopen:true,spanish:true,mobileNoOverflow:true,runtimeErrors};
}finally{
  if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));if(browser.exitCode===null)await Promise.race([new Promise(resolve=>browser.once('exit',resolve)),delay(5000)]);socket.close();}if(browser.exitCode===null)browser.kill();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));if(profile!==path.resolve(os.tmpdir(),`bimlog-catalog-browser-${process.pid}`))throw new Error('Task profile identity mismatch');await delay(1000);fs.rmSync(profile,{recursive:true,force:true,maxRetries:20,retryDelay:150});
}
fs.writeFileSync(path.join(output,'master-catalog-local-browser.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));


