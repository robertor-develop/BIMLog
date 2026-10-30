import {useEffect,useRef,useState} from "react";
import {Link} from "wouter";
import {useAuthStore} from "@/store/auth";
import {useI18n} from "@/lib/i18n";
type Status={provider:"procore";configured:boolean;approved:boolean;availability:string;credentialsExposed:false;connection:null|{provider:string;status:string;accountLabel:string|null;expiresAt:string|null;permissionState:string;selectedCompanyId:string|null;selectedProjectId:string|null;lastSuccessfulOperationAt:string|null}};
export function ProcoreConnectionStatus(){
 const {token}=useAuthStore(),{tt}=useI18n();
 const [project,setProject]=useState(()=>new URLSearchParams(location.search).get("projectId")??""),[data,setData]=useState<Status|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const epoch=useRef(0),lock=useRef(false),controller=useRef<AbortController|null>(null);
 const clear=()=>{epoch.current++;controller.current?.abort();lock.current=false;setBusy(false);setData(null);setError("");};
 useEffect(()=>{clear();return()=>{epoch.current++;controller.current?.abort();};},[token]);
 const load=async()=>{
  if(lock.current)return;setError("");setData(null);
  if(!token||!/^\d+$/.test(project)||!Number.isSafeInteger(Number(project))||Number(project)<=0){setError(tt("Enter an authorized project ID.","Ingrese un ID de proyecto autorizado."));return;}
  const current=++epoch.current;lock.current=true;setBusy(true);controller.current=new AbortController();
  try{
   const response=await fetch(`/api/v1/projects/${Number(project)}/connections/procore/status`,{headers:{Authorization:`Bearer ${token}`},signal:controller.current.signal});
   if(!response.ok)throw new Error([401,403].includes(response.status)?"denied":"unavailable");
   const saved=await response.json() as Status;
   if(current!==epoch.current)return;
   const connection=saved?.connection;
   if(response.headers.get("X-BIMLog-Project-Id")!==String(Number(project))||saved?.provider!=="procore"||typeof saved.configured!=="boolean"||typeof saved.approved!=="boolean"||typeof saved.availability!=="string"||saved.credentialsExposed!==false||connection===undefined||(connection!==null&&(connection.provider!=="procore"||typeof connection.status!=="string"||typeof connection.permissionState!=="string"||![connection.accountLabel,connection.expiresAt,connection.selectedCompanyId,connection.selectedProjectId,connection.lastSuccessfulOperationAt].every(value=>value===null||typeof value==="string"))))throw new Error("invalid");
   setData(saved);
  }catch(failure){if(current===epoch.current)setError(failure instanceof Error&&failure.message==="denied"?tt("Access denied. Restore your session or choose an authorized project.","Acceso denegado. Restaure su sesión o elija un proyecto autorizado."):tt("Saved connection status could not be verified. Retry this read; no provider operation was started.","No se pudo verificar el estado guardado. Reintente esta lectura; no se inició ninguna operación del proveedor."));}
  finally{if(current===epoch.current){lock.current=false;setBusy(false);}}
 };
 const c=data?.connection;
 return <main style={{maxWidth:900,margin:"24px auto",padding:18,overflowWrap:"anywhere"}}>
  <Link href="/all-tools">{tt("All Tools","Todas las herramientas")}</Link><h1 style={{fontSize:26,fontWeight:750,margin:"14px 0"}}>{tt("Procore Connection Status","Estado de conexión de Procore")}</h1>
  <p>{tt("Inspect your saved Procore connection in an authorized project. This read checks stored configuration and account state; it does not contact Procore, refresh credentials, test access, import files or prove a live connection. No password is required here.","Revise su conexión guardada de Procore en un proyecto autorizado. Esta lectura consulta configuración y estado guardados; no contacta Procore, renueva credenciales, prueba acceso, importa archivos ni demuestra conexión activa. Aquí no se requiere contraseña.")}</p>
  <form onSubmit={event=>{event.preventDefault();void load();}} style={{display:"flex",flexWrap:"wrap",gap:12,margin:"16px 0",alignItems:"end"}}><label>{tt("Project ID","ID de proyecto")}<input style={{display:"block",border:"1px solid #94A3B8",borderRadius:6,padding:8,width:150,background:"white"}} inputMode="numeric" value={project} onChange={event=>{clear();setProject(event.target.value);}}/></label><button className="btn btn-primary" disabled={busy} type="submit">{tt("Read saved status","Leer estado guardado")}</button></form>
  {busy&&<p role="status">{tt("Reading saved connection…","Leyendo conexión guardada…")}</p>}{error&&<p role="alert">{error}</p>}
  {data&&<section aria-live="polite"><h2>{tt("Stored configuration","Configuración guardada")} · #{Number(project)}</h2><p>{tt("Deployment configured","Despliegue configurado")}: {data.configured?tt("Yes","Sí"):tt("No — administrator configuration is required.","No — se requiere configuración del administrador.")}</p><p>{tt("Company approval","Aprobación de empresa")}: {data.approved?tt("Approved","Aprobada"):tt("Review required before provider actions.","Se requiere revisión antes de acciones del proveedor.")}</p><p>{tt("Availability","Disponibilidad")}: {data.availability}</p>
   {!c?<p role="status">{tt("No saved Procore account for your user. Connect through your profile when ready.","No hay cuenta Procore guardada para su usuario. Conéctela desde su perfil cuando esté listo.")}</p>:<><h3>{tt("Your saved account","Su cuenta guardada")}</h3><p>{c.accountLabel||tt("Account label unavailable","Etiqueta no disponible")} · {c.status}</p><p>{tt("Provider permission state","Estado de permisos del proveedor")}: {c.permissionState}</p><p>{tt("Selected Procore company / project","Empresa / proyecto Procore seleccionado")}: {c.selectedCompanyId||"—"} / {c.selectedProjectId||"—"}</p><p>{tt("Selected Procore IDs are external IDs, not BIMLog project IDs.","Los IDs seleccionados de Procore son externos, no IDs de proyecto BIMLog.")}</p><p>{tt("Token expiry recorded","Vencimiento registrado")}: {c.expiresAt||tt("Not recorded","No registrado")}</p><p>{tt("Last successful operation recorded","Última operación exitosa registrada")}: {c.lastSuccessfulOperationAt||tt("None recorded — live access is unverified.","Ninguna registrada — acceso activo sin verificar.")}</p></>}
   <Link href="/profile">{tt("Open profile connections","Abrir conexiones del perfil")}</Link><p>{tt("Use the normal provider sign-in when ready. Re-read this status after changing the account; this screen does not initiate sign-in.","Use el inicio normal del proveedor cuando esté listo. Vuelva a leer el estado después de cambiar la cuenta; esta pantalla no inicia sesión.")}</p>
  </section>}
 </main>;
}
