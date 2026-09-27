import React,{useEffect,useState} from "react";

export function ContractPoolPreparation({path,fingerprint,api,tt}:{path:string;fingerprint:string;
  api:(path:string,init?:RequestInit)=>Promise<any>;tt:(en:string,es:string)=>string}){
  const [state,setState]=useState<{id:string|null;canPrepare:boolean}|null>(null);
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
  </section>;
}
