import {useEffect,useRef,useState} from "react";
import {Link} from "wouter";
import {useAuthStore} from "@/store/auth";
import {useI18n} from "@/lib/i18n";
type Snapshot={projectId?:unknown;clashes:Array<Record<string,unknown>>};
type SavedRow={id:number;reportId:number;status:string|null;fingerprint:string|null;created:boolean};
type Receipt={projectId:number;reportId:number;created:number;updated:number;results:SavedRow[];syncToken:string};
export function PluginSyncReview(){
 const {token}=useAuthStore(),{tt}=useI18n();
 const [project,setProject]=useState(()=>new URLSearchParams(location.search).get("projectId")??""),[text,setText]=useState("");
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [receipt,setReceipt]=useState<Receipt|null>(null),[verified,setVerified]=useState(false);
 const epoch=useRef(0),lock=useRef(false);
 const clear=()=>{epoch.current++;setSnapshot(null);setConfirmed(false);setReceipt(null);setVerified(false);setError("");};
 useEffect(()=>{clear();lock.current=false;setBusy(false);setText("");return()=>{epoch.current++;};},[token]);
 const review=()=>{clear();try{
  const projectId=Number(project);if(!/^\d+$/.test(project)||!Number.isSafeInteger(projectId)||projectId<=0||new TextEncoder().encode(text).length>5*1024*1024)throw new Error("context");
  const data=JSON.parse(text) as Snapshot;
  if(!Array.isArray(data.clashes)||!data.clashes.length||data.clashes.length>5000||!data.clashes.every(row=>row&&typeof row==="object"&&!Array.isArray(row)&&[row.fingerprint,row.clashId,row.name,row.description].some(value=>(typeof value==="string"&&value.trim())||(typeof value==="number"&&Number.isFinite(value)))&&[data.projectId,row.projectId].every(value=>value===undefined||Number(value)===projectId)&&["distance","positionX","positionY","positionZ"].every(key=>row[key]===undefined||row[key]===null||row[key]===""||Number.isFinite(Number(row[key])))))throw new Error("snapshot");
  const fingerprints=data.clashes.filter(row=>row.fingerprint).map(row=>String(row.fingerprint));if(new Set(fingerprints).size!==fingerprints.length)throw new Error("duplicate");setSnapshot(data);
 }catch(failure){setError(tt("Review a valid destination and JSON with 1–5,000 identifiable clashes (maximum 5 MB), finite coordinates and unique nonempty fingerprints. Supplied project IDs must match the destination.","Revise destino y JSON válidos con 1–5.000 choques identificables (máximo 5 MB), coordenadas finitas y huellas no vacías únicas. Los IDs de proyecto deben coincidir con el destino."));}};
 const reopen=async(saved:Receipt,current:number)=>{
  const reports=new Map<number,any>();
  for(const id of new Set(saved.results.map(row=>row.reportId))){
   const response=await fetch(`/api/v1/projects/${saved.projectId}/clash-reports/${id}`,{headers:{Authorization:`Bearer ${token}`}});const data=await response.json().catch(()=>({}));if(current!==epoch.current)return false;
   if(!response.ok||data.report?.id!==id||data.report?.projectId!==saved.projectId||!Array.isArray(data.clashes))throw new Error("reopen");reports.set(id,data);
  }
  for(const row of saved.results){const actual=reports.get(row.reportId).clashes.find((item:SavedRow)=>item.id===row.id);if(!actual||actual.status!==row.status||(actual.fingerprint??null)!==row.fingerprint)throw new Error("saved_identity");}
  return true;
 };
 const execute=async()=>{
  if(!token||!snapshot||lock.current||(!receipt&&!confirmed))return;const current=epoch.current;lock.current=true;setBusy(true);setError("");setConfirmed(false);setVerified(false);
  try{
   let saved=receipt;
   if(!saved){const response=await fetch(`/api/v1/projects/${Number(project)}/clash-reports/plugin-sync`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(snapshot)});const data=await response.json().catch(()=>({}));if(current!==epoch.current)return;if(!response.ok)throw new Error([401,403].includes(response.status)?"access_denied":data.message||data.error||String(response.status));
    if(data.projectId!==Number(project)||!Number.isSafeInteger(data.reportId)||!Number.isInteger(data.created)||!Number.isInteger(data.updated)||typeof data.syncToken!=="string"||!Array.isArray(data.results)||data.results.length!==snapshot.clashes.length||data.created+data.updated!==data.results.length||!data.results.every((row:SavedRow,index:number)=>row&&Number.isSafeInteger(row.id)&&row.id>0&&Number.isSafeInteger(row.reportId)&&row.reportId>0&&(typeof row.status==="string"||row.status===null)&&typeof row.created==="boolean"&&row.fingerprint===(snapshot.clashes[index].fingerprint?String(snapshot.clashes[index].fingerprint):null)))throw new Error("receipt");saved=data;setReceipt(saved);
   }
   if(!saved)throw new Error("receipt");if(await reopen(saved,current)&&current===epoch.current)setVerified(true);
  }catch(failure){if(current===epoch.current)setError(failure instanceof Error&&failure.message==="access_denied"?tt("Access denied: an active session and project write permission are required. No sync was accepted.","Acceso denegado: se requiere sesión activa y permiso de escritura del proyecto. No se aceptó sincronización."):tt("Sync or saved-record verification could not be confirmed. Inspect the destination before any new sync. If a saved receipt is shown, retry only Reopen saved records; it does not send another sync.","No se confirmó la sincronización o los registros guardados. Revise el destino antes de otra sincronización. Si hay comprobante, reintente solo Reabrir registros guardados; no envía otra sincronización."));}
  finally{if(current===epoch.current){lock.current=false;setBusy(false);}}
 };
 const button={border:"1px solid #94A3B8",borderRadius:8,padding:"8px 12px",background:"white",fontWeight:700,margin:"8px 8px 8px 0"};
 return <main style={{maxWidth:1050,margin:"24px auto",padding:18,overflowWrap:"anywhere"}}><Link href="/all-tools">{tt("All Tools","Todas las herramientas")}</Link><h1 style={{fontSize:26,fontWeight:750,margin:"14px 0"}}>{tt("Native Clash Sync Review","Revisión de sincronización de choques nativos")}</h1>
  <p>{tt("Review and explicitly synchronize a prepared native clash JSON snapshot. Native capture stays in Navisworks. This writes platform records: it creates missing clashes, updates matching fingerprint statuses and restores matching deleted clashes. Rows without fingerprints can create duplicates on a new sync; inspect saved records before replaying uncertain outcomes.","Revise y sincronice explícitamente un snapshot JSON preparado. La captura permanece en Navisworks. Esto escribe registros: crea choques faltantes, actualiza estados por huella y restaura choques eliminados coincidentes. Las filas sin huella pueden duplicarse en otra sincronización; revise registros antes de repetir resultados inciertos.")}</p>
  <fieldset disabled={busy} style={{minWidth:0,marginTop:14}}><legend>{tt("Destination and prepared snapshot","Destino y snapshot preparado")}</legend><label>{tt("Destination project ID","ID de proyecto destino")} <input inputMode="numeric" style={{border:"1px solid #94A3B8",borderRadius:6,padding:8,width:120}} value={project} onChange={event=>{clear();setProject(event.target.value);}}/></label><label style={{display:"block",marginTop:12}}>{tt("Native clash snapshot JSON","Snapshot JSON de choques nativos")}<textarea rows={10} style={{width:"100%",boxSizing:"border-box",border:"1px solid #94A3B8",borderRadius:6,padding:8}} value={text} onChange={event=>{clear();setText(event.target.value);}}/></label><button style={button} onClick={review}>{tt("Review clash snapshot","Revisar snapshot de choques")}</button></fieldset>
  {error&&<p role="alert" style={{color:"#B91C1C"}}>{error}</p>}{busy&&<p role="status">{tt("Saving or reopening verified identities…","Guardando o reabriendo identidades verificadas…")}</p>}
  {snapshot&&<section><h2 style={{fontSize:20,fontWeight:700}}>{tt("Reviewed destination","Destino revisado")} #{Number(project)} · {snapshot.clashes.length} {tt("clashes","choques")}</h2><details><summary>{tt("First 25 source identities and statuses","Primeras 25 identidades y estados fuente")}</summary><ul>{snapshot.clashes.slice(0,25).map((row,index)=><li key={index}>{String(row.clashId??row.name??row.fingerprint??index)} · {String(row.status??"open")} · {String(row.fingerprint??tt("No fingerprint","Sin huella"))}</li>)}</ul></details>
   {!receipt&&<label><input type="checkbox" disabled={busy} checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>{tt("I reviewed the exact destination and the write/restore behavior","Revisé el destino exacto y el comportamiento de escritura/restauración")}</label>} <button style={button} disabled={busy||(!receipt&&!confirmed)} onClick={()=>void execute()}>{receipt?tt("Reopen saved records","Reabrir registros guardados"):tt("Sync reviewed clashes","Sincronizar choques revisados")}</button>
  </section>}
  {receipt&&<section><h2 style={{fontSize:20,fontWeight:700}}>{tt("Saved sync receipt","Comprobante de sincronización guardada")}</h2><p role="status">{verified?tt("Saved records reopened and verified.","Registros guardados reabiertos y verificados."):tt("Saved receipt received; record reopening remains unverified.","Comprobante recibido; reapertura de registros sin verificar.")}</p><p>{receipt.created} {tt("created","creados")} · {receipt.updated} {tt("updated","actualizados")} · {receipt.syncToken}</p><ul>{receipt.results.map((row,index)=><li key={index}><Link href={`/projects/${receipt.projectId}/clash-reports?report=${row.reportId}&clash=${row.id}`}>#{row.id}</Link> · {row.status??"—"} · {row.fingerprint??tt("No fingerprint","Sin huella")}</li>)}</ul></section>}
  <Link href={`/projects/${Number(project)||""}/clash-reports`}>{tt("Inspect destination Clash Reports","Inspeccionar Reportes de Choques del destino")}</Link>
 </main>;
}
