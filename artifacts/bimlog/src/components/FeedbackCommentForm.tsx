import React, { useEffect, useRef, useState } from 'react';
const base=(import.meta.env.VITE_API_URL as string|undefined)??'';
export function FeedbackCommentForm({caseId,token,es,onSaved}:{caseId:number;token:string|null;es:boolean;onSaved:()=>void}){
  const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');const request=useRef<AbortController|null>(null);
  useEffect(()=>{setText('');setBusy(false);setError('');setNotice('');return()=>request.current?.abort();},[caseId,token]);
  async function save(){if(busy||!text.trim()||!token)return;const controller=new AbortController();request.current=controller;setBusy(true);setError('');setNotice('');try{
    const response=await fetch(`${base}/api/v1/feedback/${caseId}/comments`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({comment:text.trim()}),signal:controller.signal});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.code||body.error||String(response.status));if(!Number.isSafeInteger(body.comment?.id)||body.comment?.text!==text.trim()||!body.comment?.createdAt)throw new Error('INVALID_COMMENT_RECEIPT');
    if(!controller.signal.aborted){setText('');setNotice(`${es?'Comentario guardado':'Comment saved'} · #${body.comment.id} · ${body.comment.createdAt}`);onSaved();}
  }catch(caught){if(!controller.signal.aborted)setError(`${String(caught instanceof Error?caught.message:caught)} — ${es?'Consulte el historial antes de reenviar si no sabe si se guardó.':'Check history before resending if the save outcome is uncertain.'}`);}finally{if(!controller.signal.aborted)setBusy(false);}}
  return <details><summary>{es?'Añadir información a este comentario':'Add follow-up information to this feedback'}</summary><p>{es?'El comentario se guarda en el historial del caso. No cambia su estado ni reemplaza la evidencia adjunta.':'The comment is saved in this case’s history. It does not change disposition or replace attached evidence.'}</p>
    <form onSubmit={event=>{event.preventDefault();void save();}}><label>{es?'Información de seguimiento':'Follow-up information'}<textarea required maxLength={4000} value={text} disabled={busy} onChange={event=>setText(event.target.value)} style={{display:'block',width:'100%',minHeight:90}}/></label><p>{text.length}/4000</p><button disabled={busy||!text.trim()||!token}>{busy?(es?'Guardando…':'Saving…'):(es?'Guardar en el historial':'Save to case history')}</button></form>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </details>;
}
