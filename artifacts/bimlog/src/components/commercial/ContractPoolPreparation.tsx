import React,{useEffect,useState} from "react";

export function ContractPoolPreparation({path,fingerprint,api,tt}:{path:string;fingerprint:string;
  api:(path:string,init?:RequestInit)=>Promise<any>;tt:(en:string,es:string)=>string}){
  const [state,setState]=useState<{id:string|null;canPrepare:boolean;canPrepareItems?:boolean;projectId?:number;currency?:string;
    workItems?:Array<{id:string;name:string;workflowFingerprint:string;eligible:boolean;prepared:boolean;
      allocation?:{directProductionAmount:string;rows:Array<{phaseId:string;name:string;percent:string;amount:string}>}|null}>}|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let cancelled=false;setState(null);setError("");
    api(path).then(result=>{if(!cancelled)setState(result);}).catch(()=>{if(!cancelled)setError(tt("Contract funding could not be verified. Reopen this contract before continuing.","No se pudieron verificar los fondos. Vuelva a abrir este contrato antes de continuar."));});
    return()=>{cancelled=true;};
  },[path,fingerprint]);
  const prepare=async()=>{setBusy(true);setError("");try{
    await api(path,{method:"POST",body:JSON.stringify({confirmationFingerprint:fingerprint})});
    setState(await api(path));
  }catch{setError(tt("The funding request was not confirmed. Reopen this contract to check its approval, permissions and existing funds before retrying.","No se confirmó la preparación. Vuelva a abrir el contrato para revisar la aprobación, los permisos y los fondos existentes antes de reintentar."));}finally{setBusy(false);}};
  return <section aria-label={tt("Prepare approved contract pools","Preparar fondos contractuales aprobados")}>
    <p>{tt("Prepare the approved contract pools once. The incentive reserve then appears in Manual Bonuses for authorized proposals and independent review. This does not authorize payment.","Prepare una sola vez los fondos contractuales aprobados. La reserva de incentivos aparecerá en Bonos manuales para propuestas autorizadas y revisión independiente. Esto no autoriza pagos.")}</p>
    {error&&<p role="alert">{error}</p>}
    {!state&&!error&&<p role="status">{tt("Checking contract funds…","Verificando fondos del contrato…")}</p>}
    {state?.id?<p role="status">{tt("Contract pools prepared. Reopening or retrying does not create another reserve.","Fondos contractuales preparados. Reabrir o reintentar no crea otra reserva.")}</p>:
      state?.canPrepare?<button disabled={busy} onClick={()=>void prepare()}>{busy?tt("Preparing…","Preparando…"):tt("Prepare approved contract pools","Preparar fondos contractuales aprobados")}</button>:
      state&&<p>{tt("Your role can review these amounts but cannot prepare funding.","Su rol puede revisar estos montos, pero no preparar fondos.")}</p>}
    {!!state?.workItems?.length&&<section aria-label={tt("Work Item production plans","Planes de producción de entregables")}>
      <h4>{tt("Work Item production plans","Planes de producción de entregables")}</h4>
      <p>{tt("Each item uses its approved contract allocation and frozen workflow phases. Contract reserves are not repeated here.","Cada entregable usa su asignación contractual aprobada y las fases de su flujo congelado. Las reservas del contrato no se repiten aquí.")}</p>
      {state.workItems.map(item=><section key={item.id} aria-label={item.name}>
        <strong>{item.name}</strong>
        {item.allocation&&<><p>{item.allocation.directProductionAmount} {state.currency}</p>
          <ul>{item.allocation.rows?.map(row=><li key={row.phaseId}>{row.name}: {row.percent}% — {row.amount} {state.currency}</li>)}</ul></>}
        {item.prepared?<p>{tt("Immutable plan prepared","Plan inmutable preparado")}</p>:
          !item.eligible?<p>{tt("The activated workflow must match this contract's approved APU and phases. Review its template binding before preparing funds.","El flujo activado debe coincidir con el APU aprobado y sus fases. Revise la plantilla vinculada antes de preparar fondos.")}</p>:
          state.canPrepareItems?<button disabled={busy} onClick={async()=>{setBusy(true);setError("");try{
            await api(`/projects/${state.projectId}/edt-engine/economic-plans`,{method:"POST",body:JSON.stringify({workItemId:item.id,
              expectedContractFingerprint:fingerprint,expectedWorkflowFingerprint:item.workflowFingerprint})});
            setState(await api(path));
          }catch{setError(tt("The item plan was not confirmed. Reopen the contract to check its current approval, workflow and permissions.","No se confirmó el plan. Vuelva a abrir el contrato para revisar su aprobación, flujo y permisos actuales."));}finally{setBusy(false);}}}>
            {busy?tt("Preparing…","Preparando…"):tt("Prepare item production plan","Preparar plan de producción del entregable")}</button>:
          <p>{tt("Your role can review this allocation but cannot prepare the item plan.","Su rol puede revisar esta asignación, pero no preparar el plan del entregable.")}</p>}
      </section>)}
    </section>}
  </section>;
}
