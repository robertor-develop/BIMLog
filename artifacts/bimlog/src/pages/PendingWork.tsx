import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/lib/i18n';

const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const types = ['rfis','submittals','files'] as const;
type PendingType = typeof types[number];
type Row = { id:number; project_id:number; project_name:string; project_code:string; title?:string; file_name?:string; rfi_number?:string; submittal_number?:string; status?:string; due_date?:string; compliance_status?:boolean; cvr_workflow_status?:string };
export function PendingWork() {
  const {token}=useAuthStore(), {lang,tt}=useI18n();
  const [type,setType]=useState<PendingType>('rfis'),[rows,setRows]=useState<Row[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[exporting,setExporting]=useState(false),[notice,setNotice]=useState('');
  const exportRequest=useRef<AbortController|null>(null);
  useEffect(()=>{const controller=new AbortController();setRows([]);setLoading(true);setError('');setNotice('');setExporting(false);
    void (async()=>{try{const response=await fetch(`${base}/api/v1/dashboard/pending/${type}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.error||String(response.status));if(!Array.isArray(body)||body.some(row=>!Number.isSafeInteger(row.id)||!Number.isSafeInteger(row.project_id)))throw new Error('INVALID_PENDING_RESPONSE');if(!controller.signal.aborted)setRows(body);}catch(caught){if(!controller.signal.aborted)setError(String(caught instanceof Error?caught.message:caught));}finally{if(!controller.signal.aborted)setLoading(false);}})();
    return()=>{controller.abort();exportRequest.current?.abort();};
  },[token,type,reload]);
  async function exportPdf(){if(exporting||loading)return;const controller=new AbortController();exportRequest.current=controller;setExporting(true);setError('');setNotice('');try{
    const response=await fetch(`${base}/api/v1/dashboard/pending/export-pdf`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({type,lang}),signal:controller.signal});
    if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||String(response.status));}
    if(!response.headers.get('Content-Type')?.includes('application/pdf'))throw new Error('INVALID_PDF_RESPONSE');
    const blob=await response.blob();if(controller.signal.aborted)return;const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`pending-${type}.pdf`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice(`${tt('PDF downloaded from your current authorized records. Content hash','PDF descargado desde sus registros autorizados actuales. Huella del contenido')}: ${response.headers.get('X-Content-SHA256')??tt('not supplied','no suministrada')}`);
  }catch(caught){if(!controller.signal.aborted)setError(String(caught instanceof Error?caught.message:caught));}finally{if(!controller.signal.aborted)setExporting(false);}}
  const names={rfis:tt('Open RFIs','RFI abiertos'),submittals:tt('Pending submittals','Submittals pendientes'),files:tt('Files needing attention','Archivos que requieren atención')};
  return <main id="main-content" tabIndex={-1} style={{maxWidth:1100,margin:'auto',padding:'24px clamp(16px,4vw,40px)'}}>
    <Link href="/dashboard">{tt('Open dashboard','Abrir panel')}</Link><h1>{tt('Pending Work','Trabajo pendiente')}</h1>
    <p>{tt('Review pending records across your authorized projects. Open each working module to act; project permissions control available actions. PDF export uses the latest server records for the selected category.','Revise registros pendientes de sus proyectos autorizados. Abra el módulo operativo para actuar; los permisos de proyecto controlan las acciones. La exportación PDF usa los registros actuales del servidor para la categoría seleccionada.')}</p>
    <label>{tt('Category','Categoría')} <select value={type} onChange={event=>setType(event.target.value as PendingType)}>{types.map(value=><option key={value} value={value}>{names[value]}</option>)}</select></label>
    <button disabled={loading||exporting} onClick={()=>setReload(value=>value+1)}>{tt('Refresh saved records','Actualizar registros guardados')}</button>
    <button disabled={loading||exporting} onClick={()=>void exportPdf()}>{exporting?tt('Exporting…','Exportando…'):tt('Export category PDF','Exportar categoría en PDF')}</button>
    {loading&&<p role="status">{tt('Loading pending records…','Cargando registros pendientes…')}</p>}{error&&<p role="alert">{error} <button onClick={()=>setReload(value=>value+1)}>{tt('Retry','Reintentar')}</button></p>}{notice&&<p role="status">{notice}</p>}
    {!loading&&!error&&rows.length===0&&<p role="status">{tt('No pending records in this category for your authorized projects.','No hay registros pendientes en esta categoría para sus proyectos autorizados.')}</p>}
    <ul>{rows.map(row=><li key={`${row.project_id}:${row.id}`}><h2>{row.rfi_number||row.submittal_number||row.file_name||row.title} {row.title&&<span>— {row.title}</span>}</h2><p>{row.project_code} · {row.project_name} · ID {row.id}</p>
      <p>{tt('State','Estado')}: {type==='files'?`${row.cvr_workflow_status??'—'} · ${row.compliance_status===false?tt('Non-compliant','No conforme'):tt('Review compliance','Revisar conformidad')}`:row.status} {row.due_date&&<>· {tt('Due','Vencimiento')}: {row.due_date}</>}</p>
      <Link href={`/projects/${row.project_id}/${type}${type==='rfis'?`?rfi=${row.id}`:type==='submittals'?`?submittal=${row.id}`:''}`}>{type==='files'?tt('Open project files to review this file','Abrir archivos del proyecto para revisar este archivo'):tt('Open record and actions','Abrir registro y acciones')}</Link>
    </li>)}</ul>
  </main>;
}
