import React from "react";
import type { LensNextKnowledgeContext } from "./lens-next-types";

export function LensNextKnowledgePanel({context,error,onRetry}:{context:LensNextKnowledgeContext|"loading"|null;error:string|null;onRetry():void}) {
  const [expanded,setExpanded]=React.useState(true);
  return <section className="lens-next-knowledge" aria-label="Coordination Knowledge">
    <header><div><strong>Coordination Knowledge</strong><small>Approved guidance and permitted precedent for this exact issue.</small></div><button type="button" onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>{expanded?"Collapse":"Expand"}</button></header>
    {expanded&&<div className="lens-next-knowledge__body">
      {context==="loading"&&<p role="status">Loading approved coordination knowledge…</p>}
      {error&&<div role="alert"><p>{error}</p><button type="button" onClick={onRetry}>Retry</button></div>}
      {context&&context!=="loading"&&!context.conflictType&&<div className="lens-next-knowledge__empty"><strong>No conflict type classified</strong><p>Issue work remains available. Classification is optional and no guidance will be invented.</p></div>}
      {context&&context!=="loading"&&context.conflictType&&<div className="lens-next-knowledge__conflict"><span>Conflict Type · Approved revision {context.conflictType.revision}</span><h3>{context.conflictType.name}</h3><p>{context.conflictType.disciplineA} / {context.conflictType.disciplineB} · {context.conflictType.category}</p><p>{context.conflictType.description}</p><a href={`/knowledge?section=conflict-types&conflictTypeId=${encodeURIComponent(context.conflictType.id)}`}>View Full Conflict Type</a></div>}
    </div>}
  </section>;
}
