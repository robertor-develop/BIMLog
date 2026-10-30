import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import './MeetingLensSources.css';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/lib/i18n';
type Candidate = {id:number;number:string;title:string;alreadyAdded:boolean;[key:string]:unknown};
const fields=['id','number','title','description','status','responsible','alreadyAdded'];
const labels:Record<string,[string,string]>={id:['RFI record ID','ID del registro RFI'],number:['RFI number','Número RFI'],title:['Title','Título'],description:['Description','Descripción'],status:['Workflow status','Estado del flujo'],responsible:['Responsible party','Responsable']};
export function MeetingRfiSources(){
 const {token,user}=useAuthStore(),{lang}=useI18n();const es=lang==='es',t=(en:string,sp:string)=>es?sp:en;
 const initial=new URLSearchParams(location.search);
 const [project,setProject]=useState(initial.get('projectId')??''),[query,setQuery]=useState(initial.get('q')??''),[meeting,setMeeting]=useState(initial.get('meeting_id')??'');
 const [request,setRequest]=useState(()=>({project:initial.get('projectId')??'',q:initial.get('q')??'',meeting:initial.get('meeting_id')??'',serial:0}));
 const [rows,setRows]=useState<Candidate[]>([]),[selected,setSelected]=useState(Number(initial.get('candidate'))||0),[error,setError]=useState(''),[busy,setBusy]=useState(false),[checked,setChecked]=useState('');
 const epoch=useRef(0);
 useEffect(()=>{const current=++epoch.current,controller=new AbortController();setRows([]);setError('');setChecked('');setBusy(false);
 if(!/^[1-9]\d*$/.test(request.project)||!Number.isSafeInteger(Number(request.project))||(request.meeting!==''&&(!/^[1-9]\d*$/.test(request.meeting)||!Number.isSafeInteger(Number(request.meeting))))){setError(t('Choose a valid project and optional saved meeting ID.','Elija un proyecto válido y un ID opcional de acta guardada.'));return;}
 if(!token)return;setBusy(true);const params=new URLSearchParams({q:request.q});if(request.meeting)params.set('meeting_id',request.meeting);
 fetch(`/api/v1/projects/${request.project}/meetings/rfi-candidates?${params}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal}).then(async response=>{
 if(!response.ok)throw Error(response.status===403?t('Your current account cannot read this project. Review project access, then retry.','Su cuenta actual no puede leer este proyecto. Revise el acceso y reintente.'):t(`Source read failed (${response.status}). Retry this read.`,`Falló la lectura (${response.status}). Reintente.`));
 const body=await response.json();if(response.headers.get('x-bimlog-project-id')!==request.project||!Array.isArray(body)||body.length>100||new Set(body.map((r:any)=>r.id)).size!==body.length||!body.every((r:any)=>r&&Object.keys(r).length===fields.length&&fields.every(f=>Object.hasOwn(r,f))&&Number.isSafeInteger(r.id)&&r.id>0&&typeof r.number==='string'&&r.number.length>0&&typeof r.title==='string'&&r.title.length>0&&typeof r.alreadyAdded==='boolean'&&fields.filter(f=>!['id','alreadyAdded'].includes(f)).every(f=>r[f]===null||typeof r[f]==='string')))throw Error(t('The source response could not be verified. No stale results are shown.','No se pudo verificar la respuesta. No se muestran resultados anteriores.'));return body as Candidate[];
 }).then(body=>{if(controller.signal.aborted||epoch.current!==current)return;setRows(body);setSelected(id=>body.some(r=>r.id===id)?id:0);setChecked(new Date().toISOString());}).catch(cause=>{if(!controller.signal.aborted&&epoch.current===current){setError(String(cause.message));setSelected(0);}}).finally(()=>{if(!controller.signal.aborted&&epoch.current===current)setBusy(false);});
 return()=>{controller.abort();epoch.current++;};
 },[request,token,user?.id,user?.companyId,lang]);
 const chosen=rows.find(row=>row.id===selected);
 function remember(id:number){setSelected(id);const p=new URLSearchParams(location.search);if(id)p.set('candidate',String(id));else p.delete('candidate');history.replaceState(null,'',`${location.pathname}?${p}`);}
 return <main className="meeting-source-browser" style={{padding:24,maxWidth:1100,margin:'auto',overflowWrap:'anywhere'}}><Link href="/all-tools">{t('All tools','Todas las herramientas')}</Link><h1>{t('Meeting RFI Source Browser','Fuentes RFI para actas')}</h1><p>{t('Inspect current project RFIs, their status and responsible party. To link sources, open New/Edit in the full meeting minutes workflow and choose Add Existing RFI. This browser reads source metadata; it does not change records.','Inspeccione RFIs actuales, su estado y responsable. Para vincularlas, abra Nueva/Editar en Actas y elija Agregar RFI existente. Este explorador lee metadatos; no modifica registros.')}</p>
 <form onSubmit={event=>{event.preventDefault();const p=new URLSearchParams({projectId:project,q:query});if(meeting)p.set('meeting_id',meeting);history.replaceState(null,'',`${location.pathname}?${p}`);setSelected(0);setRequest({project,q:query,meeting,serial:request.serial+1});}} style={{display:'flex',gap:12,flexWrap:'wrap'}}>
 <label>{t('Project ID','ID de proyecto')}<input aria-label={t('Project ID','ID de proyecto')} inputMode="numeric" value={project} onChange={e=>setProject(e.target.value)} style={{display:'block',border:'1px solid',padding:8,maxWidth:'100%'}}/></label>
 <label>{t('Search sources','Buscar fuentes')}<input value={query} onChange={e=>setQuery(e.target.value)} style={{display:'block',border:'1px solid',padding:8,maxWidth:'100%'}}/></label>
 <label>{t('Saved meeting ID (optional)','ID de acta guardada (opcional)')}<input inputMode="numeric" value={meeting} onChange={e=>setMeeting(e.target.value)} style={{display:'block',border:'1px solid',padding:8,maxWidth:'100%'}}/></label><button type="submit">{t('Search / refresh','Buscar / actualizar')}</button></form>
 <Link href="/plugin-project-directory">{t('Find authorized projects','Ver proyectos autorizados')}</Link>
 {busy&&<p role="status">{t('Loading current sources…','Cargando fuentes actuales…')}</p>}{error&&<p role="alert">{error}</p>}
 {checked&&<><p role="status">{t('Verified read','Lectura verificada')}: {checked}. {t('Up to 100 matching RFIs, ordered by number.','Hasta 100 RFIs coincidentes, ordenados por número.')} {t('Project','Proyecto')}: {request.project}</p>{!rows.length&&<p>{t('No matching RFIs. Change the search or inspect the RFI register.','No hay RFIs coincidentes. Cambie la búsqueda o revise RFIs.')}</p>}
 <ul>{rows.map(row=><li key={row.id}><button type="button" onClick={()=>remember(row.id)} aria-pressed={selected===row.id}>{row.number} — {String(row.title)}</button></li>)}</ul></>}
 {chosen&&<section aria-label={t('Selected source','Fuente seleccionada')}><h2>{chosen.number}</h2><dl>{fields.filter(f=>f!=='alreadyAdded').map(field=><div key={field}><dt>{t(labels[field][0],labels[field][1])}</dt><dd>{chosen[field]===null?t('Not recorded','No registrado'):String(chosen[field])}</dd></div>)}</dl><p>{request.meeting?t(chosen.alreadyAdded?'Already linked to this meeting':'Not linked to this meeting',chosen.alreadyAdded?'Ya vinculada a esta acta':'No vinculada a esta acta'):t('Choose a saved meeting context to check whether it already links this source.','Elija un acta guardada para comprobar el vínculo.')}</p><Link href={`/projects/${request.project}/rfis?rfi=${chosen.id}`}>{t('Open source RFI','Abrir fuente RFI')}</Link></section>}
 {checked&&<p><Link href={`/projects/${request.project}/meetings`}>{t('Open full meeting minutes workflow','Abrir flujo completo de actas')}</Link></p>}
 </main>;
}
