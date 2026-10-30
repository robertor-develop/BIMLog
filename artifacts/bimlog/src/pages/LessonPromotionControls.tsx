import React, { useEffect, useState } from "react";

type Target = "conflict_type" | "coordination_rule" | "resolution_method";
type Option = { id: string; name: string; kind: Target };
export function LessonPromotionControls({item,token,spanish,canPromote,canMerge,options,onChanged}:{
  item:{id:string;status:string;promoted_entity_id?:string|null;proposal:{lesson:string;organizationalApplicability:string}};
  token:string;spanish:boolean;canPromote:boolean;canMerge:boolean;options:Option[];onChanged():void;
}) {
  const t=(en:string,es:string)=>spanish?es:en;
  const [kind,setKind]=useState<Target>("coordination_rule"),[mode,setMode]=useState<"create"|"revise">("create");
  const [targetId,setTargetId]=useState(""),[code,setCode]=useState(""),[name,setName]=useState("");
  const [description,setDescription]=useState(item.proposal.lesson),[rationale,setRationale]=useState("");
  const [disciplineA,setDisciplineA]=useState(""),[disciplineB,setDisciplineB]=useState(""),[elementA,setElementA]=useState(""),[elementB,setElementB]=useState("");
  const [category,setCategory]=useState(""),[stage,setStage]=useState(""),[canonicalId,setCanonicalId]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  const [targets,setTargets]=useState<Option[]>([]),[loading,setLoading]=useState(false),[reload,setReload]=useState(0),[conflictId,setConflictId]=useState("");
  useEffect(()=>{
    if(mode!=="revise")return;
    const controller=new AbortController();setLoading(true);setTargets([]);setError("");
    const family=kind==="conflict_type"?"conflict-types":kind==="coordination_rule"?"rules":"resolution-methods";
    fetch(`${(import.meta.env.VITE_API_URL as string|undefined)??""}/api/v1/coordination-knowledge/${family}`,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal})
      .then(async response=>{const body=await response.json();if(!response.ok)throw new Error(body.code||String(response.status));return body;})
      .then(body=>{if(!controller.signal.aborted)setTargets((body.items??[]).map((record:Record<string,unknown>)=>({id:String(record.conflict_type_id||record.rule_id||record.resolution_method_id||record.id),name:String(record.name||record.title||record.code),kind})));})
      .catch(caught=>{if(!controller.signal.aborted)setError(String(caught));}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[kind,mode,token,reload]);
  async function send(action:"promote"|"merge") {
    setBusy(true);setError("");setSuccess("");
    try {
      const content=kind==="coordination_rule"?{title:name,guidance:description,rationale,applicability:{summary:item.proposal.organizationalApplicability}}
        :kind==="conflict_type"?{name,description,disciplineA,disciplineB,elementTypeA:elementA,elementTypeB:elementB,conflictCategory:category,coordinationStage:stage,tags:[]}
        :{name,description,applicability:{summary:item.proposal.organizationalApplicability},conflictTypeIds:[conflictId],ruleRevisionIds:[]};
      const body=action==="merge"?{expectedStatus:item.status,canonicalProposalId:canonicalId.trim(),rationale:rationale.trim()}
        :{targetEntityType:kind,mode,...(mode==="create"?{code:code.trim().toUpperCase()}:{targetId}),content:mode==="create"?content:{}};
      const response=await fetch(`${(import.meta.env.VITE_API_URL as string|undefined)??""}/api/v1/coordination-knowledge/lesson-proposals/${encodeURIComponent(item.id)}/${action}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(body)});
      const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`${payload.code||response.status}${payload.field?`: ${payload.field}`:""}`);
      setSuccess(action==="merge"?t("Proposal merged; source evidence is preserved.","Propuesta fusionada; se conserva la evidencia fuente."):t("Draft knowledge linked. Open its library section to edit and submit it for separate approval.","Borrador vinculado. Abra su sección de biblioteca para editarlo y enviarlo a aprobación separada."));onChanged();
    } catch(caught){setError(caught instanceof Error?caught.message:String(caught));}finally{setBusy(false);}
  }
  const canCreate=Boolean(code.trim()&&name.trim()&&description.trim()&&(kind!=="resolution_method"||conflictId)&&(kind!=="coordination_rule"||rationale.trim())&&(kind!=="conflict_type"||[disciplineA,disciplineB,elementA,elementB,category,stage].every(value=>value.trim())));
  return <section className="knowledge-card" aria-label={t("Lesson library actions","Acciones de biblioteca de la lección")}>
    <h3>{item.proposal.lesson}</h3>
    {canPromote&&item.status==="approved"&&!item.promoted_entity_id&&<form onSubmit={event=>{event.preventDefault();void send("promote");}}>
      <h4>{t("Promote approved lesson to draft knowledge","Promover lección aprobada a conocimiento borrador")}</h4>
      <p>{t("Create a new draft or create a new revision of existing knowledge. Promotion never approves or publishes the result.","Cree un borrador nuevo o una revisión de conocimiento existente. La promoción nunca aprueba ni publica el resultado.")}</p>
      <label>{t("Knowledge type","Tipo de conocimiento")}<select value={kind} disabled={busy} onChange={event=>{setKind(event.target.value as Target);setTargetId("");}}><option value="coordination_rule">{t("Coordination rule","Regla de coordinación")}</option><option value="conflict_type">{t("Conflict type","Tipo de conflicto")}</option><option value="resolution_method">{t("Resolution method","Método de resolución")}</option></select></label>
      <label>{t("Action","Acción")}<select value={mode} disabled={busy} onChange={event=>setMode(event.target.value as "create"|"revise")}><option value="create">{t("Create draft","Crear borrador")}</option><option value="revise">{t("Revise existing knowledge","Revisar conocimiento existente")}</option></select></label>
      {mode==="revise"?<label>{t("Existing knowledge","Conocimiento existente")}<select required value={targetId} disabled={busy||loading} onChange={event=>setTargetId(event.target.value)}><option value="">{loading?t("Loading…","Cargando…"):t("Select a record","Seleccione un registro")}</option>{targets.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select><small>{t("Creates a draft from the saved record; edit that draft in its library section.","Crea un borrador del registro guardado; edite ese borrador en su sección de biblioteca.")}</small>{!loading&&!targets.length&&<span role="status">{t("No eligible records loaded.","No se cargaron registros elegibles.")} <button type="button" onClick={()=>setReload(value=>value+1)}>{t("Retry","Reintentar")}</button></span>}</label>:<>
        <label>{t("Code","Código")}<input required maxLength={64} value={code} onChange={event=>setCode(event.target.value)}/></label>
        <label>{t("Name / title","Nombre / título")}<input required value={name} onChange={event=>setName(event.target.value)}/></label>
        <label>{t("Description / guidance","Descripción / guía")}<textarea required maxLength={8000} value={description} onChange={event=>setDescription(event.target.value)}/></label>
        {kind==="resolution_method"&&<label>{t("Related conflict type","Tipo de conflicto relacionado")}<select required value={conflictId} onChange={event=>setConflictId(event.target.value)}><option value="">{t("Select conflict type","Seleccione tipo de conflicto")}</option>{options.filter(option=>option.kind==="conflict_type").map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}
        {kind==="conflict_type"&&([ [t("Discipline A","Disciplina A"),disciplineA,setDisciplineA],[t("Discipline B","Disciplina B"),disciplineB,setDisciplineB],[t("Element A","Elemento A"),elementA,setElementA],[t("Element B","Elemento B"),elementB,setElementB],[t("Category","Categoría"),category,setCategory],[t("Stage","Etapa"),stage,setStage] ] as const).map(([label,value,setValue])=><label key={label}>{label}<input required value={value} onChange={event=>setValue(event.target.value)}/></label>)}
      </>}
      <button type="submit" disabled={busy||(mode==="create"?!canCreate:!targetId)}>{busy?t("Saving…","Guardando…"):t("Create linked draft","Crear borrador vinculado")}</button>
    </form>}
    {canMerge&&["under_review","approved"].includes(item.status)&&<div>
      <h4>{t("Merge duplicate proposal","Fusionar propuesta duplicada")}</h4>
      <p>{t("Enter the canonical proposal ID. It must belong to this company and remain active or approved; the source becomes merged with its evidence retained.","Ingrese el ID de la propuesta canónica. Debe pertenecer a esta empresa y seguir activa o aprobada; la fuente queda fusionada y conserva su evidencia.")}</p>
      <label>{t("Canonical proposal ID","ID de propuesta canónica")}<input value={canonicalId} maxLength={64} onChange={event=>setCanonicalId(event.target.value)}/></label>
      <button type="button" disabled={busy||!canonicalId.trim()||canonicalId.trim()===item.id||!rationale.trim()} onClick={()=>void send("merge")}>{t("Confirm merge","Confirmar fusión")}</button>
    </div>}
    <label>{t("Decision rationale","Justificación de la decisión")}<textarea value={rationale} maxLength={2000} onChange={event=>setRationale(event.target.value)}/></label>
    {error&&<p role="alert">{error} {t("Review the current status and retry.","Revise el estado vigente y reintente.")}</p>}{success&&<p role="status">{success}</p>}
  </section>;
}
