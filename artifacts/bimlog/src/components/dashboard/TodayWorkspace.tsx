import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, Compass } from "lucide-react";
import { recordAdoptionMilestone } from "@/lib/adoption-milestones";
import type { DashboardGuidanceState } from "@/lib/dashboard-guidance-state";
import { ActionableEmptyState } from "@/components/layout/ActionableEmptyState";

type TodayAction = { title: string; detail: string; href: string; label: string };

export function TodayWorkspace({ lang, state, action, resume, onOpen, onRetry }: { lang: string; state: DashboardGuidanceState; action: TodayAction | null; resume?: TodayAction | null; onOpen: (href: string) => void; onRetry?: () => void }) {
  const es = lang === "es";
  const [showRecent, setShowRecent] = useState(false);
  useEffect(() => { recordAdoptionMilestone("today_viewed","headquarters"); }, []);
  const open=(href:string)=>{recordAdoptionMilestone("primary_action_opened","headquarters");onOpen(href);};
  return <section className="today-workspace" aria-labelledby="today-workspace-title">
    <div className="today-workspace__heading"><span><Compass aria-hidden size={18} /></span><div><p>{es ? "HOY" : "TODAY"}</p><h2 id="today-workspace-title">{es ? "Continúe con lo más importante" : "Continue with what matters most"}</h2></div></div>
    {state === "loading" && <div className="today-workspace__status" role="status"><strong>{es ? "Buscando su siguiente acción…" : "Finding your next action…"}</strong><p>{es ? "BIMLog está revisando solo los proyectos que puede abrir." : "BIMLog is checking only the projects you can open."}</p></div>}
    {state === "unavailable" && <div className="today-workspace__status today-workspace__status--error" role="alert"><div><strong>{es ? "La guía no está disponible ahora" : "Guidance is unavailable right now"}</strong><p>{es ? "Sus proyectos siguen disponibles. Intente cargar la guía nuevamente." : "Your projects remain available. Try loading the guidance again."}</p></div>{onRetry && <button type="button" onClick={onRetry}>{es ? "Intentar de nuevo" : "Try again"}</button>}</div>}
    {state === "ready" && action && <div className="today-workspace__action"><div><strong>{action.title}</strong><p>{action.detail}</p></div><button type="button" onClick={() => open(action.href)}>{action.label}<ArrowRight aria-hidden size={16}/></button></div>}
    {state === "empty" && <ActionableEmptyState icon={<CheckCircle2 aria-hidden size={20}/>} guidance={{ title: es ? "No hay trabajo urgente" : "No urgent work is waiting", reason: es ? "No hay acciones vencidas o bloqueadas asignadas a usted." : "No overdue or blocked actions are assigned to you.", actor: es ? "Puede abrir cualquier proyecto al que tenga acceso." : "You may open any project you can access.", actionLabel: es ? "Ver proyectos" : "View projects", destination: "/dashboard#projects" }} onAction={() => open("/dashboard#projects")} />}
    {state === "ready" && resume && resume.href !== action?.href && action && <button className="today-workspace__recent-disclosure" type="button" aria-expanded={showRecent} aria-controls="today-recent-work" onClick={() => setShowRecent(value => !value)}><span>{es ? "Continuar trabajo reciente" : "Continue recent work"}</span><ChevronDown aria-hidden className={showRecent ? "is-open" : ""}/></button>}
    {state === "ready" && resume && resume.href !== action?.href && (!action || showRecent) && <button id="today-recent-work" className="today-workspace__resume" type="button" onClick={() => open(resume.href)}><span><small>{es ? "CONTINUAR DONDE LO DEJÓ" : "CONTINUE WHERE YOU LEFT OFF"}</small><strong>{resume.title}</strong><em>{resume.detail}</em></span><ArrowRight aria-hidden size={16}/></button>}
  </section>;
}
