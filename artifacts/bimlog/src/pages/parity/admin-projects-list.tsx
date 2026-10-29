import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE=(import.meta.env.VITE_API_URL as string|undefined)??"";
type Project={id:number;code:string;name:string};
export function AdminProjectsList(){
 const {token,user}=useAuthStore();const {lang}=useI18n();const [,setLocation]=useLocation();const t=(en:string,es:string)=>lang==="es"?es:en;
 const [items,setItems]=useState<Project[]>([]),[scope,setScope]=useState(user?.isSuperAdmin?"all":"mine"),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{if(!token)return;setLoading(true);setError("");try{const response=await fetch(`${API_BASE}/api/v1/admin/projects-list?scope=${scope}`,{headers:{Authorization:`Bearer ${token}`}}),body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(response.status===403?t("Project administration access is required.","Se requiere acceso de administración de proyectos."):String(body.error||t("Projects could not be loaded.","No se pudieron cargar los proyectos.")));setItems(Array.isArray(body)?body:[]);}catch(caught){setItems([]);setError(caught instanceof Error?caught.message:String(caught));}finally{setLoading(false);}},[token,scope,lang]);
 useEffect(()=>{void load();},[load]);
 return <main id="main-content" tabIndex={-1} style={{maxWidth:1000,margin:"0 auto",padding:"28px clamp(16px,4vw,42px)"}}><Button variant="outline" onClick={()=>setLocation("/all-tools")}>{t("Back to All Tools","Volver a Todas las herramientas")}</Button><h1>{t("Governed Project Directory","Directorio gobernado de proyectos")}</h1><p>{t("Find the projects you may administer and open the working project. Archived projects are excluded; this directory does not replace project administration.","Encuentre los proyectos que puede administrar y abra el proyecto de trabajo. Se excluyen los proyectos archivados; este directorio no reemplaza la administración de proyectos.")}</p>
 {user?.isSuperAdmin&&<label>{t("Directory scope","Alcance del directorio")}<select value={scope} onChange={event=>setScope(event.target.value)} style={{display:"block",padding:9,marginTop:4}}><option value="all">{t("All active platform projects","Todos los proyectos activos de plataforma")}</option><option value="mine">{t("Projects I administer","Proyectos que administro")}</option></select></label>}
 {loading&&<p role="status">{t("Loading governed projects…","Cargando proyectos gobernados…")}</p>}{error&&<div role="alert">{error} <Button size="sm" variant="outline" onClick={()=>void load()}>{t("Retry","Reintentar")}</Button></div>}{!loading&&!error&&items.length===0&&<p role="status">{t("No non-archived projects are available in this administration scope.","No hay proyectos no archivados disponibles en este alcance de administración.")}</p>}
 {items.length>0&&<section aria-labelledby="project-directory"><h2 id="project-directory">{t("Available projects","Proyectos disponibles")}</h2><ul style={{display:"grid",gap:10,padding:0,listStyle:"none"}}>{items.map(project=><li key={project.id} style={{border:"1px solid hsl(var(--border))",borderRadius:10,padding:14,display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><span><strong>{project.code}</strong> · {project.name}</span><Button onClick={()=>setLocation(`/projects/${project.id}`)}>{t("Open project","Abrir proyecto")}</Button></li>)}</ul></section>}
 </main>;
}
export default AdminProjectsList;
