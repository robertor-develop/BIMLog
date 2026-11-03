import {useEffect,useRef,useState} from "react";
import {useAuthStore} from "@/store/auth";
type Pending={key:string;projectId:number;userId:number;companyId:number|null;fileName:string;bytes:number;sha256:string;meetingId?:number;title?:string;attendeeCount?:number;actionItemCount?:number;requiresReview?:boolean};
type Props={projectId:number;token:string|null|undefined;lang:string;canWrite:boolean;onImported:()=>void|Promise<void>};
export function MeetingDocumentImport({projectId,token,lang,canWrite,onImported}:Props){
 const user=useAuthStore(s=>s.user),es=lang==="es",t=(en:string,sp:string)=>es?sp:en;
 const storageKey=`bimlog-meeting-import:${user?.companyId??"none"}:${user?.id??"none"}:${projectId}`;
 const [open,setOpen]=useState(false),[pending,setPending]=useState<Pending|null>(null),[file,setFile]=useState<File|null>(null),[sha,setSha]=useState(""),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[verified,setVerified]=useState(false),[storageInvalid,setStorageInvalid]=useState(false);
 const inputRef=useRef<HTMLInputElement>(null);
 const lock=useRef(false),epoch=useRef(0),selection=useRef(0),abort=useRef<AbortController|null>(null);
 const persist=(value:Pending)=>{try{sessionStorage.setItem(storageKey,JSON.stringify(value));}catch{throw Error(t("Browser recovery storage is unavailable. Restore storage before importing.","El almacenamiento de recuperación no está disponible. Restáurelo antes de importar."));}setPending(value);};
 const valid=(value:any):value is Pending=>Boolean(value&&value.projectId===projectId&&value.userId===user?.id&&value.companyId===(user?.companyId??null)&&typeof value.key==="string"&&/^meeting-import-[a-f0-9-]+$/.test(value.key)&&typeof value.fileName==="string"&&value.fileName.length>0&&Number.isSafeInteger(value.bytes)&&value.bytes>0&&value.bytes<=50*1024*1024&&/^[a-f0-9]{64}$/.test(value.sha256)&&(value.meetingId===undefined||(Number.isSafeInteger(value.meetingId)&&value.meetingId>0&&typeof value.title==="string"&&Number.isSafeInteger(value.attendeeCount)&&value.attendeeCount>=0&&Number.isSafeInteger(value.actionItemCount)&&value.actionItemCount>=0)));
 useEffect(()=>{
  epoch.current++;selection.current++;abort.current?.abort();if(inputRef.current)inputRef.current.value="";lock.current=false;setBusy(false);setFile(null);setSha("");setConfirmed(false);setVerified(false);setError("");setStorageInvalid(false);
  setOpen(new URLSearchParams(location.search).get("meetingImport")==="1");
  try{const raw=sessionStorage.getItem(storageKey);if(!raw){setPending(null);return;}const value=JSON.parse(raw);if(!valid(value))throw Error("invalid_recovery");setPending(value);setOpen(true);}catch{setPending(null);setStorageInvalid(true);setError(t("The recovery receipt could not be read. Review the meeting register before clearing it.","No se pudo leer el recibo de recuperación. Revise el registro antes de limpiarlo."));}
  return()=>{epoch.current++;selection.current++;abort.current?.abort();};
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[projectId,token,user?.id,user?.companyId]);
 const importError=(body:any)=>{
  const code=body?.code??body?.error;
  if(code==="AI_SETUP_REQUIRED"||code==="AI_PLATFORM_NOT_CONFIGURED")return t("Configure an AI connection in Integrations, then retry the same import.","Configure una conexión de IA en Integraciones y reintente la misma importación.");
  if(code==="AI_LIMIT_REACHED")return t("The configured AI allowance is exhausted. Review AI settings before retrying.","La cuota de IA está agotada. Revise la configuración antes de reintentar.");
  if(code==="meeting_import_extraction_failed")return t("Document extraction failed. No meeting was created. Retry the same source request.","Falló la extracción. No se creó ningún acta. Reintente la misma solicitud.");
  if(code==="meeting_import_empty_extraction")return t("No meeting information was found. Review the source before retrying.","No se encontró información del acta. Revise el archivo antes de reintentar.");
  if(code==="meeting_import_invalid_date"||code==="meeting_import_invalid_extraction")return t("The extracted information could not be validated. Review the source before retrying.","No se pudo validar la información extraída. Revise el archivo antes de reintentar.");
  if(code==="meeting_import_retry_source_changed")return t("This recovery key belongs to a different source. Review the register before clearing the receipt.","La clave pertenece a otra fuente. Revise el registro antes de limpiar el recibo.");
  if(code==="current_project_company_access_required"||code==="insufficient_permissions")return t("Current project access does not permit this import. Refresh your access before retrying.","Su acceso actual no permite importar. Actualice su acceso antes de reintentar.");
  return t("Import could not be confirmed. Keep the same file and request for recovery.","No se pudo confirmar la importación. Conserve el archivo y solicitud para recuperarla.");
 };

 const choose=async(event:React.ChangeEvent<HTMLInputElement>)=>{
  const chosen=event.target.files?.[0];if(!chosen)return;const current=epoch.current,sequence=++selection.current;setConfirmed(false);setError("");setVerified(false);setFile(null);setSha("");
  if(chosen.size===0||chosen.size>50*1024*1024){setError(t("Choose a nonempty file up to 50 MB.","Elija un archivo no vacío de hasta 50 MB."));event.target.value="";return;}
  try{const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await chosen.arrayBuffer()))).map(v=>v.toString(16).padStart(2,"0")).join("");if(current!==epoch.current||sequence!==selection.current)return;
   if(pending&&(pending.sha256!==fingerprint||pending.fileName!==chosen.name||pending.bytes!==chosen.size))throw Error(t("Reselect the identical file to recover this pending import, or review and clear the pending receipt first.","Vuelva a elegir el mismo archivo para recuperar la importación, o revise y limpie primero el recibo pendiente."));
   setFile(chosen);setSha(fingerprint);
  }catch(failure){if(current===epoch.current&&sequence===selection.current)setError(failure instanceof Error?failure.message:t("File fingerprint failed.","No se pudo verificar el archivo."));}
 };
 const verify=async(receipt:Pending,current:number)=>{
  const response=await fetch(`/api/v1/projects/${projectId}/meetings/${receipt.meetingId}`,{headers:{Authorization:`Bearer ${token}`},signal:abort.current?.signal,cache:"no-store"});
  if(!response.ok)throw Error(t("The saved meeting could not be reopened. Retry verification; no file will be uploaded again.","No se pudo reabrir el acta guardada. Reintente verificar; no se volverá a cargar el archivo."));
  const detail=await response.json();
  if(response.headers.get("x-bimlog-project-id")!==String(projectId)||detail.id!==receipt.meetingId||detail.projectId!==projectId||detail.title!==receipt.title||!Array.isArray(detail.attendees)||!Array.isArray(detail.actionItems)||detail.attendees.length<(receipt.attendeeCount??0)||detail.actionItems.length<(receipt.actionItemCount??0))throw Error(t("The saved meeting identity or imported rows could not be verified. Review the register before continuing.","No se pudo verificar la identidad o las filas importadas. Revise el registro antes de continuar."));
  if(current!==epoch.current)return;setVerified(true);
 };
 const run=async()=>{
  if(lock.current||!token||(!canWrite&&!pending?.meetingId)||storageInvalid||pending?.requiresReview)return;
  if(!pending?.meetingId&&(!file||!sha||!confirmed))return;
  const current=epoch.current;lock.current=true;setBusy(true);setError("");setVerified(false);abort.current=new AbortController();
  try{
   if(pending?.meetingId){await verify(pending,current);return;}
   const receipt:Pending=pending??{key:"meeting-import-"+crypto.randomUUID(),projectId,userId:user!.id,companyId:user?.companyId??null,fileName:file!.name,bytes:file!.size,sha256:sha};
   persist(receipt);
   const form=new FormData();form.append("file",file!);
   const response=await fetch(`/api/v1/projects/${projectId}/meetings/import`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Idempotency-Key":receipt.key,"X-BIMLog-Import-Confirmed":"true"},body:form,signal:abort.current.signal});
   if(current!==epoch.current)return;
   const protocol=response.headers.get("x-bimlog-meeting-import-contract")==="v1";
   if(!protocol&&(response.ok||response.status>=500)){persist({...receipt,requiresReview:true});throw Error(t("The server import protocol could not be verified. Review the meeting register before retrying.","No se pudo verificar el protocolo del servidor. Revise el registro antes de reintentar."));}
   if(!response.ok){let message=t("Import failed. Your request is retained for recovery.","La importación falló. Se conserva la solicitud para recuperarla.");try{const body=await response.json();message=importError(body);}catch{message=t("Import failed without a readable receipt. Review or retry the same request.","La importación falló sin un recibo legible. Revise o reintente la misma solicitud.");}throw Error(message);}
   const body=await response.json();
   if(body.imported!==1||body.projectId!==projectId||!Number.isSafeInteger(body.meetingId)||body.meetingId<=0||typeof body.title!=="string"||!body.title.trim()||body.inputSha256!==receipt.sha256||body.sourceFileName!==receipt.fileName||body.byteCount!==receipt.bytes||body.idempotencyProtected!==true||!Number.isSafeInteger(body.attendeeCount)||body.attendeeCount<0||!Number.isSafeInteger(body.actionItemCount)||body.actionItemCount<0)throw Error(t("Import receipt could not be verified. Keep the same file and request for recovery.","No se pudo verificar el recibo. Conserve el mismo archivo y solicitud para recuperarlo."));
   const known={...receipt,meetingId:body.meetingId,title:body.title,attendeeCount:body.attendeeCount,actionItemCount:body.actionItemCount};setPending(known);persist(known);await verify(known,current);
  }catch(failure){if(current===epoch.current)setError(failure instanceof Error&&failure.name!=="AbortError"?failure.message:t("Import interrupted. The pending request is retained.","Importación interrumpida. Se conserva la solicitud pendiente."));}
  finally{if(current===epoch.current){lock.current=false;setBusy(false);}}
 };
 const clear=()=>{
  if(busy||!window.confirm(t("Review the meeting register first. Clearing this device's receipt does not cancel an import or remove saved records. Continue?","Revise primero el registro. Limpiar el recibo no cancela una importación ni elimina actas guardadas. ¿Continuar?")))return;
  try{sessionStorage.removeItem(storageKey);}catch{setError(t("Recovery storage could not be cleared.","No se pudo limpiar el almacenamiento."));return;}
  if(inputRef.current)inputRef.current.value="";
  setPending(null);setStorageInvalid(false);setFile(null);setSha("");setConfirmed(false);setVerified(false);setError("");
 };
 return <details open={open} onToggle={event=>setOpen(event.currentTarget.open)} style={{maxWidth:440,minWidth:0,border:"1px solid #cbd5e1",borderRadius:8,padding:8}}>
  <summary style={{cursor:"pointer",fontWeight:600,minHeight:44}}>{t("Import Minutes","Importar Acta")}</summary>
  <p style={{fontSize:12}}>{t("Upload meeting minutes from PDF, spreadsheets or readable text. Confirming creates a meeting, attendees and actions using your configured AI allowance. Review the saved results in the full meeting register. The original file stays on your device.","Cargue actas en PDF, hojas de cálculo o texto legible. Al confirmar se crean acta, asistentes y acciones con su cuota de IA configurada. Revise los resultados en el registro completo. El archivo original permanece en su dispositivo.")}</p>
  <p style={{fontSize:12}}><a href={`/projects/${projectId}/meetings`}>{t("Review meeting register","Revisar registro de actas")}</a> · <a href={`/projects/${projectId}/integrations`}>{t("AI connection settings","Configuración de IA")}</a></p>
  {!canWrite&&<p role="status">{t("Current project write permission is required to import.","Se requiere permiso actual de escritura del proyecto para importar.")}</p>}
  {pending&&<p style={{fontSize:12,overflowWrap:"anywhere"}}>{t("Pending request","Solicitud pendiente")}: {pending.key}<br/>{pending.fileName} · {pending.bytes} bytes · SHA-256 {pending.sha256}{!pending.meetingId&&<><br/>{t("After refresh, reselect the identical file to recover this request.","Después de actualizar, elija el mismo archivo para recuperar la solicitud.")}</>}</p>}
  {!pending?.meetingId&&<><label style={{display:"grid",gap:6}}>{t("Meeting source file","Archivo fuente del acta")}<input ref={inputRef} aria-label={t("Meeting source file","Archivo fuente del acta")} type="file" onChange={event=>void choose(event)} disabled={!canWrite||busy||storageInvalid||pending?.requiresReview} style={{maxWidth:"100%",minWidth:0}}/></label>
  {file&&<p style={{fontSize:12,overflowWrap:"anywhere"}}>{file.name} · {file.size} bytes · SHA-256 {sha}</p>}
  <label style={{display:"flex",gap:8,alignItems:"start",margin:"12px 0"}}><input type="checkbox" aria-label={t("Confirm meeting import","Confirmar importación del acta")} checked={confirmed} disabled={!canWrite||busy||!file||!sha} onChange={e=>setConfirmed(e.target.checked)}/><span>{t("I reviewed this file and authorize creating the meeting, attendees and action items.","Revisé este archivo y autorizo crear el acta, asistentes y acciones.")}</span></label></>}
  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button type="button" className="btn btn-primary" onClick={()=>void run()} disabled={(!canWrite&&!pending?.meetingId)||busy||storageInvalid||pending?.requiresReview||(!pending?.meetingId&&(!file||!sha||!confirmed))} style={{minHeight:44}}>{busy?t("Verifying import...","Verificando importación..."):pending?.meetingId?t("Verify saved import","Verificar importación guardada"):pending?t("Retry same import","Reintentar la misma importación"):t("Confirm and import","Confirmar e importar")}</button>
  {(pending||storageInvalid)&&<button type="button" className="btn btn-outline" onClick={clear} disabled={busy} style={{minHeight:44}}>{t("Clear local receipt after review","Limpiar recibo local tras revisar")}</button>}</div>
  {error&&<p role="alert" style={{color:"#b91c1c",overflowWrap:"anywhere"}}>{error}</p>}
  {verified&&pending?.meetingId&&<p role="status" style={{overflowWrap:"anywhere"}}>{t("Imported meeting verified","Acta importada verificada")}: #{pending.meetingId} · {pending.title}<br/>{pending.attendeeCount} {t("attendees","asistentes")} · {pending.actionItemCount} {t("actions","acciones")}<br/><a href={`/projects/${projectId}/meetings?meeting=${pending.meetingId}`}>{t("Open saved meeting","Abrir acta guardada")}</a><br/><button type="button" className="btn btn-outline" style={{minHeight:44}} onClick={()=>void onImported()}>{t("Refresh meeting register","Actualizar registro de actas")}</button></p>}
 </details>;
}
