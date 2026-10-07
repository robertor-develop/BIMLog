import { useEffect, useRef, useState } from "react";
import { Bot, Minus, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { collectPageAssistantContext, highlightAssistantControls, selectedAssistantControl } from "@/lib/page-assistant-context";

type Message = { role: "user" | "assistant"; text: string; projectId: number | null };
type Repair = { id: string; payload: { issue: string; scope: string }; scope_digest: string; state: string; created_at?: string; execution_receipt?: { message?: string; updatedAt?: string; evidence?: Record<string,unknown> } | null };
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export function PageAssistant() {
  const { token, user } = useAuthStore();
  const { lang, tt } = useI18n();
  const [open,setOpen]=useState(false),[question,setQuestion]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[proposal,setProposal]=useState<string|null>(null),[repairScope,setRepairScope]=useState("");
  const [includeSelected,setIncludeSelected]=useState(false),[activeTool,setActiveTool]=useState<"ask"|"feedback"|"fix">("ask");
  const [messages,setMessages]=useState<Message[]>([]),[feedbackReceipt,setFeedbackReceipt]=useState<{stableId:string;status:string;notificationState:string}|null>(null);
  const [repairs,setRepairs]=useState<Repair[]>([]),[canAuthorize,setCanAuthorize]=useState(false),[executionConnected,setExecutionConnected]=useState(false),[pin,setPin]=useState(""),[newPin,setNewPin]=useState(""),[delegateEmail,setDelegateEmail]=useState("");
  const input=useRef<HTMLTextAreaElement|null>(null),opener=useRef<HTMLButtonElement|null>(null),selectedField=useRef<string|null>(null);
  const context=collectPageAssistantContext(lang);
  const contextKey=`bimlog-assistant:${context.projectId ?? "global"}`;
  const isSuperAdmin=Boolean((user as {isSuperAdmin?:boolean}|null)?.isSuperAdmin);
  useEffect(()=>{try{setMessages(JSON.parse(sessionStorage.getItem(contextKey)||"[]").slice(-12));}catch{setMessages([]);}},[contextKey]);
  useEffect(()=>{try{setFeedbackReceipt(JSON.parse(sessionStorage.getItem(`${contextKey}:feedback-receipt`)||"null"));}catch{setFeedbackReceipt(null);}},[contextKey]);
  useEffect(()=>{setQuestion(sessionStorage.getItem(`${contextKey}:draft`)||"");},[contextKey]);
  useEffect(()=>{sessionStorage.setItem(`${contextKey}:draft`,question);},[question,contextKey]);
  useEffect(()=>{try{sessionStorage.setItem(contextKey,JSON.stringify(messages.slice(-12)));}catch(cause){console.warn("[page-assistant] conversation persistence unavailable",cause);}},[messages,contextKey]);
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(event.altKey&&event.shiftKey&&event.key.toLowerCase()==="a"){event.preventDefault();setOpen(value=>!value);}if(event.key==="Escape"&&open){event.preventDefault();setOpen(false);opener.current?.focus();}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[open]);
  useEffect(()=>{if(open)window.setTimeout(()=>input.current?.focus(),0);},[open]);
  useEffect(()=>{document.body.classList.toggle("bimlog-assistant-docked",open);return()=>document.body.classList.remove("bimlog-assistant-docked");},[open]);
  useEffect(()=>{if(open&&token)void loadRepairs();},[open,token]);
  useEffect(()=>{if(!open||!token)return;const refresh=window.setInterval(()=>void loadRepairs(),15000);return()=>window.clearInterval(refresh);},[open,token]);
  useEffect(()=>{const received=(event:Event)=>{const detail=(event as CustomEvent<{stableId?:string;status?:string;notificationState?:string}>).detail;if(!detail?.stableId)return;const receipt={stableId:detail.stableId,status:detail.status||"new",notificationState:detail.notificationState||"unavailable"};setFeedbackReceipt(receipt);sessionStorage.setItem(`${contextKey}:feedback-receipt`,JSON.stringify(receipt));setNotice(tt(`Feedback ${detail.stableId} was received by Operations.`,`Operations recibió el comentario ${detail.stableId}.`));};window.addEventListener("bimlog:feedback-receipt",received);return()=>window.removeEventListener("bimlog:feedback-receipt",received);},[contextKey,lang]);
  if(!token)return null;
  async function api(path:string,init?:RequestInit){const response=await fetch(`${API_BASE}${path}`,{...init,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,...init?.headers}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||data.error||tt("Request failed.","La solicitud falló."));return data;}
  async function loadRepairs(){try{const data=await api("/api/v1/repairs");setRepairs(data.proposals||[]);setCanAuthorize(data.canAuthorize===true);setExecutionConnected(data.executionConnected===true);}catch(cause){setError(cause instanceof Error?cause.message:tt("Repair review is unavailable.","La revisión de reparaciones no está disponible."));}}
  async function ask(next=question){if(!next.trim()||busy)return;const currentContext=collectPageAssistantContext(lang);const groundedContext={...currentContext,selectedField:includeSelected?selectedField.current:null};setBusy(true);setError("");setNotice("");setProposal(null);const submitted:Message={role:"user",text:next.trim(),projectId:currentContext.projectId};setMessages(current=>[...current,submitted]);setQuestion("");try{const path=currentContext.projectId===null?"/api/v1/assistant/ask":`/api/v1/projects/${currentContext.projectId}/assistant/ask`;const data=await api(path,{method:"POST",body:JSON.stringify({question:submitted.text,context:groundedContext,history:messages.slice(-8)})});if(data.transport!=="main04"||data.contextual!==true||data.agent?.threadId!=="01a10a95-a2e5-73d3-a471-6738addc7e42"||typeof data.agent?.requestId!=="string"||typeof data.agent?.answerDigest!=="string"||!String(data.answer||"").trim())throw new Error(tt("BIMLog Dedicated Agent — MAIN 04.00 did not return a verified answer.","El Agente Dedicado de BIMLog — MAIN 04.00 no devolvió una respuesta verificada."));const plainAnswer=String(data.answer).replace(/\*\*([^*]+)\*\*/g,"$1").replace(/`([^`]+)`/g,"$1");setMessages(current=>[...current,{role:"assistant",text:plainAnswer,projectId:currentContext.projectId}]);if(typeof data.proposal==="string"&&data.proposal.trim())setProposal(data.proposal.trim());highlightAssistantControls(data.highlightLabels||[]);}catch(cause){setError(cause instanceof Error?cause.message:tt("BIMLog Dedicated Agent is unavailable on this device.","El Agente Dedicado de BIMLog no está disponible en este dispositivo."));}finally{setBusy(false);}}
  function submitFeedback(viewStatus=false){const latest=[...messages].reverse().find(item=>item.role==="user")?.text||question;window.dispatchEvent(new CustomEvent("bimlog:feedback-open",{detail:{feedbackType:"bug",message:latest?`${latest}\n\nPage: ${context.route}`:"",viewStatus}}));}
  function newConversation(){setMessages([]);setQuestion("");setError("");setNotice("");sessionStorage.removeItem(contextKey);sessionStorage.removeItem(`${contextKey}:draft`);input.current?.focus();}
  async function reportRepair(){const issue=[...messages].reverse().find(item=>item.role==="user")?.text||question.trim();const scope=(proposal||repairScope).trim();if(!issue||!scope)return;try{const data=await api("/api/v1/repairs",{method:"POST",body:JSON.stringify({issue,page:context.route,projectId:context.projectId,scope,tests:tt("Reproduce the issue, run affected regression tests, and verify the repaired page in Chrome.","Reproducir el problema, ejecutar las pruebas de regresión afectadas y verificar la página reparada en Chrome.")})});setNotice(tt(`Repair proposal ${data.id} was recorded. Confirm its exact scope with your repair PIN to send it to Orion MAIN.`,`La propuesta de reparación ${data.id} fue registrada. Confirma su alcance exacto con tu PIN de reparación para enviarla a Orion MAIN.`));setRepairScope("");await loadRepairs();}catch(cause){setError(cause instanceof Error?cause.message:tt("Repair report failed.","Falló el reporte de reparación."));}}
  async function configurePin(){try{await api("/api/v1/repairs/pin",{method:"POST",body:JSON.stringify({pin:newPin})});setNewPin("");setNotice(tt("Your repair PIN is configured.","Tu PIN de reparación está configurado."));}catch(cause){setError(cause instanceof Error?cause.message:tt("PIN setup failed.","Falló la configuración del PIN."));}}
  async function authorize(repair:Repair){try{const data=await api(`/api/v1/repairs/${repair.id}/authorize`,{method:"POST",body:JSON.stringify({pin,scopeDigest:repair.scope_digest,confirmed:true})});setPin("");setNotice(data.message);await loadRepairs();}catch(cause){setError(cause instanceof Error?cause.message:tt("Authorization failed.","Falló la autorización."));}}
  async function delegate(active:boolean){try{const data=await api("/api/v1/repairs/delegates",{method:"POST",body:JSON.stringify({email:delegateEmail,active})});setNotice(tt(`${data.email} repair authority ${active?"granted":"revoked"}.`,`Autoridad de reparación para ${data.email} ${active?"otorgada":"revocada"}.`));setDelegateEmail("");}catch(cause){setError(cause instanceof Error?cause.message:tt("Delegation failed.","Falló la delegación."));}}
  return (
    <div data-page-assistant="true" data-page-assistant-open={open ? "true" : "false"}>
      <button ref={opener} type="button" className="page-assistant-launcher" aria-expanded={open} aria-controls="bimlog-page-assistant" aria-keyshortcuts="Alt+Shift+A" onPointerDown={()=>{if(!open)selectedField.current=selectedAssistantControl();}} onClick={()=>setOpen(value=>!value)}>
        <Bot size={18}/><span>{tt("Ask BIMLog","Preguntar a BIMLog")}</span>
      </button>
      {open&&<aside id="bimlog-page-assistant" className="page-assistant-panel" role="dialog" aria-modal="false" aria-label={tt("BIMLog page assistant","Asistente de página BIMLog")}>
        <header>
          <div><small>{tt("YOUR BIMLOG AGENT","TU AGENTE BIMLOG")}</small><strong>{tt("Workspace guide","Guía del espacio de trabajo")}</strong><span>{tt("BIMLog Agent · connected","Agente BIMLog · conectado")}</span></div>
          <nav className="page-assistant-header-actions"><button type="button" aria-label={tt("Minimize agent","Minimizar agente")} onClick={()=>setOpen(false)}><Minus size={16}/></button><button type="button" aria-label={tt("Close agent","Cerrar agente")} onClick={()=>setOpen(false)}><X size={16}/></button></nav>
        </header>
        <section className="page-assistant-recommended">
          <small>{tt("RECOMMENDED NEXT","SIGUIENTE RECOMENDADO")}</small>
          <strong>{tt("Continue with this page","Continuar con esta página")}</strong>
          <p>{tt("Ask the BIMLog Agent what needs attention without losing your place or changing project data.","Pregunta al Agente BIMLog qué necesita atención sin perder tu lugar ni cambiar datos del proyecto.")}</p>
          <button type="button" onClick={()=>{setActiveTool("ask");input.current?.focus();}}>{tt("Ask about this workspace","Preguntar sobre este espacio")}</button>
        </section>
        <div className="page-assistant-section-label">{tt("ASK A QUESTION","HACER UNA PREGUNTA")}</div>
        <nav className="page-assistant-actions" aria-label={tt("Assistant actions","Acciones del asistente")}>
          <button type="button" aria-pressed={activeTool==="ask"} onClick={()=>setActiveTool("ask")}>{tt("Ask a question","Hacer una pregunta")}</button>
          <button type="button" aria-pressed={activeTool==="feedback"} onClick={()=>{setActiveTool("feedback");submitFeedback(false);}}>{tt("Submit feedback","Enviar comentarios")}</button>
          <button type="button" aria-pressed={activeTool==="fix"} disabled={!canAuthorize} title={!canAuthorize?tt("Repair authorization is required.","Se requiere autorización de reparación."):undefined} onClick={()=>setActiveTool("fix")}>{tt("Request a fix","Solicitar corrección")}</button>
        </nav>

        <section className="page-assistant-question" aria-label={tt("Conversation","Conversación")}>
          <form onSubmit={event=>{event.preventDefault();void ask();}}>
            <label>{tt("Ask about this page","Pregunta sobre esta página")}<textarea ref={input} value={question} maxLength={2000} onChange={event=>setQuestion(event.target.value)} /></label>
            <label className="page-assistant-selected"><input type="checkbox" checked={includeSelected} onChange={event=>setIncludeSelected(event.target.checked)}/>{tt("Include the selected field value","Incluir el valor del campo seleccionado")}</label>
            <div className="page-assistant-form-actions"><button type="submit" disabled={busy||!question.trim()}>{busy?tt("BIMLog Agent is answering…","El Agente BIMLog está respondiendo…"):tt("Ask BIMLog Agent","Preguntar al Agente BIMLog")}</button><button type="button" onClick={newConversation}>{tt("New conversation","Nueva conversación")}</button></div>
          </form>
          {error&&<div role="alert" className="page-assistant-error">{error}</div>}
          {notice&&<div role="status" className="page-assistant-notice">{notice}</div>}
          <div className="page-assistant-messages" aria-live="polite" aria-busy={busy}>
            {busy&&<p>{tt("Sending your question to the BIMLog Agent…","Enviando tu pregunta al Agente BIMLog…")}</p>}
            {!busy&&!messages.length&&<p>{tt("Your BIMLog answer will appear here.","Tu respuesta de BIMLog aparecerá aquí.")}</p>}
            {messages.slice(-2).map((message,index)=><article key={`${messages.length}-${index}`} data-role={message.role}><strong>{message.role==="user"?tt("You","Tú"):"BIMLog"}</strong><p>{message.text}</p>{message.projectId!==context.projectId&&<small>{tt("From another project context","De otro contexto de proyecto")}</small>}</article>)}
          </div>
        </section>

        <details className="page-assistant-section">
          <summary>{tt("Show me where","Muéstrame dónde")}</summary>
          <div className="page-assistant-section-body"><p>{tt("BIMLog can highlight and move to the exact visible control for the next required action.","BIMLog puede resaltar y llevarte al control visible exacto de la próxima acción obligatoria.")}</p><button type="button" onClick={()=>void ask(tt("Show me the exact visible control I should use next.","Muéstrame el control visible exacto que debo usar a continuación."))}>{tt("Find the next control","Buscar el próximo control")}</button></div>
        </details>

        <details className="page-assistant-section">
          <summary>{tt("Submit feedback · My feedback","Enviar comentarios · Mis comentarios")}{feedbackReceipt&&<small>{feedbackReceipt.status}</small>}</summary>
          <div className="page-assistant-section-body"><p>{tt("Report a bug or confusing workflow. BIMLog adds this page context and keeps evidence consent explicit.","Reporta un error o flujo confuso. BIMLog agrega el contexto de esta página y mantiene explícito el consentimiento de evidencia.")}</p><button type="button" onClick={()=>submitFeedback(false)}>{tt("Open feedback form","Abrir formulario de comentarios")}</button>{feedbackReceipt&&<div className="page-assistant-case-receipt" role="status"><strong>{feedbackReceipt.stableId}</strong><span>{tt("Case status","Estado del caso")}: {feedbackReceipt.status}</span><span>{tt("Operations alert","Alerta de Operations")}: {feedbackReceipt.notificationState}</span><button type="button" onClick={()=>submitFeedback(true)}>{tt("View status and history","Ver estado e historial")}</button></div>}</div>
        </details>

        <details className="page-assistant-section">
          <summary>{tt("Page guide and work status","Guía de página y estado del trabajo")}</summary>
          <div className="page-assistant-section-body page-assistant-guide-actions"><button type="button" onClick={()=>void ask(tt("Explain the focused section and its visible controls.","Explica la sección enfocada y sus controles visibles."))}>{tt("Explain this page","Explicar esta página")}</button><button type="button" onClick={()=>void ask(tt("What required setup is missing on this page? Do not invent requirements.","¿Qué configuración obligatoria falta en esta página? No inventes requisitos."))}>{tt("Check required setup","Revisar configuración obligatoria")}</button><small>{tt("Guidance and reporting are available to every user. Repair authorization is restricted.","La orientación y los reportes están disponibles para todos. La autorización de reparación es restringida.")}</small></div>
        </details>

        {canAuthorize&&activeTool==="fix"&&<details className="page-assistant-section page-assistant-repairs" open>
          <summary>{tt("Fix with authorization","Corregir con autorización")}</summary>
          <div className="page-assistant-section-body">
            <p>{executionConnected?tt("Verified development execution is connected.","La ejecución de desarrollo verificada está conectada."):tt("Authorization can be recorded, but verified hosted execution is not connected yet.","La autorización puede registrarse, pero la ejecución alojada verificada aún no está conectada.")}</p>
            <section className="page-assistant-repair-intake"><label>{tt("Exact repair scope","Alcance exacto de la reparación")}<textarea value={repairScope} maxLength={4000} onChange={event=>setRepairScope(event.target.value)} placeholder={tt("Describe the exact change Orion MAIN should implement and verify.","Describe el cambio exacto que Orion MAIN debe implementar y verificar.")}/></label><button type="button" disabled={!([...messages].reverse().find(item=>item.role==="user")?.text||question.trim())||repairScope.trim().length<20} onClick={()=>void reportRepair()}>{tt("Create PIN-gated repair","Crear reparación protegida por PIN")}</button></section>
            {proposal&&<button type="button" onClick={()=>void reportRepair()}>{tt("Send repair proposal for review","Enviar propuesta de reparación para revisión")}</button>}
            <label>{tt("Configure repair PIN","Configurar PIN de reparación")}<input inputMode="numeric" autoComplete="new-password" value={newPin} onChange={event=>setNewPin(event.target.value.replace(/\D/g,"").slice(0,12))}/></label><button type="button" disabled={!/^\d{4,12}$/.test(newPin)} onClick={()=>void configurePin()}>{tt("Save PIN","Guardar PIN")}</button>
            {repairs.filter(item=>["reported","proposed"].includes(item.state)).map(item=><article key={item.id}><strong>{item.payload.issue}</strong><p>{item.payload.scope}</p><small>{tt("Exact scope digest","Huella del alcance exacto")}: {item.scope_digest}</small><label>{tt("Your PIN","Tu PIN")}<input inputMode="numeric" autoComplete="off" value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,"").slice(0,12))}/></label><button type="button" disabled={!/^\d{4,12}$/.test(pin)} onClick={()=>void authorize(item)}>{tt("Authorize exact repair","Autorizar reparación exacta")}</button></article>)}
            {repairs.filter(item=>!["reported","proposed"].includes(item.state)).map(item=><article key={item.id} className="page-assistant-repair-progress"><strong>{item.payload.issue}</strong><p>{tt("Status","Estado")}: {item.state}</p>{item.execution_receipt?.message&&<p>{item.execution_receipt.message}</p>}{item.execution_receipt?.updatedAt&&<small>{new Date(item.execution_receipt.updatedAt).toLocaleString(lang)}</small>}</article>)}
            {isSuperAdmin&&<section><strong>{tt("Delegate repair authority","Delegar autoridad de reparación")}</strong><label>{tt("Existing user email","Correo de usuario existente")}<input type="email" value={delegateEmail} onChange={event=>setDelegateEmail(event.target.value)}/></label><div><button type="button" disabled={!delegateEmail.includes("@")} onClick={()=>void delegate(true)}>{tt("Grant","Otorgar")}</button><button type="button" disabled={!delegateEmail.includes("@")} onClick={()=>void delegate(false)}>{tt("Revoke","Revocar")}</button></div></section>}
          </div>
        </details>}
        <footer className="page-assistant-status-strip">
          <div><small>{tt("Workspace","Espacio")}</small><strong>{context.page||tt("Current page","Página actual")}</strong></div>
          <div><small>{tt("Agent","Agente")}</small><strong>{busy?tt("Answering","Respondiendo"):tt("Connected","Conectado")}</strong></div>
          <div><small>{tt("Recent result","Resultado reciente")}</small><strong>{messages.some(item=>item.role==="assistant")?tt("Available","Disponible"):tt("None yet","Aún ninguno")}</strong></div>
        </footer>
      </aside>}
    </div>
  );
}

