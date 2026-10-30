import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { FeaturePolicySettingsPanel } from '@/components/settings/FeaturePolicySettingsPanel';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/lib/i18n';
const base=(import.meta.env.VITE_API_URL as string|undefined)??'';
type Caps={companyPolicyAdmin:boolean;projects:{id:number;name:string;active:boolean;canConfigure:boolean}[]};
type Event={featureKey:string;scopeType:string;version:number;decision:string;reasonCode:string;explanation:{en:string;es:string};effectiveFrom:string;effectiveTo:string|null;createdAt:string;authority:string;evidence:{source:string}};
export function FeaturePolicyWorkspace(){
  const {token}=useAuthStore(),{lang,tt}=useI18n();const [caps,setCaps]=useState<Caps|null>(null),[scope,setScope]=useState<'company'|'project'>('project'),[project,setProject]=useState(''),[feature,setFeature]=useState(''),[rows,setRows]=useState<Event[]>([]),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[context,setContext]=useState('');const request=useRef<AbortController|null>(null);
  useEffect(()=>{const controller=new AbortController();setCaps(null);setRows([]);setLoaded(false);setBusy(false);setError('');setProject('');setFeature('');setContext('');
    void (async()=>{try{const response=await fetch(`${base}/api/v1/features/policies/capabilities`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.code||String(response.status));if(!Array.isArray(body.projects)||typeof body.companyPolicyAdmin!=='boolean')throw new Error('INVALID_POLICY_CAPABILITIES');if(!controller.signal.aborted){setCaps(body);setScope(body.companyPolicyAdmin?'company':'project');}}catch(caught){if(!controller.signal.aborted)setError(String(caught instanceof Error?caught.message:caught));}})();return()=>{controller.abort();request.current?.abort();};
  },[token,retry]);
  const clear=()=>{request.current?.abort();setRows([]);setLoaded(false);setBusy(false);setError('');};
  async function audit(){if(busy||!caps||(scope==='company'?!caps.companyPolicyAdmin:!project))return;const controller=new AbortController();request.current=controller;setBusy(true);setError('');setRows([]);setLoaded(false);try{
    const query=new URLSearchParams();if(scope==='project')query.set('projectId',project);if(feature.trim())query.set('featureKey',feature.trim());
    const response=await fetch(`${base}/api/v1/features/policies/audit/${scope}?${query}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.code||body.error?.[lang]||String(response.status));if(!Array.isArray(body.versions)||body.versions.some((item:Event)=>item.scopeType!==scope||!Number.isSafeInteger(item.version)))throw new Error('INVALID_POLICY_AUDIT');if(!controller.signal.aborted){setRows(body.versions);setLoaded(true);setContext(scope==='company'?tt('Company','Empresa'):`${tt('Project','Proyecto')} ${project}`);}
  }catch(caught){if(!controller.signal.aborted)setError(String(caught instanceof Error?caught.message:caught));}finally{if(!controller.signal.aborted)setBusy(false);}}
  const projects=caps?.projects.filter(item=>item.active&&item.canConfigure)??[];
  return <main id="main-content" tabIndex={-1} style={{maxWidth:1150,margin:'auto',padding:'24px clamp(16px,4vw,40px)'}}>
    <Link href="/all-tools">{tt('All tools','Todas las herramientas')}</Link><h1>{tt('Feature Policies and Audit','Políticas de funciones y auditoría')}</h1>
    <p>{tt('Use the governed controls to save company/project defaults with a reviewed reason. Then load the version journal below to inspect saved decisions. Defaults do not activate a project or authorize execution.','Guarde valores predeterminados de empresa/proyecto con un motivo revisado. Luego consulte el historial de versiones para inspeccionar decisiones guardadas. Los valores no activan proyectos ni autorizan ejecución.')}</p>
    <FeaturePolicySettingsPanel key={token}/>
    <section style={{marginTop:24}}><h2>{tt('Saved policy version journal','Historial de versiones de política guardadas')}</h2><p>{tt('Only current company policy administrators or authorized project administrators can view this journal. Up to 200 versions are returned; filter by feature key to narrow the view. Reload after a save.','Solo administradores actuales de políticas de empresa o administradores autorizados de proyecto pueden consultar este historial. Se muestran hasta 200 versiones; filtre por clave de función. Recargue después de guardar.')}</p>
      {!caps&&!error&&<p role="status">{tt('Loading audit permissions…','Cargando permisos de auditoría…')}</p>}
      <form onSubmit={event=>{event.preventDefault();void audit();}} style={{display:'grid',gap:12,maxWidth:600}}>
        <label>{tt('Audit scope','Alcance de auditoría')} <select value={scope} onChange={event=>{clear();setScope(event.target.value as 'company'|'project');}}>{caps?.companyPolicyAdmin&&<option value="company">{tt('Company','Empresa')}</option>}<option value="project">{tt('Project','Proyecto')}</option></select></label>
        {scope==='project'&&<label>{tt('Authorized project','Proyecto autorizado')} <select value={project} onChange={event=>{clear();setProject(event.target.value);}}><option value="">{tt('Select project','Seleccionar proyecto')}</option>{projects.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label>{tt('Feature key (optional)','Clave de función (opcional)')} <input maxLength={120} value={feature} onChange={event=>{clear();setFeature(event.target.value);}}/></label>
        <button disabled={busy||!caps||(scope==='project'&&!project)}>{busy?tt('Loading journal…','Cargando historial…'):tt('Load saved versions','Cargar versiones guardadas')}</button>
      </form>
      {caps&&!caps.companyPolicyAdmin&&projects.length===0&&<p role="status">{tt('Your role cannot inspect administrative policy history. Current preferences remain available in the controls above.','Su rol no puede consultar el historial administrativo. Sus preferencias actuales siguen disponibles en los controles superiores.')}</p>}
      {error&&<p role="alert">{error} <button onClick={()=>caps?void audit():setRetry(value=>value+1)}>{tt('Retry','Reintentar')}</button></p>}
      {loaded&&<p role="status">{context} · {rows.length} {tt('saved versions','versiones guardadas')}</p>}
      {loaded&&rows.length===0&&<p>{tt('No saved versions match this authorized scope/filter. Defaults still apply.','No hay versiones guardadas para este alcance/filtro autorizado. Siguen vigentes los valores predeterminados.')}</p>}
      <ol>{rows.map(row=><li key={`${row.featureKey}:${row.version}`}><h3>{row.featureKey} · v{row.version} · {row.decision}</h3><p>{row.reasonCode} — {row.explanation[lang]}</p><p>{tt('Effective from / to','Vigente desde / hasta')}: {row.effectiveFrom} / {row.effectiveTo??'—'}</p><p>{tt('Recorded','Registrado')}: {row.createdAt} · {row.authority} · {row.evidence.source}</p></li>)}</ol>
    </section>
  </main>;
}
