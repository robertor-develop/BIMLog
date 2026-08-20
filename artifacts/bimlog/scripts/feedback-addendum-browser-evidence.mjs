import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const need = n => { const v = process.env[n]; if (!v) throw new Error(`${n} is required`); return v; };
const verifySourceOnly = process.argv.includes("--verify-source-only");
const sha = v => createHash("sha256").update(v).digest("hex"), fileSha = f => sha(readFileSync(f));
const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const tree = execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim();
const git = (args, options = {}) => execFileSync("git", args, { encoding: "utf8", ...options });
const productionInputs = ["artifacts/bimlog/src", "artifacts/bimlog/public", "artifacts/bimlog/index.html", "artifacts/bimlog/package.json", "artifacts/bimlog/vite.config.ts", "artifacts/bimlog/tsconfig.json", "lib/api-client-react", "lib/api-zod", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.base.json"];
const relevantStatus = git(["status", "--porcelain=v1", "--untracked-files=all", "--", ...productionInputs]).trim();
if (relevantStatus) throw new Error(`Relevant production inputs are not clean at ${head}:\n${relevantStatus}`);
const sourcePaths = git(["ls-tree", "-r", "--name-only", head, "--", ...productionInputs]).split(/\r?\n/).filter(Boolean).sort();
if (!sourcePaths.length) throw new Error("No immutable production inputs resolved from Git");
const normalizeEol = bytes => Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"));
const sourceProvenance = Object.fromEntries(sourcePaths.map(relativePath => {
  const blobId = git(["rev-parse", `${head}:${relativePath}`]).trim();
  const gitBytes = execFileSync("git", ["cat-file", "blob", blobId], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 });
  const checkoutBytes = readFileSync(path.resolve(relativePath));
  const gitNormalized = normalizeEol(gitBytes), checkoutNormalized = normalizeEol(checkoutBytes);
  if (!gitNormalized.equals(checkoutNormalized)) throw new Error(`Checkout differs from immutable Git object after EOL normalization: ${relativePath}`);
  const text = checkoutBytes.toString("utf8"), crlf = (text.match(/\r\n/g) || []).length, bareLf = (text.match(/(?<!\r)\n/g) || []).length;
  return [relativePath, { gitBlobId: blobId, gitBlobSha256: sha(gitBytes), checkoutSha256: sha(checkoutBytes), checkoutNormalizedSha256: sha(checkoutNormalized), bytes: checkoutBytes.length, eol: crlf && bareLf ? "mixed" : crlf ? "crlf" : bareLf ? "lf" : "binary-or-no-newline", eolPolicy: "checkout bytes must equal immutable Git blob bytes after CRLF-to-LF normalization" }];
}));
const harnessPath = "artifacts/bimlog/scripts/feedback-addendum-browser-evidence.mjs";
const harnessBlobId = git(["rev-parse", `${head}:${harnessPath}`]).trim();
const harnessGitBytes = execFileSync("git", ["cat-file", "blob", harnessBlobId], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }), harnessCheckoutBytes = readFileSync(new URL(import.meta.url));
if (!normalizeEol(harnessGitBytes).equals(normalizeEol(harnessCheckoutBytes))) throw new Error("Harness checkout does not match immutable harness Git object");
const harnessProvenance = { gitBlobId: harnessBlobId, gitBlobSha256: sha(harnessGitBytes), checkoutSha256: sha(harnessCheckoutBytes), checkoutNormalizedSha256: sha(normalizeEol(harnessCheckoutBytes)) };
if (verifySourceOnly) {
  console.log(JSON.stringify({ status: "PASS", head, tree, productionInputCount: sourcePaths.length, harness: harnessProvenance }));
  process.exit(0);
}
const playwrightCore = need("BIMLOG_PLAYWRIGHT_CORE"), chromiumExecutable = need("BIMLOG_CHROMIUM_EXECUTABLE");
const baseUrl = need("BIMLOG_FEEDBACK_EVIDENCE_URL").replace(/\/$/, ""), output = path.resolve(need("BIMLOG_FEEDBACK_EVIDENCE_OUTPUT"));
if (existsSync(output)) throw new Error(`Collision guard: ${output} exists`);
mkdirSync(output, { recursive: false });
const { chromium } = (await import(pathToFileURL(playwrightCore).href)).default;
const bundleRoot = path.resolve(process.env.BIMLOG_FEEDBACK_BUNDLE_ROOT || "artifacts/bimlog/dist/public", "assets");
const bundleHashes = Object.fromEntries(readdirSync(bundleRoot).filter(n => /\.js$/.test(n)).sort().map(n => [n, fileSha(path.join(bundleRoot, n))]));
const assertions = [], failures = [], scenarios = [];
const pass = (s, n, detail = true) => assertions.push({ scenario: s, name: n, pass: true, detail });
const check = (s, n, ok, detail = ok) => { if (!ok) { failures.push({ scenario: s, name: n, detail }); throw new Error(`${s}: ${n}`); } pass(s, n, detail); };
const browser = await chromium.launch({ headless: true, executablePath: chromiumExecutable });
const chromiumVersion = await browser.version();

async function run(language, viewport) {
  const sid = `${language}-${viewport.width}x${viewport.height}`, es = language === "es", tt = (en, sp) => es ? sp : en;
  const context = await browser.newContext({ viewport, locale: es ? "es-US" : "en-US", acceptDownloads: true });
  await context.addInitScript(({ language }) => {
    localStorage.setItem("bimlog-lang", language);
    localStorage.setItem("bimlog-auth", JSON.stringify({ state: { token: "bounded-browser-token", user: { id: 501, email: "fixture@example.invalid", fullName: "Local Fixture", isSuperAdmin: false } }, version: 0 }));
    const S = window.__feedbackEvidence = { requests: [], unexpected: [], tracks: [], objectCreated: 0, objectRevoked: 0, micMode: "deny", displayMode: "deny", uploadAttempt: 0, revokeAttempt: 0, revokeMode: "fail", mineMode: "normal", transcriptionAttempt: 0, transcriptionState: "none" };
    const nativeCreateObjectURL=URL.createObjectURL.bind(URL),nativeRevokeObjectURL=URL.revokeObjectURL.bind(URL);URL.createObjectURL = value => { S.objectCreated++; return nativeCreateObjectURL(value); }; URL.revokeObjectURL = value => { S.objectRevoked++; nativeRevokeObjectURL(value); };
    HTMLAnchorElement.prototype.click = function () { S.downloadClicked = { href: this.href, download: this.download }; };
    Object.defineProperty(HTMLMediaElement.prototype,"srcObject",{configurable:true,get(){return this.__boundedStream;},set(value){this.__boundedStream=value;}});
    HTMLMediaElement.prototype.play = async function () { Object.defineProperty(this, "videoWidth", { value: 320 }); Object.defineProperty(this, "videoHeight", { value: 200 }); };
    HTMLCanvasElement.prototype.getContext = () => ({ beginPath(){},clearRect(){},drawImage(){},ellipse(){},fillRect(){},fillText(){},lineTo(){},moveTo(){},rect(){},restore(){},save(){},setLineDash(){},stroke(){},strokeRect(){},translate(){},globalAlpha:1,lineCap:"round",lineJoin:"round",lineWidth:1,strokeStyle:"#000",fillStyle:"#000",font:"12px sans-serif",textBaseline:"top" }); HTMLCanvasElement.prototype.toBlob = cb => cb(new Blob(["png-fixture"], { type: "image/png" }));
    window.createImageBitmap = async () => ({ width: 320, height: 200, close() {} });
    const stream = kind => { const t = { kind, stopped: false, stop() { this.stopped = true; } }; S.tracks.push(t); return { getTracks: () => [t] }; };
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
      getUserMedia: async () => { if (S.micMode === "deny") throw new DOMException("denied", "NotAllowedError"); return stream("audio"); },
      getDisplayMedia: async () => { if (S.displayMode === "deny") throw new DOMException("denied", "NotAllowedError"); return stream("display"); },
    }});
    class Recorder { constructor(x) { this.stream=x; this.state="inactive"; this.mimeType="audio/webm"; } start(){this.state="recording";} pause(){this.state="paused";} resume(){this.state="recording";} stop(){if(this.state==="inactive")return;this.state="inactive";this.ondataavailable?.({data:new Blob(["voice"],{type:this.mimeType})});this.onstop?.();} }
    window.MediaRecorder = Recorder;
    const feedback = () => ({ id:801, stableId:"FB-EVIDENCE801", message:language==="es"?"Evidencia final controlada.":"Final governed evidence.", status:"verified", version:3, dispositionReason:language==="es"?"Verificado localmente.":"Locally verified.", targetRelease:"Feedback addendum", relays:[
      {assetId:901,state:"delivered",version:4,createdAt:"2026-08-17T12:00:00Z",updatedAt:"2026-08-17T12:04:00Z",reason:"delivery-confirmed",history:[{sequence:1,state:"queued",at:"2026-08-17T12:00:00Z",reason:"awaiting-delivery"},{sequence:2,state:"delivered",at:"2026-08-17T12:04:00Z",reason:"delivery-confirmed"}]},
      {assetId:902,state:"held",version:2,createdAt:"2026-08-17T12:00:00Z",updatedAt:"2026-08-17T12:05:00Z",reason:"support-review",history:[{sequence:1,state:"queued",at:"2026-08-17T12:00:00Z"},{sequence:2,state:"held",at:"2026-08-17T12:05:00Z",reason:"support-review"}]}
    ], transcription:S.transcriptionState==="blocked"?{id:71,assetId:903,state:"blocked",reason:"provider-unavailable",reviewState:"pending"}:S.transcriptionState==="completed"?{id:72,assetId:903,state:"completed",result:"Bounded transcript result",reviewState:"pending"}:null });
    const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
    window.fetch=async(input,init={})=>{const pathname=new URL(String(input),location.href).pathname, method=String(init.method||"GET").toUpperCase();const headers=Object.fromEntries(new Headers(init.headers||{}).entries());const r={pathname,method,headers,bodyType:init.body?.constructor?.name||null};if(typeof init.body==="string")try{r.body=JSON.parse(init.body);}catch{r.body=init.body;}if(init.body instanceof FormData)r.form=Object.fromEntries([...init.body.entries()].map(([k,v])=>[k,v instanceof File?{name:v.name,size:v.size,type:v.type}:v]));S.requests.push(r);
      if(pathname==="/api/v1/living-brief/eligibility"&&method==="GET")return json({eligible:false});
      if(pathname==="/api/v1/auth/me"&&method==="GET")return json({user:{id:501,email:"fixture@example.invalid",fullName:"Local Fixture",isSuperAdmin:false}});
      if(pathname==="/api/v1/users/me/company-profile"&&method==="GET")return json({profile:null});
      if(pathname==="/api/v1/projects/77"&&method==="GET")return json({project:{id:77,name:"Controlled Fixture"}});
      if(pathname==="/api/v1/projects/77/members"&&method==="GET")return json({members:[]});
      if(pathname==="/api/v1/config"&&method==="GET")return json({});
      if(pathname==="/api/v1/feedback"&&method==="POST")return json({success:true,feedback:feedback()},201);
      if(pathname==="/api/v1/feedback/capture-consents"&&method==="POST")return json({consent:{id:`consent-${r.body.captureKind}`,captureKind:r.body.captureKind,purpose:r.body.purpose,noticeVersion:"feedback-capture-v1",grantedAt:"2026-08-17T12:00:00Z"}},201);
      if(/\/capture-consents\/[^/]+\/revoke$/.test(pathname)&&method==="POST"){S.revokeAttempt++;return S.revokeMode==="fail"?json({error:"bounded revocation failure"},409):json({revoked:true});}
      if(pathname==="/api/v1/feedback/801/assets"&&method==="POST"){S.uploadAttempt++;if(S.uploadAttempt===2)return json({error:language==="es"?"Carga dirigida fallida":"Targeted upload failed"},503);return json({assets:[{id:900+S.uploadAttempt,scanState:"quarantined"}],replayed:S.uploadAttempt>3},201);}
      if(pathname==="/api/v1/feedback/mine")return S.mineMode==="lost"?json({error:language==="es"?"Membresía perdida":"Membership lost"},403):json({feedback:[feedback()]});
      if(pathname==="/api/v1/feedback/801/history")return json({history:[{id:1,eventType:"created",createdAt:"2026-08-17T12:00:00Z"},{id:2,eventType:"triage_updated",reason:"customer-safe decision",createdAt:"2026-08-17T12:10:00Z"}]});
      if(pathname==="/api/v1/feedback/801/assets"&&method==="GET")return json({assets:[{id:901,kind:"attachment",name:"field-note.txt",scanState:"quarantined"},{id:903,kind:"audio",name:"imported-note.wav",scanState:"clean",downloadUrl:"/api/v1/feedback/801/assets/903/content"}]});
      if(pathname==="/api/v1/feedback/801/package.zip"&&method==="GET")return new Response(new Blob(["package"],{type:"application/zip"}),{headers:{"Content-Type":"application/zip"}});
      if(pathname.endsWith("/assets/903/content"))return new Response(new Blob(["audio"],{type:"audio/wav"}));
      if(pathname==="/api/v1/feedback/801/transcription"&&method==="POST"){S.transcriptionAttempt++;S.transcriptionState=S.transcriptionAttempt===1?"blocked":"completed";return S.transcriptionAttempt===1?json({job:{id:71,state:"blocked"}},424):json({job:{id:72,state:"completed"}},201);}
      if(/\/transcription\/72\/review$/.test(pathname)&&method==="POST"){S.transcriptionReviewed=r.body;return json({success:true});}
      S.unexpected.push({pathname,method});return json({code:"FIXTURE_ROUTE_DENIED"},599);
    };
  }, { language });
  const page=await context.newPage(),consoleErrors=[],pageErrors=[],failedRequests=[];
  page.on("console",m=>{if(m.type()==="error")consoleErrors.push(m.text());});page.on("pageerror",e=>pageErrors.push(e.message));page.on("requestfailed",r=>failedRequests.push({url:r.url(),failure:r.failure()?.errorText}));page.on("dialog",d=>d.accept());
  await page.goto(`${baseUrl}/feedback-evidence`,{waitUntil:"networkidle"});
  const opener=page.getByRole("button",{name:tt("Send BIMLog feedback","Enviar comentarios a BIMLog")});await opener.click();const dialog=page.getByRole("dialog",{name:tt("BIMLog feedback","Comentarios de BIMLog")});await dialog.waitFor();
  check(sid,"actual production App and FeedbackWidget rendered",await dialog.isVisible(),{dialogCount:await dialog.count()});
  check(sid,"initial focus enters dialog",await page.evaluate(()=>document.activeElement?.getAttribute("role")==="dialog"));
  check(sid,"background inert and aria-hidden",await page.evaluate(()=>[...document.querySelectorAll("body *")].some(n=>n instanceof HTMLElement&&n.inert&&n.getAttribute("aria-hidden")==="true")));
  await page.keyboard.press("Shift+Tab");await page.keyboard.press("Tab");check(sid,"focus remains trapped",await dialog.evaluate(n=>n.contains(document.activeElement)));
  const box=await dialog.boundingBox();check(sid,"vertical and horizontal visibility",box&&box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width&&box.y+box.height<=viewport.height,box);
  check(sid,"polite live region is present",await dialog.locator('[aria-live="polite"]').count()>=1);
  await page.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});await page.waitForTimeout(50);check(sid,"Escape closes and restores focus",await page.evaluate(expected=>document.activeElement?.getAttribute("aria-label")===expected,tt("Send BIMLog feedback","Enviar comentarios a BIMLog")));check(sid,"inert restored",await page.evaluate(()=>![...document.querySelectorAll("body *")].some(n=>n instanceof HTMLElement&&n.inert)));
  await opener.click();await page.getByRole("textbox").fill(tt("Final governed evidence.","Evidencia final controlada."));
  await page.getByText(tt("Review voice consent","Revisar consentimiento de voz")).click();await page.getByText(tt("voice consent recorded","consentimiento de voz registrado")).waitFor();pass(sid,"voice consent before capture");
  await page.getByText(tt("Record voice","Grabar voz")).click();await page.getByText(tt("Microphone permission was denied.","Se denegó el permiso del micrófono.")).waitFor();check(sid,"voice denial in assertive live region",await dialog.locator('[role="alert"][aria-live="assertive"]').count()===1);
  await page.evaluate(()=>window.__feedbackEvidence.micMode="success");await page.getByText(tt("Record voice","Grabar voz")).click();await page.getByRole("button",{name:tt("Pause recording","Pausar grabación")}).click();await page.getByRole("button",{name:tt("Resume recording","Reanudar grabación")}).click();await page.getByText(tt("Stop","Detener"),{exact:true}).click();await page.getByText(/feedback-audio-.*\.webm/).waitFor();check(sid,"voice success pause resume stop track cleanup",await page.evaluate(()=>window.__feedbackEvidence.tracks.some(t=>t.kind==="audio"&&t.stopped)));
  await page.getByText(tt("Review screen consent","Revisar consentimiento de pantalla")).click();await page.getByText(tt("screen consent recorded","consentimiento de pantalla registrado")).waitFor();pass(sid,"screen consent before capture");
  await page.getByText(tt("Capture screen","Capturar pantalla")).click();await page.getByText(tt("Screen sharing was cancelled or denied. Nothing was captured.","Se canceló o denegó compartir pantalla. No se capturó nada.")).waitFor();pass(sid,"screen denial visible");
  await page.evaluate(()=>window.__feedbackEvidence.displayMode="success");await page.getByText(tt("Capture screen","Capturar pantalla")).click();const editor=page.getByRole("dialog",{name:tt("BIMLog cutting and markup tool","Herramienta BIMLog de recorte y marcado")});await page.waitForTimeout(100);if(!await editor.count())throw new Error(`${sid}: markup editor did not open; alerts=${JSON.stringify(await page.locator('[role="alert"]').allTextContents())}; dialogs=${JSON.stringify(await page.locator('[role="dialog"]').evaluateAll(nodes=>nodes.map(node=>({label:node.getAttribute('aria-label'),hidden:node.getAttribute('aria-hidden')}))))}`);await editor.waitFor();check(sid,"markup editor owns modal focus",await editor.evaluate(node=>node.contains(document.activeElement))&&await dialog.getAttribute("aria-hidden")==="true");await page.getByRole("button",{name:tt("Attach marked capture","Adjuntar captura marcada")}).click();await page.getByText(/-original\.png/).waitFor();await page.getByText(/-marked\.png/).waitFor();check(sid,"screen capture track cleanup",await page.evaluate(()=>window.__feedbackEvidence.tracks.some(t=>t.kind==="display"&&t.stopped)));
  await page.locator('input[type="file"]').setInputFiles([{name:"field-note.txt",mimeType:"text/plain",buffer:Buffer.from("bounded")},{name:"imported-note.wav",mimeType:"audio/wav",buffer:Buffer.from("wave")},{name:"refused.exe",mimeType:"application/octet-stream",buffer:Buffer.from("no")}]);
  await page.getByText(tt("Some files were refused. Use a supported type up to 20 MB.","Se rechazaron algunos archivos. Use un tipo compatible de hasta 20 MB.")).waitFor();check(sid,"heterogeneous imports and refusal",await page.getByText(/field-note\.txt/).count()===1&&await page.getByText(/imported-note\.wav/).count()===1&&await page.getByText(/refused\.exe/).count()===0);
  const shot1=`${sid}-submission.png`;await page.screenshot({path:path.join(output,shot1)});await page.getByRole("button",{name:tt("Send","Enviar"),exact:true}).click();await page.getByText(tt("Some evidence failed. Retry failed files; completed files will not be duplicated.","Parte de la evidencia falló. Reintente los archivos fallidos; los completados no se duplicarán.")).waitFor();const retry=page.getByRole("button",{name:tt("Retry this file","Reintentar este archivo")});check(sid,"single targeted retry",await retry.count()===1);await retry.click();await page.getByText(tt("Uploaded","Cargado"),{exact:true}).last().waitFor();
  const uploads=await page.evaluate(()=>window.__feedbackEvidence.requests.filter(r=>r.pathname.endsWith("/assets")&&r.method==="POST"));check(sid,"stable per-file retry id",uploads.length>=5&&uploads.at(-1).headers["idempotency-key"]===uploads[1].headers["idempotency-key"],uploads.map(r=>r.headers["idempotency-key"]));const captures=uploads.filter(r=>r.form?.origin==="browser-display-capture");check(sid,"linked original and marked provenance",captures.length===2&&captures[0].form.captureBundleId===captures[1].form.captureBundleId&&new Set(captures.map(r=>r.form.captureRole)).size===2&&captures.some(r=>r.form.captureRole==="original")&&captures.some(r=>r.form.captureRole==="marked")&&captures.every(r=>/sourceSha256/.test(r.form.transformations||"")));
  const post=await page.evaluate(()=>window.__feedbackEvidence.requests.find(r=>r.pathname==="/api/v1/feedback"&&r.method==="POST"));check(sid,"customer payload has no raw internal fields",post&&!/(storageKey|providerPayload|internalNote|relayToken|purgeToken)/i.test(JSON.stringify(post)));
  const closeButton=page.getByRole("button",{name:tt("Close feedback","Cerrar comentarios")});await closeButton.click();await page.getByText(tt("Consent revocation failed. Retry before closing or discarding evidence.","No se pudo revocar el consentimiento. Reintente antes de cerrar o descartar la evidencia.")).waitFor();check(sid,"revocation failure blocks close",await dialog.isVisible());await page.evaluate(()=>window.__feedbackEvidence.revokeMode="success");await closeButton.click();await dialog.waitFor({state:"hidden"});pass(sid,"revocation retry succeeds");
  await opener.click();await page.getByRole("button",{name:tt("My feedback","Mis comentarios")}).click();await page.getByText("FB-EVIDENCE801").waitFor();check(sid,"per-asset localized relay lineages",await page.getByText(/#901/).count()===1&&await page.getByText(/#902/).count()===1&&await page.getByText(tt("Delivery confirmed","Entrega confirmada")).count()>=1&&await page.getByText(tt("Support review required","Se requiere revisión de soporte")).count()>=1);
  await page.getByRole("button",{name:tt("History","Historial")}).click();await page.getByText(/field-note\.txt/).waitFor();await page.getByRole("button",{name:"imported-note.wav"}).click();await page.waitForTimeout(20);check(sid,"bearer download and object URL cleanup",await page.evaluate(()=>{const S=window.__feedbackEvidence,r=S.requests.find(x=>x.pathname.endsWith("/assets/903/content"));return r?.headers.authorization==="Bearer bounded-browser-token"&&S.downloadClicked?.download==="imported-note.wav"&&S.objectRevoked>=1;}));
  await page.getByRole("button",{name:tt("Request transcription","Solicitar transcripción")}).click();await page.locator("details").filter({has:page.locator("summary").filter({hasText:tt("Transcript","Transcripción")})}).evaluate(node=>node.open=true);await page.getByText(tt("Transcription provider is not available yet","El proveedor de transcripción aún no está disponible")).waitFor();pass(sid,"transcription consent and default-deny state");await page.getByRole("button",{name:tt("History","Historial")}).click();await page.getByRole("button",{name:tt("Retry transcription","Reintentar transcripción")}).click();await page.locator("details").filter({has:page.locator("summary").filter({hasText:tt("Transcript","Transcripción")})}).evaluate(node=>node.open=true);await page.getByText("Bounded transcript result").waitFor();await page.getByRole("button",{name:tt("Accept transcript","Aceptar transcripción")}).click();const trs=await page.evaluate(()=>window.__feedbackEvidence.requests.filter(r=>r.pathname.endsWith("/transcription")&&r.method==="POST"));check(sid,"transcription successor and review",trs[1]?.body?.retryOfJobId===71&&/transcription-successor/.test(trs[1]?.headers["idempotency-key"]||"")&&await page.evaluate(()=>window.__feedbackEvidence.transcriptionReviewed?.reviewState==="accepted"));
  await page.evaluate(()=>window.__feedbackEvidence.mineMode="lost");await page.getByRole("button",{name:tt("My feedback","Mis comentarios")}).click();await page.getByText(tt("Membership lost","Membresía perdida")).waitFor();check(sid,"membership loss clears cache",await page.getByText("FB-EVIDENCE801").count()===0);const shot2=`${sid}-membership-loss.png`;await page.screenshot({path:path.join(output,shot2)});
  const S=await page.evaluate(()=>window.__feedbackEvidence);if(S.unexpected.length)console.error("unexpected",JSON.stringify(S.unexpected));if(consoleErrors.length||pageErrors.length||failedRequests.length)console.error("browser-errors",JSON.stringify({consoleErrors,pageErrors,failedRequests}));check(sid,"no unexpected requests",S.unexpected.length===0,S.unexpected);check(sid,"no console page or network errors",consoleErrors.length===0&&pageErrors.length===0&&failedRequests.length===0,{consoleErrors,pageErrors,failedRequests});scenarios.push({id:sid,locale:es?"es-US":"en-US",viewport,requests:S.requests,consoleErrors,pageErrors,failedRequests,screenshots:[shot1,shot2]});await context.close();
}

try { await run("en",{width:1440,height:900});await run("es",{width:390,height:844}); } finally { await browser.close(); }
const screenshots=scenarios.flatMap(s=>s.screenshots.map(name=>{const f=path.join(output,name);return{name,scenario:s.id,width:s.viewport.width,height:s.viewport.height,bytes:statSync(f).size,sha256:fileSha(f)};}));
const forbidden=["storageKey","providerPayload","internalNote","relayToken","purgeToken"], serialized=JSON.stringify({assertions,scenarios});
const leakScan=forbidden.map(pattern=>({pattern,matches:(serialized.match(new RegExp(pattern,"gi"))||[]).length}));
const manifest={label:"BIMLog — Feedback Final Browser Evidence Writer",generatedAt:new Date().toISOString(),source:{head,tree,expectedLineage:["88b0692f","dc3ff093","a1efa4f"],cleanRelevantPaths:true,productionInputCount:sourcePaths.length,productionInputs:sourceProvenance,harness:harnessProvenance,bundleHashes},runtime:{node:process.version,platform:process.platform,arch:process.arch,playwrightCore,chromiumExecutable,chromiumVersion,baseUrl},mockedBoundary:"Actual production App and FeedbackWidget in real Chromium with controlled in-browser API/media mocks. No real DB, provider, scanner, transcription provider, Replit, customer, or production system.",assertions:{passed:assertions.length,failed:failures.length,results:assertions,failures},scenarios,screenshots,leakScan};
writeFileSync(path.join(output,"results.json"),`${JSON.stringify({assertions,failures,scenarios},null,2)}\n`);writeFileSync(path.join(output,"manifest.json"),`${JSON.stringify(manifest,null,2)}\n`);
if(failures.length||leakScan.some(x=>x.matches))throw new Error(`Evidence failed: ${failures.length} assertions, leak=${JSON.stringify(leakScan)}`);
console.log(`feedback final browser evidence: ${assertions.length}/${assertions.length} passed; ${output}`);
