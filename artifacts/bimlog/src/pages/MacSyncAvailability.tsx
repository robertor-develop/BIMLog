import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useI18n } from '@/lib/i18n';

const base=(import.meta.env.VITE_API_URL as string|undefined)??'';
type Availability={available:false;message:string;contact:string;whatsapp?:string};
export function MacSyncAvailability(){
  const {tt}=useI18n();const [result,setResult]=useState<Availability|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{const controller=new AbortController();setResult(null);setError('');void (async()=>{try{
    const response=await fetch(`${base}/api/v1/downloads/sync-agent-mac`,{signal:controller.signal,cache:'no-store'});const body=await response.json();
    if(!response.ok)throw new Error(body.error||String(response.status));
    if(body.available!==false||typeof body.message!=='string'||typeof body.contact!=='string'||!/^\S+@\S+\.\S+$/.test(body.contact))throw new Error('UNSUPPORTED_MAC_INSTALLER_RESPONSE');
    if(!controller.signal.aborted)setResult(body);
  }catch(caught){if(!controller.signal.aborted)setError(String(caught instanceof Error?caught.message:caught));}})();return()=>controller.abort();},[reload]);
  return <main id="main-content" tabIndex={-1} style={{maxWidth:900,margin:'auto',padding:'24px clamp(16px,4vw,40px)'}}>
    <Link href="/all-tools">{tt('All tools','Todas las herramientas')}</Link><h1>{tt('Mac Sync Agent Availability','Disponibilidad de Sync Agent para Mac')}</h1>
    <p>{tt('The Sync Agent runs as a separately installed desktop application. Check the server’s current Mac distribution status before planning a Mac installation. This page does not install software or enable synchronization.','Sync Agent se ejecuta como aplicación de escritorio instalada por separado. Consulte la disponibilidad actual para Mac antes de planificar su instalación. Esta página no instala software ni activa sincronización.')}</p>
    {!result&&!error&&<p role="status">{tt('Checking distribution status…','Consultando disponibilidad…')}</p>}
    {error&&<p role="alert">{tt('Could not verify Mac availability.','No se pudo verificar la disponibilidad para Mac.')} {error}</p>}
    {result&&<section role="status"><h2>{tt('Mac installer is not available','El instalador para Mac no está disponible')}</h2><p>{result.message}</p>
      <p>{tt('Contact support to discuss the supported setup for your project.','Contacte a soporte para consultar la configuración compatible con su proyecto.')} <a href={`mailto:${encodeURIComponent(result.contact)}`}>{result.contact}</a></p>
      {result.whatsapp&&/^https:\/\/wa\.me\/[0-9]+$/.test(result.whatsapp)&&<a href={result.whatsapp} target="_blank" rel="noopener noreferrer">{tt('Open support contact in WhatsApp','Abrir contacto de soporte en WhatsApp')}</a>}
    </section>}
    <p><button onClick={()=>setReload(value=>value+1)}>{tt('Check again','Consultar nuevamente')}</button></p>
  </main>;
}
