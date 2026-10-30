import { useEffect, useRef, useState } from "react";
import { ChevronRight, RefreshCw, Send } from "lucide-react";
import { useAuthStore } from "@/store/auth";

type ChatMessage = { role: "user" | "assistant"; content: string };
type BrowseItem = { name: string; type: "file" | "folder"; ref: string; mimeType?: string | null; size?: number | null; versions?: Array<{id:string;label:string;createdAt:string|null}> };
type SelectedItem = BrowseItem & { versionId:string; versionLabel:string };

export function ProcoreIntakePanel({ projectId, lang }: { projectId: number; lang: string }) {
  const es = lang === "es";
  const tr = (en: string, spanish: string) => es ? spanish : en;
  const { token, user } = useAuthStore();
  const storageKey = `bimlog-procore-intake:${user?.id ?? "unknown"}:${user?.companyId ?? "unknown"}:${projectId}`;
  const [open, setOpen] = useState(true);
  const [goal, setGoal] = useState("");
  const [needed, setNeeded] = useState("");
  const [company, setCompany] = useState("");
  const [sourceProject, setSourceProject] = useState("");
  const [destination, setDestination] = useState(String(projectId));
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ref, setRef] = useState("");
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [versionChoice,setVersionChoice]=useState<Record<string,string>>({});
  const [proposal,setProposal]=useState<string>("");
  const [browsing, setBrowsing] = useState(false);
  const [restoredFor, setRestoredFor] = useState<string | null>(null);
  const ready = restoredFor === storageKey;
  const activeTurn = useRef<AbortController | null>(null);
  const [restoreAttempt,setRestoreAttempt]=useState(0),[saveAttempt,setSaveAttempt]=useState(0);
  const [restoreError,setRestoreError]=useState(''),[saveStatus,setSaveStatus]=useState(''),[saveError,setSaveError]=useState('');
  const [localRecovery,setLocalRecovery]=useState<any>(null),[proposalBusy,setProposalBusy]=useState(false);
  const epoch=useRef(0),baseline=useRef(''),currentPayload=useRef(''),writeQueue=useRef<Promise<void>>(Promise.resolve());
  const scopeAbort=useRef<AbortController|null>(null),activeBrowse=useRef<AbortController|null>(null),activeProposal=useRef<AbortController|null>(null);
  const turnLock=useRef(false),browseLock=useRef(false),proposalLock=useRef(false);
  const payload=(value:any)=>({goal:value.goal,needed:value.needed,messages:value.messages.slice(-30).map((m:any)=>({role:m.role,content:m.content.slice(0,2000)})),selectedSources:value.selectedSources.map((v:any)=>({ref:v.ref,fileId:v.fileId??v.ref.split(':')[2],projectRef:v.projectRef??`project:${v.ref.split(':')[1]}`,versionId:v.versionId,versionLabel:v.versionLabel,name:v.name,mimeType:v.mimeType??null})),destinationProjectId:projectId});
  const validState=(value:any)=>Boolean(value&&value.destinationProjectId===projectId&&typeof value.goal==='string'&&typeof value.needed==='string'&&Array.isArray(value.messages)&&value.messages.every((m:any)=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string')&&Array.isArray(value.selectedSources)&&value.selectedSources.every((v:any)=>v&&['ref','name','versionId','versionLabel'].every(k=>typeof v[k]==='string'&&v[k].length>0)));
  const verifyResponse=async(response:Response)=>{const body=await response.json();if(!response.ok)throw Error(body.code||'INTAKE_STATE_UNAVAILABLE');if(response.headers.get('x-bimlog-project-id')!==String(projectId)||response.headers.get('x-bimlog-caller-id')!==String(user?.id)||response.headers.get('x-bimlog-company-id')!==String(user?.companyId)||!validState(body.state))throw Error('INTAKE_STATE_IDENTITY_MISMATCH');return body.state;};

  useEffect(()=>{
    const ticket=++epoch.current,controller=new AbortController();scopeAbort.current=controller;
    activeTurn.current?.abort();activeBrowse.current?.abort();activeProposal.current?.abort();turnLock.current=false;browseLock.current=false;proposalLock.current=false;
    setRestoredFor(null);setRestoreError('');setSaveError('');setError('');setSaveStatus('');setConversation([]);setGoal('');setNeeded('');setCompany('');setSourceProject('');setDestination(String(projectId));setSelected([]);setItems([]);setRef('');setVersionChoice({});setProposal('');setBusy(false);setBrowsing(false);setProposalBusy(false);setQuestion('');baseline.current='';setLocalRecovery(null);
    try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&typeof saved.goal==='string'&&typeof saved.needed==='string'&&Array.isArray(saved.messages)&&saved.messages.every((m:any)=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string')&&Array.isArray(saved.selected)&&saved.selected.every((v:any)=>v&&['ref','name','versionId','versionLabel'].every(k=>typeof v[k]==='string'&&v[k].length>0)))setLocalRecovery(saved);}catch{/* Invalid local backup is never posted. */}
    if(!token)return;
    void fetch(`/api/v1/projects/${projectId}/intake-agent/state`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal}).then(verifyResponse).then(value=>{
      if(controller.signal.aborted||ticket!==epoch.current)return;
      baseline.current=JSON.stringify(payload(value));setGoal(value.goal);setNeeded(value.needed);setConversation(value.messages);setSelected(value.selectedSources);setSaveStatus(value.updatedAt?tr('Saved intake restored and verified.','Incorporación guardada restaurada y verificada.'):tr('No saved intake yet.','Todavía no hay incorporación guardada.'));setRestoredFor(storageKey);
    }).catch(cause=>{if(!controller.signal.aborted&&ticket===epoch.current)setRestoreError(tr('Saved intake could not be verified. Saving is paused; retry the restore.','No se pudo verificar la incorporación guardada. El guardado está pausado; reintente restaurar.')+' '+String(cause.message));});
    return()=>{controller.abort();activeTurn.current?.abort();activeBrowse.current?.abort();activeProposal.current?.abort();epoch.current++;};
  },[storageKey,projectId,token,restoreAttempt]);

  const serializedPayload=JSON.stringify(payload({goal,needed,messages:conversation,selectedSources:selected}));currentPayload.current=serializedPayload;
  useEffect(()=>{
    if(!ready||!token||serializedPayload===baseline.current)return;
    const ticket=epoch.current,signal=scopeAbort.current?.signal;setSaveStatus(tr('Intake changes are not yet verified.','Los cambios aún no están verificados.'));
    const timer=window.setTimeout(()=>{
      const value=JSON.parse(serializedPayload);
      try{localStorage.setItem(storageKey,JSON.stringify({messages:value.messages,goal:value.goal,needed:value.needed,selected:value.selectedSources}));}catch{/* Server persistence remains authoritative. */}
      writeQueue.current=writeQueue.current.then(async()=>{
        if(signal?.aborted||ticket!==epoch.current)return;
        const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
        await verifyResponse(await fetch(`/api/v1/projects/${projectId}/intake-agent/state`,{method:'PUT',headers,body:serializedPayload,signal}));
        const reopened=await verifyResponse(await fetch(`/api/v1/projects/${projectId}/intake-agent/state`,{headers,signal}));
        if(signal?.aborted||ticket!==epoch.current)return;
        if(JSON.stringify(payload(reopened))!==serializedPayload)throw Error('INTAKE_STATE_READBACK_MISMATCH');
        baseline.current=serializedPayload;
        if(currentPayload.current===serializedPayload){setSaveStatus(tr('Intake draft saved and verified.','Borrador guardado y verificado.'));setSaveError('');}
      }).catch(cause=>{if(!signal?.aborted&&ticket===epoch.current){setSaveStatus(tr('Intake save failed. Your fields are preserved.','Falló el guardado. Se conservaron sus campos.'));setSaveError(String(cause.message));}});
    },350);
    return()=>window.clearTimeout(timer);
  },[ready,serializedPayload,saveAttempt,token,storageKey,projectId]);
  useEffect(()=>{if(!ready||serializedPayload===baseline.current)return;const protect=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[ready,serializedPayload,saveStatus]);
  useEffect(()=>{setProposal('');},[goal,needed,selected]);
  function save(next: ChatMessage[]) {
    setConversation(next);
    if (ready) try { localStorage.setItem(storageKey, JSON.stringify({ messages: next.slice(-30), goal, needed, selected })); } catch { /* Storage may be disabled. */ }
  }

  async function send(text = question) {
    if (!token || !ready || !text.trim() || turnLock.current) return;
    const ticket=epoch.current;turnLock.current=true;
    setBusy(true); setError(""); setQuestion("");
    const controller = new AbortController();
    activeTurn.current = controller;
    const prior = conversation;
    const submittedText = prior.length ? text.trim() : [
      `Goal: ${goal.trim() || "not yet specified"}`,
      `Information/documents needed: ${needed.trim() || "not yet specified"}`,
      `Procore company: ${company || "not selected"}`,
      `Procore project: ${sourceProject || "not selected"}`,
      `BIMLog destination project: ${destination}`,
      `Selected source refs: ${selected.length ? selected.map((item) => `${item.name} (${item.ref}; version ${item.versionId})`).join("; ") : "none yet"}`,
      `Request: ${text.trim()}`,
    ].join("\n");
    const next = [...prior, { role: "user" as const, content: submittedText }];
    save(next);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/intake-agent/turn`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ question: submittedText, history: prior }),
        signal: controller.signal,
      });
      const data = await response.json();
      if(controller.signal.aborted||ticket!==epoch.current)return;
      if (!response.ok) throw new Error(data.code || "INTAKE_AGENT_FAILED");
      const answer = typeof data.answer === "string" && data.answer ? data.answer : tr("The agent did not return a response. Try again.", "El agente no respondió. Inténtelo de nuevo.");
      save([...next, { role: "assistant", content: answer }]);
    } catch (cause) {
      if (!controller.signal.aborted&&ticket===epoch.current) setError(cause instanceof Error ? cause.message : tr("Could not reach the intake agent.", "No se pudo conectar con el agente de incorporación."));
    } finally { if (activeTurn.current === controller) activeTurn.current = null; if(ticket===epoch.current){turnLock.current=false;setBusy(false);} }
  }

  async function browse(nextRef = ref) {
    if (!token || !ready || browseLock.current) return;
    const ticket=epoch.current,controller=new AbortController();activeBrowse.current=controller;browseLock.current=true;
    setBrowsing(true); setError("");
    try {
      const discovery = await fetch(`/api/v1/projects/${projectId}/intake-agent/mcp`, {
        method: "POST", signal:controller.signal,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/list" }),
      });
      const available = await discovery.json();
      if(controller.signal.aborted||ticket!==epoch.current)return;
      if (!discovery.ok || !(available.result?.tools || []).some((tool: { name: string }) => tool.name === "procore_browse")) {
        throw new Error(available.error?.message || "PROCORE_BROWSE_TOOL_UNAVAILABLE");
      }
      const response = await fetch(`/api/v1/projects/${projectId}/intake-agent/mcp`, {
        method: "POST", signal:controller.signal,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/call", params: { name: "procore_browse", arguments: { projectId, ref: nextRef, query: "" } } }),
      });
      const data = await response.json();
      if(controller.signal.aborted||ticket!==epoch.current)return;
      if (!response.ok || data.error) throw new Error(data.error?.message || data.code || "PROCORE_BROWSE_FAILED");
      const text = data.result?.content?.[0]?.text;
      const result = JSON.parse(text || "{}");
      setRef(nextRef); setItems(result.items || []);
      if (nextRef.startsWith("company:")) setCompany(nextRef);
      if (nextRef.startsWith("project:")) { setSourceProject(nextRef); setCompany(`company:${nextRef.split(":")[1]}`); }
    } catch (cause) {
      if(!controller.signal.aborted&&ticket===epoch.current)setError(cause instanceof Error ? cause.message : "PROCORE_BROWSE_FAILED");
    } finally { if(ticket===epoch.current){browseLock.current=false;setBrowsing(false);} }
  }

  function continueInto(item: BrowseItem) {
    if (item.type === "folder") void browse(item.ref);
  }
  function selectVersion(item:BrowseItem){
    const versionId=versionChoice[item.ref]||item.versions?.[0]?.id;
    const version=item.versions?.find(v=>v.id===versionId);if(!version)return;
    setSelected(current=>[...current.filter(s=>s.ref!==item.ref),{...item,versionId:version.id,versionLabel:version.label}]);
  }
  async function createProposal(){
    if(!token||!ready||!selected.length||proposalLock.current)return;
    const ticket=epoch.current,controller=new AbortController();activeProposal.current=controller;proposalLock.current=true;setProposalBusy(true);setError("");
    try{
      const call=async(method:string,params?:unknown)=>{const r=await fetch(`/api/v1/projects/${projectId}/intake-agent/mcp`,{method:"POST",signal:controller.signal,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:crypto.randomUUID(),method,params})});const d=await r.json();if(!r.ok||d.error)throw new Error(d.error?.data?.code||d.error?.message||"PROCORE_PROPOSAL_FAILED");return d;};
      const discovered=await call("tools/list");if(!(discovered.result?.tools||[]).some((t:{name:string})=>t.name==="bimlog_propose_intake_plan"))throw new Error("PROCORE_PROPOSAL_TOOL_UNAVAILABLE");
      const response=await call("tools/call",{name:"bimlog_propose_intake_plan",arguments:{projectId,goal,destination,needed,sources:selected.map(s=>({ref:s.ref,name:s.name,versionId:s.versionId,mimeType:s.mimeType||""}))}});
      if(!controller.signal.aborted&&ticket===epoch.current)setProposal(JSON.stringify(JSON.parse(response.result.content[0].text),null,2));
    }catch(cause){if(!controller.signal.aborted&&ticket===epoch.current)setError(cause instanceof Error?cause.message:"PROCORE_PROPOSAL_FAILED");}finally{if(ticket===epoch.current){proposalLock.current=false;setProposalBusy(false);}}
  }

  return <section aria-label={tr("Procore intake agent", "Agente de incorporación de Procore")} style={{ margin: "18px 0", padding: 16, border: "1px solid hsl(var(--border))", borderRadius: 12, background: "hsl(var(--card))" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17 }}>{tr("Procore intake agent", "Agente de incorporación de Procore")}</h2>
        <p style={{ margin: "5px 0 0", color: "hsl(var(--muted-foreground))", fontSize: 12 }}>{tr("Continue your saved intake conversation or start with the guided questions.", "Continúe su conversación guardada o empiece con las preguntas guiadas.")}</p>
      </div>
      <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); if (!open && !conversation.length) void browse(""); }} style={{ padding: "9px 13px", borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", fontWeight: 700 }}>
        {open ? tr("Close intake", "Cerrar incorporación") : conversation.length ? tr("Continue Procore intake", "Continuar incorporación de Procore") : tr("Start Procore intake", "Iniciar incorporación de Procore")}
      </button>
    </div>
    {restoreError&&<div role="alert"><p>{restoreError}</p><button type="button" onClick={()=>setRestoreAttempt(n=>n+1)}>{tr("Retry intake restore","Reintentar restauración")}</button></div>}
    {saveError&&<p role="alert">{saveError}</p>}
    {ready&&<div role="status"><p>{saveStatus}</p>{serializedPayload!==baseline.current&&<button type="button" onClick={()=>setSaveAttempt(n=>n+1)}>{tr("Retry intake save","Reintentar guardado")}</button>}</div>}
    {ready&&localRecovery&&<button type="button" onClick={()=>{setGoal(localRecovery.goal);setNeeded(localRecovery.needed);setConversation(localRecovery.messages);setSelected(localRecovery.selected);setLocalRecovery(null);}}>{tr("Use local recovery draft","Usar borrador de recuperación local")}</button>}
    {open && <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>{tr("What are you trying to accomplish?", "¿Qué desea lograr?")}<textarea disabled={!ready} value={goal} onChange={(e) => setGoal(e.target.value)} rows={2} maxLength={2000} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>{tr("What information or documents do you need?", "¿Qué información o documentos necesita?")}<textarea disabled={!ready} value={needed} onChange={(e) => setNeeded(e.target.value)} rows={2} maxLength={2000} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>{tr("Authorized Procore company / project", "Empresa / proyecto autorizado de Procore")}<input value={[company, sourceProject].filter(Boolean).join(" / ")} readOnly placeholder={tr("Choose below", "Seleccione abajo")} /></label>
        <label style={{ display: "grid", gap: 5, fontSize: 12 }}>{tr("BIMLog destination project", "Proyecto de destino en BIMLog")}<input value={destination} readOnly aria-readonly="true" inputMode="numeric" /></label>
      </div>
      <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 9, padding: 12 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <strong style={{ fontSize: 13 }}>{tr("Browse authorized Procore sources", "Explorar fuentes autorizadas de Procore")}</strong>
          <button type="button" disabled={!ready||browsing} onClick={() => void browse("")}>{browsing ? <RefreshCw size={14} /> : null}{tr("Companies", "Empresas")}</button>
        </div>
        <div role="list" style={{ display: "grid", gap: 5, marginTop: 9 }}>
          {items.map((item) => <div key={item.ref} role="listitem" style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",padding:8,border:"1px solid hsl(var(--border))",borderRadius:7 }}>
            {item.type==="folder" ? <button type="button" onClick={()=>continueInto(item)}>{item.name} <ChevronRight size={15}/></button> :
              <><span>{item.name}</span><label>{tr("Exact version","Versión exacta")}<select aria-label={`${tr("Version for","Versión de")} ${item.name}`} value={versionChoice[item.ref]||item.versions?.[0]?.id||""} onChange={e=>setVersionChoice(v=>({...v,[item.ref]:e.target.value}))}>
                {(item.versions||[]).map(v=><option key={v.id} value={v.id}>{v.label} · {v.id}{v.createdAt?` · ${v.createdAt}`:""}</option>)}
              </select></label><button type="button" disabled={!ready||proposalBusy||!item.versions?.length} onClick={()=>selectVersion(item)}>{selected.some(s=>s.ref===item.ref)?tr("Update selected version","Actualizar versión"):tr("Select version","Seleccionar versión")}</button></>}
          </div>)}
          {!items.length && <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}>{tr("Choose Companies to browse. File selection is read-only.", "Seleccione Empresas para explorar. La selección de archivos es de solo lectura.")}</span>}
        </div>
        {selected.length > 0 && <div role="status" style={{ fontSize: 12 }}>
          <strong>{tr("Selected sources", "Fuentes seleccionadas")} ({selected.length})</strong>
          <ul style={{ margin: "6px 0", paddingLeft: 20 }}>{selected.map((source) => <li key={source.ref} style={{ overflowWrap: "anywhere" }}>
             {source.name} — <code>{source.ref}</code>; {tr("version","versión")} {source.versionLabel} (<code>{source.versionId}</code>) <button type="button" disabled={!ready||proposalBusy} onClick={()=>setSelected(current=>current.filter(item=>item.ref!==source.ref))}>{tr("Remove selection","Quitar selección")}</button>
          </li>)}</ul>
           <button type="button" disabled={!ready||proposalBusy} onClick={()=>void createProposal()}>{tr("Build versioned proposal","Crear propuesta versionada")}</button>
        </div>}
        {proposal&&<pre role="status" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{proposal}</pre>}
      </div>
      <div aria-live="polite" style={{ maxHeight: 230, overflowY: "auto", display: "grid", gap: 8 }}>
        {conversation.map((message, index) => <div key={index} style={{ justifySelf: message.role === "user" ? "end" : "start", maxWidth: "92%", whiteSpace: "pre-wrap", padding: 10, borderRadius: 9, background: message.role === "user" ? "hsl(var(--accent))" : "hsl(var(--muted))", fontSize: 13 }}>{message.content}</div>)}
      </div>
      {error && <p role="alert" style={{ color: "#b91c1c", fontSize: 12 }}>{error} {error.includes("RECONNECT") || error.includes("not_connected") || error.includes("refresh_failed") ? tr("Reconnect Procore, then continue here.", "Vuelva a conectar Procore y continúe aquí.") : ""}</p>}
      <form onSubmit={(e) => { e.preventDefault(); void send(); }} style={{ display: "flex", gap: 8 }}>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} disabled={busy} aria-label={tr("Message the Procore intake agent", "Enviar mensaje al agente de Procore")} placeholder={tr("Ask for help or describe the next step…", "Pida ayuda o describa el siguiente paso…")} style={{ flex: 1, minWidth: 0 }} />
        <button type="submit" disabled={!ready || busy || !question.trim()} aria-label={tr("Send message", "Enviar mensaje")}><Send size={15} />{busy ? tr("Working…", "Procesando…") : tr("Send", "Enviar")}</button>
        {busy && <button type="button" onClick={() => activeTurn.current?.abort()}>{tr("Cancel", "Cancelar")}</button>}
      </form>
      <p style={{ margin: 0, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{tr("Discovery and proposed plans do not import records. This intake currently has no commit action; use supported existing BIMLog import tools for actual changes.", "La exploración y los planes propuestos no importan registros. Esta incorporación aún no tiene acción de confirmación; use las herramientas existentes de BIMLog para cambios reales.")}</p>
    </div>}
  </section>;
}
