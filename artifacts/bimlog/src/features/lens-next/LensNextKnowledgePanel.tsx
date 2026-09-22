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
      {context&&context!=="loading"&&context.conflictType&&<div className="lens-next-knowledge__conflict">
        <div className="lens-next-knowledge__eyebrow"><span>Conflict Type · {context.conflictType.code}</span><span className="lens-next-knowledge__approved">Approved · revision {context.conflictType.revision}</span></div>
        <h3>{context.conflictType.name}</h3>
        <p>{context.conflictType.disciplineA} / {context.conflictType.disciplineB} · {context.conflictType.elementTypeA} vs {context.conflictType.elementTypeB}</p>
        <p>{context.conflictType.category}</p><p>{context.conflictType.description}</p>
        <div className="lens-next-knowledge__links"><a href={`/knowledge?section=conflict-types&conflictTypeId=${encodeURIComponent(context.conflictType.id)}`}>View Full Conflict Type</a>{context.canClassify?<a href={`/knowledge?section=issue-classification&lensViewpointId=current`}>Change classification</a>:<span title="Your project role cannot classify issues.">Classification change unavailable</span>}</div>
      </div>}
      {context&&context!=="loading"&&context.conflictType&&<section className="lens-next-knowledge__section" aria-labelledby="knowledge-guidance-title"><h3 id="knowledge-guidance-title">Key Coordination Guidance</h3>{context.rules.length?<ul>{context.rules.map(rule=><li key={rule.revisionId}><div><strong>{rule.title}</strong><small>{rule.code} · approved revision {rule.revision}</small></div><p>{rule.guidance}</p></li>)}</ul>:<p className="lens-next-knowledge__empty-copy">No approved guidance is applicable to this classification. Continue issue work using project controls.</p>}</section>}
    </div>}
  </section>;
}
