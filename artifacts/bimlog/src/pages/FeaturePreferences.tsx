import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/lib/i18n';
const base=(import.meta.env.VITE_API_URL as string|undefined)??'';
type Choice='enabled'|'disabled'|'inherit';
type Preference={featureKey:string;name:{en:string;es:string};description:{en:string;es:string};availability:string;decision:Choice;effectiveDecision:string;effectiveSource:string;version:number;defaultBehavior:string;optOutGuidance:{en:string;es:string};confirmationRequirements:string[]};
export function FeaturePreferences(){
  const {token}=useAuthStore(),{lang,tt}=useI18n();const [items,setItems]=useState<Preference[]>([]),[draft,setDraft]=useState<Record<string,Choice>>({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);const write=useRef<AbortController|null>(null);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setItems([]);setDraft({});setBusy(null);
    void (async()=>{try{const response=await fetch(`${base}/api/v1/features/preferences`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});const body=await response.json();if(!response.ok)throw new Error(body.code||String(response.status));if(!Array.isArray(body.preferences)||body.preferences.some((item:Preference)=>!Number.isSafeInteger(item.version)||!['enabled','disabled','inherit'].includes(item.decision)))throw new Error('INVALID_PREFERENCES_RESPONSE');if(!controller.signal.aborted)setItems(body.preferences);}catch(caught){if(!controller.signal.aborted)setError(String(caught instanceof Error?caught.message:caught));}finally{if(!controller.signal.aborted)setLoading(false);}})();return()=>{controller.abort();write.current?.abort();};
  },[token,reload]);
  useEffect(()=>{setNotice('');},[token]);
  async function save(item:Preference){if(busy||loading||draft[item.featureKey]===undefined)return;const controller=new AbortController();write.current=controller;setBusy(item.featureKey);setError('');setNotice('');try{
    const response=await fetch(`${base}/api/v1/features/preferences/${encodeURIComponent(item.featureKey)}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({decision:draft[item.featureKey],expectedVersion:item.version}),signal:controller.signal});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.code||String(response.status));
    if(body.featureKey!==item.featureKey||body.scopeType!=='user'||body.version!==item.version+1||body.decision!==draft[item.featureKey])throw new Error('INVALID_PREFERENCE_RECEIPT');
    if(!controller.signal.aborted){setNotice(tt('Preference saved. Reloading the server’s saved choice and effective result. Saving did not run a feature.','Preferencia guardada. Recargando la elección guardada y el resultado efectivo del servidor. Guardar no ejecutó ninguna función.'));setReload(value=>value+1);}
  }catch(caught){if(!controller.signal.aborted)setError(`${String(caught instanceof Error?caught.message:caught)} — ${tt('Reload saved preferences before retrying a version conflict.','Recargue las preferencias guardadas antes de reintentar un conflicto de versión.')}`);}finally{if(!controller.signal.aborted)setBusy(null);}}
  const choices:Record<Choice,string>={enabled:tt('On','Activado'),disabled:tt('Off','Desactivado'),inherit:tt('Use default / inherit','Usar predeterminado / heredar')};
  return <main id="main-content" tabIndex={-1} style={{maxWidth:1100,margin:'auto',padding:'24px clamp(16px,4vw,40px)'}}>
    <Link href="/all-tools">{tt('All tools','Todas las herramientas')}</Link><h1>{tt('My Feature Preferences','Mis preferencias de funciones')}</h1>
    <p>{tt('Choose your optional feature preferences. On cannot override platform, company, project, role or commercial restrictions. A saved choice does not execute a capability, confirm AI actions or authorize external delivery.','Elija sus preferencias de funciones opcionales. Activado no anula restricciones de plataforma, empresa, proyecto, rol o comerciales. Guardar no ejecuta capacidades, confirma acciones de IA ni autoriza entregas externas.')}</p>
    <p><Link href="/feature-access">{tt('Inspect full effective access','Consultar acceso efectivo completo')}</Link></p>
    <button disabled={loading||busy!==null} onClick={()=>setReload(value=>value+1)}>{tt('Reload saved preferences','Recargar preferencias guardadas')}</button>
    {loading&&<p role="status">{tt('Loading saved preferences…','Cargando preferencias guardadas…')}</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {!loading&&!error&&items.length===0&&<p>{tt('No optional personal preferences are available.','No hay preferencias personales opcionales disponibles.')}</p>}
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(320px,100%),1fr))',gap:20}}>{items.map(item=><article key={item.featureKey} style={{minWidth:0,overflowWrap:'anywhere'}}><h2>{item.name[lang]}</h2><p>{item.description[lang]}</p><p>{item.featureKey} · {item.availability} · v{item.version}</p>
      <p>{tt('Saved choice','Elección guardada')}: {choices[item.decision]}</p><p>{tt('Effective preference / source','Preferencia efectiva / fuente')}: {item.effectiveDecision} / {item.effectiveSource}</p><p>{tt('Default behavior','Comportamiento predeterminado')}: {item.defaultBehavior}</p><p>{item.optOutGuidance[lang]}</p>
      {item.confirmationRequirements.length>0&&<p>{tt('Separate confirmations required','Confirmaciones separadas requeridas')}: {item.confirmationRequirements.join(', ')}</p>}
      <form onSubmit={event=>{event.preventDefault();void save(item);}}><label>{tt('New preference','Nueva preferencia')} <select value={draft[item.featureKey]??item.decision} disabled={busy!==null||loading} onChange={event=>setDraft(current=>({...current,[item.featureKey]:event.target.value as Choice}))}>{(['inherit','enabled','disabled'] as const).map(value=><option key={value} value={value}>{choices[value]}</option>)}</select></label><button disabled={busy!==null||loading||draft[item.featureKey]===undefined||draft[item.featureKey]===item.decision}>{busy===item.featureKey?tt('Saving…','Guardando…'):tt('Save preference','Guardar preferencia')}</button></form>
    </article>)}</div>
  </main>;
}
