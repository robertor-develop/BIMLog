import React from 'react';
type Policy={id?:string;transaction_category:string;currency:string;max_amount:string;version:number;state?:string;scope_type?:string;project_id?:number|null;effective_from?:string;effective_to?:string|null;reason?:string;created_by_id?:number;created_at?:string};
export function FinancialApprovalPolicyRecords({policies,es}:{policies:Policy[];es:boolean}){
  return <section aria-label={es?'Versiones guardadas de límites de aprobación':'Saved approval limit versions'}><h3>{es?'Versiones guardadas':'Saved versions'}</h3><p>{es?'Se muestran los registros devueltos por el servidor (hasta 100). Los límites se comparan únicamente dentro de la misma moneda. Crear una versión no aprueba ninguna transacción.':'These are the server-returned records (up to 100). Limits compare only within the same currency. Creating a version does not approve any transaction.'}</p>
    {policies.length===0&&<p>{es?'Sin políticas de aprobación':'No approval policies'}</p>}
    {policies.map((policy,index)=><details key={policy.id??`${policy.transaction_category}:${policy.currency}:${policy.version}:${index}`}><summary>{policy.transaction_category} · {policy.max_amount} {policy.currency} · v{policy.version} · {policy.state??'—'}</summary>
      <dl><dt>{es?'Alcance':'Scope'}</dt><dd>{policy.scope_type??'—'}{policy.project_id?` · ${es?'Proyecto':'Project'} ${policy.project_id}`:''}</dd><dt>{es?'Vigente desde':'Effective from'}</dt><dd>{policy.effective_from??'—'}</dd><dt>{es?'Vigente hasta':'Effective to'}</dt><dd>{policy.effective_to??(es?'Sin fecha final registrada':'No end date recorded')}</dd><dt>{es?'Motivo registrado':'Recorded reason'}</dt><dd style={{whiteSpace:'pre-wrap'}}>{policy.reason||'—'}</dd><dt>{es?'Registrado por / fecha':'Recorded by / at'}</dt><dd>{policy.created_by_id??'—'} · {policy.created_at??'—'}</dd><dt>ID</dt><dd style={{overflowWrap:'anywhere'}}>{policy.id??'—'}</dd></dl>
    </details>)}
  </section>;
}
