import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const API_BASE=(import.meta.env.VITE_API_URL as string|undefined)??"";
type PlatformStats={totalUsers:number;totalProjects:number;totalFiles:number;totalRfis:number;totalSubmittals:number;totalCompanies:number;activeProjects:number;filesLast24h:number;rfisLast7d:number;systemStatus:string};

export function AdminPlatformStats(){
 const {token}=useAuthStore();const {lang}=useI18n();const [,setLocation]=useLocation();const t=(en:string,es:string)=>lang==="es"?es:en;
 const [stats,setStats]=useState<PlatformStats|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{if(!token)return;setLoading(true);setError("");try{const response=await fetch(`${API_BASE}/api/v1/admin/platform-stats`,{headers:{Authorization:`Bearer ${token}`}}),body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(response.status===403?t("Verified Super Admin access is required.","Se requiere acceso verificado de Super Admin."):String(body.error||t("Platform statistics could not be loaded.","No se pudieron cargar las estadísticas de plataforma.")));setStats(body as PlatformStats);}catch(caught){setStats(null);setError(caught instanceof Error?caught.message:String(caught));}finally{setLoading(false);}},[token,lang]);
 useEffect(()=>{void load();},[load]);
 const cards=stats?[ ["Users","Usuarios",stats.totalUsers],["Companies","Empresas",stats.totalCompanies],["Active projects","Proyectos activos",stats.activeProjects],["Non-archived projects","Proyectos no archivados",stats.totalProjects],["Files","Archivos",stats.totalFiles],["RFIs","RFI",stats.totalRfis],["Submittals","Submittals",stats.totalSubmittals] ] as const:[];
 return <main id="main-content" tabIndex={-1} style={{maxWidth:1050,margin:"0 auto",padding:"28px clamp(16px,4vw,42px)"}}><Button variant="outline" onClick={()=>setLocation("/all-tools")}>{t("Back to All Tools","Volver a Todas las herramientas")}</Button><h1>{t("Platform Statistics","Estadísticas de plataforma")}</h1><p>{t("Review a read-only operational snapshot across the platform. Counts summarize governed records and do not replace the modules where authorized work is performed.","Revise una instantánea operativa de solo lectura de toda la plataforma. Los conteos resumen registros gobernados y no reemplazan los módulos donde se realiza el trabajo autorizado.")}</p>
 {loading&&<p role="status">{t("Loading platform evidence…","Cargando evidencia de plataforma…")}</p>}{error&&<div role="alert" style={{padding:12,border:"1px solid #fca5a5",borderRadius:8}}>{error} <Button size="sm" variant="outline" onClick={()=>void load()}>{t("Retry","Reintentar")}</Button></div>}
 {!loading&&!error&&stats&&<><p role="status"><strong>{t("System status","Estado del sistema")}:</strong> {stats.systemStatus}</p><section aria-label={t("Platform record counts","Conteos de registros de plataforma")} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>{cards.map(([en,es,value])=><article key={en} style={{border:"1px solid hsl(var(--border))",borderRadius:12,padding:16}}><h2 style={{fontSize:16,margin:0}}>{t(en,es)}</h2><p style={{fontSize:28,margin:"8px 0 0"}}>{value.toLocaleString()}</p></article>)}</section><p>{t("Next: open the applicable governed module from All Tools to inspect or act on individual records.","Siguiente: abra el módulo gobernado aplicable desde Todas las herramientas para inspeccionar o actuar sobre registros individuales.")}</p></>}
 </main>;
}
export default AdminPlatformStats;
