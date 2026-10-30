import { useEffect, useRef, useState } from "react";
import { PrintPdfButton } from "@/components/PrintPdfButton";

type Props = {projectId:number;token:string|null|undefined;lang:string;view:"meetings"|"actions"};
export function MeetingCurrentViewExports({projectId,token,lang,view}:Props){
 const es=lang==="es",t=(en:string,sp:string)=>es?sp:en;
 const [mode,setMode]=useState<"current"|"summary">("current");
 const [busy,setBusy]=useState<"pdf"|"xlsx"|null>(null);
 const [error,setError]=useState("");
 const [receipt,setReceipt]=useState<{format:string;bytes:number;sha256:string;projectId:number}|null>(null);
 const lock=useRef(false),epoch=useRef(0),controller=useRef<AbortController|null>(null);
 useEffect(()=>{epoch.current++;controller.current?.abort();lock.current=false;setBusy(null);setError("");setReceipt(null);return()=>{epoch.current++;controller.current?.abort();};},[projectId,token,view,lang]);
 const download=async(format:"pdf"|"xlsx")=>{
  if(!token||lock.current)return;
  lock.current=true;const current=epoch.current;controller.current=new AbortController();setBusy(format);setError("");setReceipt(null);
  try{
   const params=new URLSearchParams({lang,view,sections:mode==="summary"?"summary":view==="actions"?"summary,actions":"summary,meetings,linked_records"});
   const response=await fetch(`/api/v1/projects/${projectId}/meetings/current-view/${format}?${params}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.current.signal,cache:"no-store"});
   if(!response.ok)throw Error(response.status===401||response.status===403?t("Access denied. Refresh your project access before retrying.","Acceso denegado. Actualice su acceso al proyecto antes de reintentar."):t("Export could not be prepared. Retry this download.","No se pudo preparar la exportación. Reintente la descarga."));
   const type=response.headers.get("content-type")?.split(";")[0];
   if(response.headers.get("x-bimlog-project-id")!==String(projectId)||type!==(format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))throw Error(t("The export identity or format is invalid. No file was downloaded.","La identidad o el formato no es válido. No se descargó ningún archivo."));
   const bytes=await response.arrayBuffer();const signature=new Uint8Array(bytes);
   if(format==="pdf"?String.fromCharCode(...signature.slice(0,5))!=="%PDF-":signature[0]!==0x50||signature[1]!==0x4b)throw Error(t("The export is incomplete. Retry this download.","La exportación está incompleta. Reintente la descarga."));
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(v=>v.toString(16).padStart(2,"0")).join("");
   if(current!==epoch.current)return;
   const url=URL.createObjectURL(new Blob([bytes],{type}));const link=document.createElement("a");link.href=url;link.download=`meetings-${view}-project-${projectId}.${format}`;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
   setReceipt({format,bytes:bytes.byteLength,sha256:hash,projectId});
  }catch(err){if(current===epoch.current)setError(err instanceof Error&&err.name!=="AbortError"?err.message:t("Download cancelled.","Descarga cancelada."));}
  finally{if(current===epoch.current){lock.current=false;setBusy(null);}}
 };
 return <section aria-label={t("Meeting view exports","Exportaciones de reuniones")} style={{maxWidth:"100%",minWidth:0}}>
  <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
   <PrintPdfButton lang={lang} onClick={()=>void download("pdf")} loading={busy==="pdf"} disabled={!!busy||!token} disabledReason={t("Download saved project meeting data for the selected tab. Official detailed minutes remain available per meeting.","Descargue los datos guardados de la pestaña del proyecto. Las actas oficiales detalladas siguen disponibles en cada reunión.")} currentViewSummary={[`${t("Project","Proyecto")}: ${projectId}`,view==="actions"?t("Actions","Acciones"):t("Meetings","Reuniones")]} options={<label style={{display:"grid",gap:6}}>{t("PDF sections","Secciones del PDF")}<select aria-label={t("Current view PDF sections","Secciones del PDF de vista actual")} value={mode} onChange={e=>setMode(e.target.value==="summary"?"summary":"current")} style={{minHeight:44,maxWidth:"100%"}}><option value="current">{view==="actions"?t("Summary + Actions","Resumen + acciones"):t("Summary + Meeting Register","Resumen + registro de reuniones")}</option><option value="summary">{t("Summary only","Solo resumen")}</option></select></label>}/>
   <button type="button" className="btn btn-outline" disabled={!!busy||!token} onClick={()=>void download("xlsx")} style={{minHeight:44}}>{busy==="xlsx"?t("Preparing Excel...","Preparando Excel..."):t("Download Excel","Descargar Excel")}</button>
  </div>
  <p style={{fontSize:12,maxWidth:440}}>{t("PDF follows the selected tab and sections. Excel includes the saved meeting register, actions and project activity history. Exports do not modify records.","El PDF incluye la pestaña y secciones elegidas. Excel incluye el registro guardado, acciones e historial del proyecto. Las exportaciones no modifican registros.")}</p>
  {error&&<p role="alert" style={{color:"#b91c1c",overflowWrap:"anywhere"}}>{error}</p>}
  {receipt&&<p role="status" style={{fontSize:12,overflowWrap:"anywhere",maxWidth:440}}>{t("Download prepared","Descarga preparada")}: {receipt.format.toUpperCase()} · {t("Project","Proyecto")} {receipt.projectId} · {receipt.bytes} bytes · SHA-256 {receipt.sha256}</p>}
 </section>;
}
