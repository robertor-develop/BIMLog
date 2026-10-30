import React, { useEffect, useRef, useState } from "react";

type Revision={id:string;revision:number;status:string;name:string;description:string;responsible_trade?:string;rfi_requirement?:string;constraints?:string[];advantages?:string[];disadvantages?:string[];required_approvals?:string[];conflict_type_ids?:string[];rule_revision_ids?:string[]};
export function ResolutionMethodHistory({entityId,token,spanish}:{entityId:string;token:string|null;spanish:boolean}) {
  const t=(en:string,es:string)=>spanish?es:en;
  const [rows,setRows]=useState<Revision[]|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const pending=useRef<AbortController|null>(null);
  useEffect(()=>{pending.current?.abort();setRows(null);setError("");setLoading(false);return()=>pending.current?.abort();},[entityId,token]);
  async function load(){pending.current?.abort();const controller=new AbortController();pending.current=controller;setLoading(true);setError("");try{
    const response=await fetch(`${(import.meta.env.VITE_API_URL as string|undefined)??""}/api/v1/coordination-knowledge/resolution-methods/${encodeURIComponent(entityId)}/history`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
    const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(String(body.code||response.status));if(!controller.signal.aborted)setRows(Array.isArray(body.items)?body.items:[]);
  }catch(caught){if(!controller.signal.aborted){setRows(null);setError(caught instanceof Error?caught.message:String(caught));}}finally{if(!controller.signal.aborted)setLoading(false);}}
  return <section aria-label={t("Method revision history","Historial de revisiones del método")}>
    <button type="button" disabled={loading} onClick={()=>void load()}>{loading?t("Loading revisions…","Cargando revisiones…"):t("View method revision history","Ver historial de revisiones del método")}</button>
    {error&&<p role="alert">{error} {t("Retry using the history button.","Reintente con el botón de historial.")}</p>}
    {rows?.length===0&&<p role="status">{t("No visible saved revisions.","No hay revisiones guardadas visibles.")}</p>}
    {rows&&<ol>{rows.map(row=><li key={row.id}><details>
      <summary>v{row.revision} · {row.status} · {row.name}</summary>
      <p>{row.description}</p>
      <dl>
        <dt>{t("Responsible trade","Oficio responsable")}</dt><dd>{row.responsible_trade||t("Not recorded","No registrado")}</dd>
        <dt>RFI</dt><dd>{row.rfi_requirement||t("Not recorded","No registrado")}</dd>
        {([['constraints','Constraints','Restricciones'],['advantages','Advantages','Ventajas'],['disadvantages','Disadvantages','Desventajas'],['required_approvals','Required approvals','Aprobaciones requeridas'],['conflict_type_ids','Conflict type references','Referencias de tipos de conflicto'],['rule_revision_ids','Rule revision references','Referencias de revisiones de reglas']] as const).map(([key,en,es])=><React.Fragment key={key}><dt>{t(en,es)}</dt><dd>{(row[key]??[]).join("; ")||t("None recorded","Ninguno registrado")}</dd></React.Fragment>)}
        <dt>{t("Revision ID","ID de revisión")}</dt><dd style={{overflowWrap:"anywhere"}}>{row.id}</dd>
      </dl>
    </details></li>)}</ol>}
  </section>;
}
