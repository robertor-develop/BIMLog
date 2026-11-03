import React, { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { ConflictTypeWorkspace, RuleMethodWorkspace, type KnowledgeRecord } from "./CoordinationKnowledgeAuthoring";

const base=(import.meta.env.VITE_API_URL as string|undefined)??"";
const fields=[['keyword','Keyword','Palabra clave'],['discipline','Discipline','Disciplina'],['element','Element','Elemento'],['category','Category','Categoría'],['conflictTypeId','Conflict type ID','ID de tipo de conflicto'],['methodId','Method ID','ID de método'],['projectId','Project ID','ID de proyecto'],['tags','Tags, comma separated','Etiquetas separadas por coma']] as const;
type Filters=Record<typeof fields[number][0],string>&{status:string};
type Result={entity_type:"conflict_type"|"coordination_rule"|"resolution_method";entity_id:string;revision_id:string;title:string;description:string;code:string;status:string};
const blank:Filters={keyword:"",discipline:"",element:"",category:"",conflictTypeId:"",methodId:"",projectId:"",tags:"",status:"approved"};
export function KnowledgeSearch(){
  const {token}=useAuthStore(),{tt}=useI18n();
  const [filters,setFilters]=useState<Filters>(blank),[applied,setApplied]=useState<Filters>(blank),[capabilities,setCapabilities]=useState<string[]|null>(null);
  const [rows,setRows]=useState<Result[]>([]),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(false),[loading,setLoading]=useState(false),[searched,setSearched]=useState(false),[error,setError]=useState("");
  const [detail,setDetail]=useState<{kind:Result['entity_type'];item:KnowledgeRecord}|null>(null),[opening,setOpening]=useState(false),[capRetry,setCapRetry]=useState(0);
  const searchRequest=useRef<AbortController|null>(null),detailRequest=useRef<AbortController|null>(null);
  useEffect(()=>{const controller=new AbortController();setCapabilities(null);setRows([]);setDetail(null);setSearched(false);setError("");setLoading(false);setOpening(false);setFilters({...blank});setApplied({...blank});setPage(1);setHasMore(false);
    fetch(`${base}/api/v1/coordination-knowledge/capabilities`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal}).then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.code||String(response.status));return body;}).then(body=>{if(!controller.signal.aborted)setCapabilities(body.capabilities??[]);}).catch(caught=>{if(!controller.signal.aborted)setError(String(caught));});
    return()=>{controller.abort();searchRequest.current?.abort();detailRequest.current?.abort();};
  },[token,capRetry]);
  async function search(values:Filters,nextPage:number){searchRequest.current?.abort();const controller=new AbortController();searchRequest.current=controller;setLoading(true);setError("");
    try{const query=new URLSearchParams({page:String(nextPage),pageSize:"25"});Object.entries(values).forEach(([key,value])=>{if(value.trim())query.set(key,value.trim());});
      const response=await fetch(`${base}/api/v1/coordination-knowledge/search?${query}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.code||String(response.status));
      if(!Array.isArray(body.items)||body.page!==nextPage||typeof body.hasMore!=="boolean")throw new Error(tt("Invalid search response","Respuesta de búsqueda inválida"));
      if(!controller.signal.aborted){setRows(body.items);setPage(nextPage);setHasMore(body.hasMore);setApplied({...values});setSearched(true);}
    }catch(caught){if(!controller.signal.aborted){setRows([]);setError(String(caught instanceof Error?caught.message:caught));}}finally{if(!controller.signal.aborted)setLoading(false);}
  }
  async function open(row:Result){detailRequest.current?.abort();const controller=new AbortController();detailRequest.current=controller;setOpening(true);setError("");try{
    const family=row.entity_type==="conflict_type"?"conflict-types":row.entity_type==="coordination_rule"?"rules":"resolution-methods";
    const response=await fetch(`${base}/api/v1/coordination-knowledge/${family}/${encodeURIComponent(row.entity_id)}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.code||String(response.status));
    const identity=body.item?.conflict_type_id||body.item?.rule_id||body.item?.resolution_method_id||body.item?.id;
    if(identity!==row.entity_id||!Number.isSafeInteger(body.item?.revision))throw new Error(tt("Selected record could not be verified","No se pudo verificar el registro seleccionado"));
    if(!controller.signal.aborted)setDetail({kind:row.entity_type,item:body.item});
  }catch(caught){if(!controller.signal.aborted)setError(String(caught));}finally{if(!controller.signal.aborted)setOpening(false);}}
  const changed=(item:KnowledgeRecord)=>{setDetail(current=>current?{...current,item}:null);void search(applied,page);};
  return <main id="main-content" tabIndex={-1} style={{maxWidth:1100,margin:"auto",padding:"24px clamp(16px,4vw,40px)"}}>
    <Link href="/knowledge">{tt("Open knowledge library","Abrir biblioteca de conocimiento")}</Link>
    <h1>{tt("Search Coordination Knowledge","Buscar conocimiento de coordinación")}</h1>
    <p>{tt("Search company conflict types, rules and resolution methods. Project filters use your authorized project context. Results remain limited by your current permissions.","Busque tipos de conflicto, reglas y métodos de resolución de la empresa. Los filtros de proyecto usan su contexto autorizado. Los resultados se limitan a sus permisos vigentes.")}</p>
    {capabilities===null&&!error&&<p role="status">{tt("Loading search permissions…","Cargando permisos de búsqueda…")}</p>}
    <form onSubmit={event=>{event.preventDefault();void search(filters,1);}} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
      {fields.map(([key,en,es])=><label key={key}>{tt(en,es)}<input style={{display:"block",width:"100%"}} type={key==="projectId"?"number":"text"} min={key==="projectId"?1:undefined} maxLength={key==="keyword"?240:key==="tags"?1000:120} value={filters[key]} onChange={event=>setFilters(current=>({...current,[key]:event.target.value}))}/></label>)}
      <label>{tt("Status","Estado")}<select value={filters.status} onChange={event=>setFilters(current=>({...current,status:event.target.value}))}><option value="approved">{tt("Approved","Aprobado")}</option>{capabilities?.includes("view_draft")&&<><option value="">{tt("All permitted states","Todos los estados permitidos")}</option><option value="draft">{tt("Draft","Borrador")}</option><option value="under_review">{tt("Under review","En revisión")}</option><option value="retired">{tt("Retired","Retirado")}</option></>}</select></label>
      <button type="submit" disabled={loading||capabilities===null}>{tt("Search","Buscar")}</button><button type="button" disabled={loading} onClick={()=>setFilters({...blank})}>{tt("Reset filters","Restablecer filtros")}</button>
    </form>
    {loading&&<p role="status">{tt("Searching…","Buscando…")}</p>}
    {error&&<p role="alert">{error} <button type="button" onClick={()=>capabilities===null?setCapRetry(value=>value+1):void search(filters,1)}>{tt("Retry","Reintentar")}</button></p>}
    {searched&&!loading&&!error&&rows.length===0&&<p role="status">{tt("No permitted records match these filters.","Ningún registro permitido coincide con estos filtros.")}</p>}
    <ul>{rows.map(row=><li key={`${row.entity_type}:${row.revision_id}`}><h2>{row.title}</h2><p>{row.code} · {row.entity_type} · {row.status}</p><p style={{whiteSpace:"pre-wrap"}}>{row.description}</p><button type="button" disabled={opening} onClick={()=>void open(row)}>{tt("Open record and actions","Abrir registro y acciones")}</button></li>)}</ul>
    {searched&&<nav aria-label={tt("Search pages","Páginas de búsqueda")}><button disabled={loading||page===1} onClick={()=>void search(applied,page-1)}>{tt("Previous","Anterior")}</button><span> {tt("Page","Página")} {page} </span><button disabled={loading||!hasMore} onClick={()=>void search(applied,page+1)}>{tt("Next","Siguiente")}</button></nav>}
    {detail?.kind==="conflict_type"&&<ConflictTypeWorkspace key={detail.item.id} item={detail.item} token={token} capabilities={capabilities??[]} lang={tt("en","es") as "en"|"es"} onClose={()=>setDetail(null)} onChanged={changed}/>}
    {detail&&detail.kind!=="conflict_type"&&<RuleMethodWorkspace key={detail.item.id} kind={detail.kind==="coordination_rule"?"rules":"resolution-methods"} item={detail.item} token={token} capabilities={capabilities??[]} lang={tt("en","es") as "en"|"es"} onClose={()=>setDetail(null)} onChanged={changed}/>}
  </main>;
}
export default KnowledgeSearch;
