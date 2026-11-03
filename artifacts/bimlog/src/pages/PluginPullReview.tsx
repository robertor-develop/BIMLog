import {useEffect,useRef,useState} from "react";
import {Link} from "wouter";
import {useAuthStore} from "@/store/auth";
import {useI18n} from "@/lib/i18n";

type PullRow={reportId:number;clashServerId:number;clashId:string|null;fingerprint:string;newStatus:"Active"|"Resolved"|"Approved"|"New";resolvedBy:string|null;notes:string|null};
export function PluginPullReview(){
 const {token}=useAuthStore(),{tt}=useI18n();
 const [project,setProject]=useState(()=>new URLSearchParams(location.search).get("projectId")??"");
 const [rows,setRows]=useState<PullRow[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[readAt,setReadAt]=useState("");
 const epoch=useRef(0),controller=useRef<AbortController|null>(null),lock=useRef(false);
 const clear=()=>{epoch.current++;controller.current?.abort();lock.current=false;setBusy(false);setRows(null);setReadAt("");setError("");};
 useEffect(()=>{clear();return()=>{epoch.current++;controller.current?.abort();};},[token]);
 const load=async()=>{
  if(lock.current)return;
  setRows(null);setReadAt("");setError("");
  if(!token||!/^\d+$/.test(project)||!Number.isSafeInteger(Number(project))||Number(project)<=0){setError(tt("Enter an authorized project ID.","Ingrese un ID de proyecto autorizado."));return;}
  const current=++epoch.current;lock.current=true;setBusy(true);controller.current=new AbortController();
  try{
   const response=await fetch(`/api/v1/projects/${Number(project)}/clash-reports/plugin-pull`,{headers:{Authorization:`Bearer ${token}`},signal:controller.current.signal});
   if(!response.ok)throw new Error([401,403].includes(response.status)?tt("Access denied. Reopen an authorized project or restore your session.","Acceso denegado. Abra un proyecto autorizado o restaure su sesión."):tt("Pending native changes could not be loaded. Retry this read.","No se pudieron cargar los cambios nativos pendientes. Reintente la lectura."));
   const data:unknown=await response.json();
   if(current!==epoch.current)return;
   if(response.headers.get("X-BIMLog-Project-Id")!==String(Number(project))||!Array.isArray(data)||!data.every((row:PullRow)=>row&&Number.isSafeInteger(row.reportId)&&row.reportId>0&&Number.isSafeInteger(row.clashServerId)&&row.clashServerId>0&&(row.clashId===null||typeof row.clashId==="string")&&typeof row.fingerprint==="string"&&row.fingerprint.trim()&&["Active","Resolved","Approved","New"].includes(row.newStatus)&&(row.resolvedBy===null||typeof row.resolvedBy==="string")&&(row.notes===null||typeof row.notes==="string")))throw new Error(tt("The response did not match this project's native pull contract. Reload before using it.","La respuesta no coincide con el contrato nativo de este proyecto. Recargue antes de usarla."));
   setRows(data);setReadAt(new Date().toISOString());
  }catch(failure){if(current===epoch.current)setError(failure instanceof Error?failure.message:String(failure));}
  finally{if(current===epoch.current){lock.current=false;setBusy(false);}}
 };
 const download=()=>{if(!rows)return;const url=URL.createObjectURL(new Blob([JSON.stringify(rows,null,2)],{type:"application/json"}));const anchor=document.createElement("a");anchor.href=url;anchor.download=`BIMLog-Plugin-Pull-${Number(project)}.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const buttonStyle={border:"1px solid #94A3B8",borderRadius:8,padding:"8px 12px",background:"#FFFFFF",color:"#1E3A5F",fontWeight:700,margin:"8px 8px 8px 0",cursor:"pointer"};
 return <main style={{maxWidth:1100,margin:"24px auto",padding:18,overflowWrap:"anywhere"}}>
  <Link href="/all-tools" style={{color:"#1D4ED8",textDecoration:"underline"}}>{tt("All Tools","Todas las herramientas")}</Link><h1 style={{fontSize:26,fontWeight:750,lineHeight:1.2,margin:"14px 0"}}>{tt("Native Clash Pull Review","Revisión de cambios de choques para el complemento")}</h1>
  <p>{tt("Inspect saved platform changes waiting for the native clash plugin: source record, fingerprint, mapped status, assignee and notes. This read does not acknowledge synchronization or apply changes. Use Pull from Platform in the authorized Navisworks model to apply them; native model access remains in Navisworks.","Revise cambios guardados pendientes para el complemento: registro fuente, huella, estado, responsable y notas. Esta lectura no confirma sincronización ni aplica cambios. Use Pull from Platform en el modelo autorizado de Navisworks para aplicarlos; el acceso al modelo permanece en Navisworks.")}</p>
  <label>{tt("Project ID","ID de proyecto")} <input style={{border:"1px solid #94A3B8",borderRadius:6,padding:"8px",width:120,margin:8,background:"#FFFFFF"}} inputMode="numeric" value={project} onChange={event=>{clear();setProject(event.target.value);}}/></label> <button style={buttonStyle} disabled={busy} onClick={()=>void load()}>{tt("Load pending native changes","Cargar cambios nativos pendientes")}</button>
  {busy&&<p role="status">{tt("Loading pending changes…","Cargando cambios pendientes…")}</p>}{error&&<p role="alert">{error}</p>}
  {rows&&<section><h2 style={{fontSize:20,fontWeight:700,margin:"18px 0 8px"}}>{tt("Saved pending changes","Cambios pendientes guardados")} · {rows.length}</h2><p>{tt("Project","Proyecto")} #{Number(project)} · {readAt}</p>
   {rows.length===0?<p role="status">{tt("No platform changes are pending for native pull. This does not prove a live native session is connected.","No hay cambios pendientes para lectura nativa. Esto no prueba que haya una sesión nativa conectada.")}</p>:<div style={{overflowX:"auto"}}><table style={{width:"100%",minWidth:720,borderCollapse:"collapse"}}><thead style={{background:"#E2E8F0",color:"#1E3A5F"}}><tr>{[tt("Source clash","Choque fuente"),tt("Native status","Estado nativo"),tt("Assignee","Responsable"),tt("Notes","Notas"),tt("Fingerprint","Huella")].map(label=><th key={label} style={{textAlign:"left",padding:8,whiteSpace:"nowrap"}}>{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.clashServerId} style={{borderBottom:"1px solid #CBD5E1",verticalAlign:"top"}}><td style={{padding:8}}><Link href={`/projects/${Number(project)}/clash-reports?report=${row.reportId}&clash=${row.clashServerId}`}>{row.clashId||`#${row.clashServerId}`}</Link></td><td style={{padding:8}}>{row.newStatus}</td><td style={{padding:8}}>{row.resolvedBy||"—"}</td><td style={{padding:8,whiteSpace:"pre-wrap"}}>{row.notes||"—"}</td><td style={{padding:8}}><code>{row.fingerprint}</code></td></tr>)}</tbody></table></div>}
   <button style={buttonStyle} onClick={download}>{tt("Download native pull JSON","Descargar JSON para lectura nativa")}</button> <Link style={{color:"#1D4ED8",textDecoration:"underline"}} href={`/projects/${Number(project)}/clash-reports`}>{tt("Open project Clash Reports","Abrir Reportes de Choques del proyecto")}</Link>
  </section>}
 </main>;
}
