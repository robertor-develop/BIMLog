import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/lib/i18n';
const base=(import.meta.env.VITE_API_URL as string|undefined)??'';
type Feature={featureKey:string;name:{en:string;es:string}};
type Decision={featureKey:string;decision:string;state:string;code:string;explanation:{en:string;es:string};sources:{authority:string;id:string;version:number}[];evaluatedAt?:string;evaluation:{mode:string;authorizesExecution:false};policy?:{inheritancePath:string[];configuration:Record<string,unknown>};allowance?:{unit:string;remaining:string;requested:string};confirmations?:string[]};
export function FeatureAccessInspector(){
  const {token}=useAuthStore(),{lang,tt}=useI18n();
  const [features,setFeatures]=useState<Feature[]>([]),[feature,setFeature]=useState(''),[project,setProject]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [result,setResult]=useState<{entitlement:Decision;policy:Decision;project:string}|null>(null);const request=useRef<AbortController|null>(null);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setFeatures([]);setFeature('');setProject('');setResult(null);setBusy(false);
    void (async()=>{try{const response=await fetch(`${base}/api/v1/features/catalog`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.code||String(response.status));if(!Array.isArray(body.features))throw new Error('INVALID_FEATURE_CATALOG');if(!controller.signal.aborted){setFeatures(body.features);setFeature(body.features[0]?.featureKey??'');}}catch(caught){if(!controller.signal.aborted)setError(String(caught instanceof Error?caught.message:caught));}finally{if(!controller.signal.aborted)setLoading(false);}})();
    return()=>{controller.abort();request.current?.abort();};
  },[token,retry]);
  function clearResult(){request.current?.abort();setBusy(false);setResult(null);setError('');}
  async function inspect(){if(!feature||busy)return;const controller=new AbortController();request.current=controller;setBusy(true);setError('');setResult(null);try{
    const query=project?`?${new URLSearchParams({projectId:project})}`:'';
    const get=async(path:string):Promise<Decision>=>{const response=await fetch(`${base}/api/v1/features/${encodeURIComponent(feature)}/${path}${query}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.code||body.error?.[lang]||String(response.status));if(body.featureKey!==feature||body.evaluation?.authorizesExecution!==false||!Array.isArray(body.sources)||!body.explanation)throw new Error('INVALID_ACCESS_DECISION');return body;};
    const [entitlement,policy]=await Promise.all([get('entitlement'),get('policy-resolution')]);if(!controller.signal.aborted)setResult({entitlement,policy,project});
  }catch(caught){if(!controller.signal.aborted)setError(String(caught instanceof Error?caught.message:caught));}finally{if(!controller.signal.aborted)setBusy(false);}}
  const renderDecision=(decision:Decision,title:string)=><section><h2>{title}</h2><p>{decision.featureKey} · {decision.decision} · {decision.state} · {decision.code}</p><p>{decision.explanation[lang]}</p>
    {decision.evaluatedAt&&<p>{tt('Evaluated at','Evaluado el')}: {decision.evaluatedAt}</p>}
    <h3>{tt('Authority and source versions','Autoridad y versiones de origen')}</h3><ul>{decision.sources.map((source,index)=><li key={`${source.authority}:${source.id}:${index}`}>{source.authority} · {source.id} · v{source.version}</li>)}</ul>
    {decision.policy&&<><h3>{tt('Policy inheritance','Herencia de política')}</h3><ol>{decision.policy.inheritancePath.map((value,index)=><li key={index}>{value}</li>)}</ol><dl>{Object.entries(decision.policy.configuration).map(([key,value])=><React.Fragment key={key}><dt>{key}</dt><dd style={{overflowWrap:'anywhere'}}>{typeof value==='object'?JSON.stringify(value):String(value)}</dd></React.Fragment>)}</dl></>}
    {decision.allowance&&<p>{tt('Allowance remaining / requested','Cuota restante / solicitada')}: {decision.allowance.remaining} / {decision.allowance.requested} {decision.allowance.unit}</p>}
    {decision.confirmations&&<p>{tt('Confirmations required','Confirmaciones requeridas')}: {decision.confirmations.join(', ')}</p>}
  </section>;
  return <main id="main-content" tabIndex={-1} style={{maxWidth:1000,margin:'auto',padding:'24px clamp(16px,4vw,40px)'}}>
    <Link href="/all-tools">{tt('All tools','Todas las herramientas')}</Link><h1>{tt('Feature Access Inspector','Inspector de acceso a funciones')}</h1>
    <p>{tt('Understand your effective entitlement and policy for a feature, optionally within an authorized project. These read-only decisions explain access; they do not run a feature, grant permissions or spend credits. Change governed policies through Settings.','Consulte su habilitación y política efectiva de una función, opcionalmente en un proyecto autorizado. Estas decisiones de consulta explican el acceso; no ejecutan funciones, conceden permisos ni consumen créditos. Cambie las políticas gobernadas en Configuración.')}</p>
    <form onSubmit={event=>{event.preventDefault();void inspect();}} style={{display:'grid',gap:12,maxWidth:600}}>
      <label>{tt('Feature','Función')} <select value={feature} disabled={loading} onChange={event=>{clearResult();setFeature(event.target.value);}}>{features.map(item=><option key={item.featureKey} value={item.featureKey}>{item.name?.[lang]||item.featureKey} · {item.featureKey}</option>)}</select></label>
      <label>{tt('Project ID (optional)','ID de proyecto (opcional)')} <input type="number" min={1} step={1} value={project} onChange={event=>{clearResult();setProject(event.target.value);}}/></label>
      <button disabled={loading||busy||!feature}>{busy?tt('Inspecting…','Consultando…'):tt('Inspect effective access','Consultar acceso efectivo')}</button>
    </form>
    {loading&&<p role="status">{tt('Loading available feature keys…','Cargando claves de funciones…')}</p>}
    {error&&<p role="alert">{error} <button onClick={()=>loading?undefined:features.length?void inspect():setRetry(value=>value+1)}>{tt('Retry','Reintentar')}</button></p>}
    {!loading&&!error&&features.length===0&&<p>{tt('No catalog features available.','No hay funciones de catálogo disponibles.')}</p>}
    {result&&<div role="status"><p>{tt('Read-only inspection complete. Project','Consulta completada. Proyecto')}: {result.project||tt('no project context','sin contexto de proyecto')}</p>{renderDecision(result.entitlement,tt('Effective entitlement','Habilitación efectiva'))}{renderDecision(result.policy,tt('Policy resolution','Resolución de política'))}<Link href="/settings">{tt('Open Settings to review governed policies','Abrir Configuración para revisar políticas gobernadas')}</Link></div>}
  </main>;
}
