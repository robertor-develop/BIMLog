import {useEffect,useRef,useState} from "react";
import {Link} from "wouter";
import {useAuthStore} from "@/store/auth";
import {useI18n} from "@/lib/i18n";
import {resolveOriginalClash} from "@/lib/resolve-original-clash";

export function FindOriginalClash(){
 const {token}=useAuthStore(),{tt}=useI18n();
 const [project,setProject]=useState(()=>new URLSearchParams(location.search).get("projectId")??""),[clash,setClash]=useState(()=>new URLSearchParams(location.search).get("clashId")??"");
 const [result,setResult]=useState<Awaited<ReturnType<typeof resolveOriginalClash>>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const epoch=useRef(0),controller=useRef<AbortController|null>(null),lock=useRef(false);
 const clear=()=>{epoch.current++;controller.current?.abort();lock.current=false;setBusy(false);setResult(null);setError("");};
 useEffect(()=>{clear();return()=>{epoch.current++;controller.current?.abort();};},[token]);
 const load=async()=>{
  if(lock.current)return;setError("");setResult(null);
  const valid=(value:string)=>/^\d+$/.test(value)&&Number.isSafeInteger(Number(value))&&Number(value)>0&&Number(value)<=2147483647;
  if(!token||!valid(project)||!valid(clash)){setError(tt("Enter an authorized project ID and a positive server clash ID.","Ingrese un ID de proyecto autorizado y un ID de choque del servidor positivo."));return;}
  const current=++epoch.current;lock.current=true;setBusy(true);controller.current=new AbortController();
  try{
   const saved=await resolveOriginalClash(Number(project),Number(clash),token,controller.current.signal);
   if(current!==epoch.current)return;
   history.replaceState(history.state,"",`/find-original-clash?projectId=${Number(project)}&clashId=${Number(clash)}`);setResult(saved);
  }catch(failure){if(current===epoch.current){const code=failure instanceof Error?failure.message:"unavailable";setError(code==="denied"?tt("Access denied. Restore your session or choose an authorized project.","Acceso denegado. Restaure su sesión o elija un proyecto autorizado."):code==="missing"?tt("The original clash is deleted or unavailable in this project. Check the server ID or open the project register.","El choque original fue eliminado o no está disponible en este proyecto. Revise el ID del servidor o abra el registro."):tt("The source could not be verified. Retry this read before opening a record.","No se pudo verificar la fuente. Reintente esta lectura antes de abrir un registro."));}}
  finally{if(current===epoch.current){lock.current=false;setBusy(false);}}
 };
 const inputStyle={border:"1px solid #94A3B8",borderRadius:6,padding:8,width:"100%",background:"white"};
 return <main style={{maxWidth:800,margin:"24px auto",padding:18,overflowWrap:"anywhere"}}>
  <Link href="/all-tools">{tt("All Tools","Todas las herramientas")}</Link><h1 style={{fontSize:26,fontWeight:750,margin:"14px 0"}}>{tt("Find Original Clash","Buscar choque original")}</h1>
  <p>{tt("Find the saved Clash Reports source using its server ID, including links received from a meeting or native plugin. This read requires active project membership and does not change the clash or meeting. The server ID differs from a display number such as CL-007.","Busque la fuente guardada en Reportes de Choques mediante su ID del servidor, incluidos enlaces de reuniones o del complemento. Esta lectura requiere membresía activa y no cambia el choque ni la reunión. El ID del servidor difiere del número visible como CL-007.")}</p>
  <form onSubmit={event=>{event.preventDefault();void load();}} style={{display:"grid",gap:12,margin:"16px 0"}}>
   <label>{tt("Project ID","ID de proyecto")}<input style={inputStyle} inputMode="numeric" value={project} onChange={event=>{clear();setProject(event.target.value);}}/></label>
   <label>{tt("Server clash ID","ID de choque del servidor")}<input style={inputStyle} inputMode="numeric" value={clash} onChange={event=>{clear();setClash(event.target.value);}}/></label>
   <button className="btn btn-primary" disabled={busy} type="submit">{tt("Find saved source","Buscar fuente guardada")}</button>
  </form>
  {busy&&<p role="status">{tt("Verifying saved source…","Verificando fuente guardada…")}</p>}{error&&<p role="alert">{error}</p>}
  {result&&<section aria-live="polite"><h2>{tt("Saved source verified","Fuente guardada verificada")}</h2><p>{tt("Project","Proyecto")} #{Number(project)} · {tt("Report","Reporte")} #{result.reportId} · {tt("Server clash","Choque del servidor")} #{result.id}</p><Link href={result.href}>{tt("Open original clash","Abrir choque original")}</Link><p>{tt("The record opens in its report. Permissions are checked again when you open it.","El registro se abre en su reporte. Los permisos se verifican de nuevo al abrirlo.")}</p></section>}
  {/^[1-9]\d*$/.test(project)&&<p><Link href={`/projects/${Number(project)}/clash-reports`}>{tt("Open project clash register","Abrir registro de choques del proyecto")}</Link></p>}
 </main>;
}
