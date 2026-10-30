import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
export function VerifyEmail(){
  const {tt}=useI18n();
  const [token]=useState(()=>new URLSearchParams(location.search).get("token")??"");
  const [status,setStatus]=useState<"loading"|"verified"|"invalid"|"expired"|"unavailable">("loading"),[retry,setRetry]=useState(0);
  useEffect(()=>{
    if(token.length<32){setStatus("invalid");return;}
    const controller=new AbortController();setStatus("loading");
    fetch("/api/v1/onboarding/email-verification/confirm",{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({token})}).then(async response=>{const body=await response.json();if(controller.signal.aborted)return;if(!response.ok){setStatus(response.status===409?"expired":response.status===400?"invalid":"unavailable");return;}if(body.verified!==true)throw new Error("Invalid verification response");setStatus("verified");window.history.replaceState(null,"",window.location.pathname);}).catch(()=>{if(!controller.signal.aborted)setStatus("unavailable");});
    return()=>controller.abort();
  },[token,retry]);
  return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4"><section className="w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm" style={{overflowWrap:"anywhere"}}>
    <h1 className="text-xl font-bold">{tt("BIMLog email verification","Verificación de correo BIMLog")}</h1>
    {status==="loading"&&<p role="status">{tt("Verifying the secure link…","Verificando el enlace seguro…")}</p>}
    {status==="verified"&&<div role="status"><h2>{tt("Email verified","Correo verificado")}</h2><p>{tt("Return to My Setup and reload the saved verification status.","Vuelva a Mi configuración y recargue el estado de verificación guardado.")}</p></div>}
    {status==="invalid"&&<p role="alert">{tt("This verification link is incomplete or invalid. Open the complete link from your verification message, or request another later from My Setup.","Este enlace de verificación está incompleto o no es válido. Abra el enlace completo del mensaje, o solicite otro después desde Mi configuración.")}</p>}
    {status==="expired"&&<p role="alert">{tt("This link has expired or was already used. Check the saved email status in My Setup before requesting a new link.","Este enlace venció o ya se usó. Compruebe el estado de correo guardado en Mi configuración antes de solicitar otro enlace.")}</p>}
    {status==="unavailable"&&<><p role="alert">{tt("Verification could not be confirmed. Check your saved setup status, or retry this link. No email password is required.","No se pudo confirmar la verificación. Compruebe el estado guardado o reintente este enlace. No se requiere contraseña de correo.")}</p><button onClick={()=>setRetry(value=>value+1)}>{tt("Retry verification","Reintentar verificación")}</button></>}
    <p><Link href="/my-setup">{tt("Return to My Setup","Volver a Mi configuración")}</Link></p><Link href="/dashboard">{tt("Continue to BIMLog","Continuar a BIMLog")}</Link>
  </section></main>;
}
