import React from "react";
import type { LensNextKnowledgeContext, LensNextResolutionDraft, LensNextResolutionRecord } from "./lens-next-types";

const emptyDraft=(record:LensNextResolutionRecord|null):LensNextResolutionDraft=>({expectedRevision:record?.revision??0,status:"draft",methodRevisionId:record?.methodRevisionId??null,actualResolution:record?.actualResolution??null,disciplineChanged:record?.disciplineChanged??null,responsibleTrade:record?.responsibleTrade??null,rfiRequired:record?.rfiRequired??false,rfiReference:record?.rfiReference??null,drawingSubmittalReference:record?.drawingSubmittalReference??null});

export function LensNextResolutionPanel({record,knowledge,error,onRetry,onSave,activeIssueKey}:{record:LensNextResolutionRecord|"loading"|null;knowledge:LensNextKnowledgeContext|"loading"|null;error:string|null;onRetry():void;onSave(draft:LensNextResolutionDraft):Promise<void>;activeIssueKey:string}){
  const persisted=record==="loading"?null:record;
  const [draft,setDraft]=React.useState<LensNextResolutionDraft>(()=>emptyDraft(persisted));
  const [saving,setSaving]=React.useState<"idle"|"draft"|"completed">("idle"),[message,setMessage]=React.useState<string|null>(null);
  React.useEffect(()=>{setDraft(emptyDraft(persisted));setMessage(null);},[activeIssueKey,persisted?.revision]);
  const setText=(field:"actualResolution"|"disciplineChanged"|"responsibleTrade"|"rfiReference"|"drawingSubmittalReference",value:string)=>setDraft(current=>({...current,[field]:value.trimStart()||null}));
  const submit=async(status:"draft"|"completed")=>{setSaving(status);setMessage(null);try{await onSave({...draft,status});setMessage(status==="completed"?"Resolution completed and recorded in the immutable history.":"Draft saved.");}catch(reason){setMessage(reason instanceof Error?reason.message:"Resolution Record could not be saved");}finally{setSaving("idle");}};
  if(record==="loading")return <section className="lens-next-resolution" aria-label="Resolution Record"><p role="status">Loading Resolution Record…</p></section>;
  return <section className="lens-next-resolution" aria-label="Resolution Record">
    <header><div><strong>Resolution Record</strong><small>Record what was actually decided and completed for this issue.</small></div>{persisted&&<span className={`lens-next-resolution__status lens-next-resolution__status--${persisted.status}`}>{persisted.status} · revision {persisted.revision}</span>}</header>
    {error&&<div role="alert"><p>{error}</p><button type="button" onClick={onRetry}>Retry</button></div>}
    {persisted?.status==="verified"?<div className="lens-next-resolution__locked"><strong>Verified resolution</strong><p>This revision is locked. Reopen it with a recorded reason before changing the outcome.</p></div>:<form onSubmit={event=>{event.preventDefault();void submit("draft");}}>
      <label>Approved resolution method<select value={draft.methodRevisionId??""} onChange={event=>setDraft(current=>({...current,methodRevisionId:event.target.value||null}))}><option value="">No method selected</option>{knowledge&&knowledge!=="loading"&&knowledge.methods.map(method=><option key={method.revisionId} value={method.revisionId}>{method.code} · {method.name}</option>)}</select></label>
      <label className="lens-next-resolution__wide">Actual resolution<textarea required={false} rows={4} value={draft.actualResolution??""} onChange={event=>setText("actualResolution",event.target.value)} placeholder="Describe the resolution that was actually implemented."/></label>
      <label>Discipline changed<input value={draft.disciplineChanged??""} onChange={event=>setText("disciplineChanged",event.target.value)}/></label>
      <label>Responsible trade<input value={draft.responsibleTrade??""} onChange={event=>setText("responsibleTrade",event.target.value)}/></label>
      <label className="lens-next-resolution__check"><input type="checkbox" checked={draft.rfiRequired} onChange={event=>setDraft(current=>({...current,rfiRequired:event.target.checked,rfiReference:event.target.checked?current.rfiReference:null}))}/> Resolution required an RFI</label>
      <label>RFI reference<input disabled={!draft.rfiRequired} required={draft.rfiRequired} value={draft.rfiReference??""} onChange={event=>setText("rfiReference",event.target.value)}/></label>
      <label className="lens-next-resolution__wide">Drawing / submittal reference<input value={draft.drawingSubmittalReference??""} onChange={event=>setText("drawingSubmittalReference",event.target.value)}/></label>
      <div className="lens-next-resolution__actions"><button type="submit" disabled={saving!=="idle"}>{saving==="draft"?"Saving…":"Save draft"}</button><button type="button" className="lens-next__primary" disabled={saving!=="idle"||!draft.actualResolution?.trim()||(draft.rfiRequired&&!draft.rfiReference?.trim())} onClick={()=>void submit("completed")}>{saving==="completed"?"Completing…":"Complete resolution"}</button></div>
    </form>}
    {message&&<p role={message.includes("could not")?"alert":"status"}>{message}</p>}
    {persisted?.history.length?<details><summary>Immutable resolution history ({persisted.history.length})</summary><ol>{persisted.history.map(item=><li key={item.id}><strong>Revision {item.revision} · {item.status}</strong><span>{item.createdAt?new Date(item.createdAt).toLocaleString():"Date unavailable"}</span>{item.actualResolution&&<p>{item.actualResolution}</p>}</li>)}</ol></details>:null}
  </section>;
}
