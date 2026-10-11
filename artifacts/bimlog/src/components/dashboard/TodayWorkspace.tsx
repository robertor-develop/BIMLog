import { useEffect } from "react";
import { ArrowRight, CheckCircle2, Compass } from "lucide-react";
import { recordAdoptionMilestone } from "@/lib/adoption-milestones";

type TodayAction = { title: string; detail: string; href: string; label: string };

export function TodayWorkspace({ lang, action, resume, onOpen }: { lang: string; action: TodayAction | null; resume?: TodayAction | null; onOpen: (href: string) => void }) {
  const es = lang === "es";
  useEffect(() => { recordAdoptionMilestone("today_viewed","headquarters"); }, []);
  const open=(href:string)=>{recordAdoptionMilestone("primary_action_opened","headquarters");onOpen(href);};
  return <section className="today-workspace" aria-labelledby="today-workspace-title">
    <div className="today-workspace__heading"><span><Compass aria-hidden size={18} /></span><div><p>{es ? "HOY" : "TODAY"}</p><h2 id="today-workspace-title">{es ? "Continúe con lo más importante" : "Continue with what matters most"}</h2></div></div>
    {action ? <div className="today-workspace__action"><div><strong>{action.title}</strong><p>{action.detail}</p></div><button type="button" onClick={() => open(action.href)}>{action.label}<ArrowRight aria-hidden size={16}/></button></div>
      : <div className="today-workspace__clear"><CheckCircle2 aria-hidden size={20}/><div><strong>{es ? "No hay trabajo urgente" : "No urgent work is waiting"}</strong><p>{es ? "Abra un proyecto para continuar el trabajo planificado." : "Open a project to continue planned work."}</p></div></div>}
    {resume && resume.href !== action?.href && <button className="today-workspace__resume" type="button" onClick={() => open(resume.href)}><span><small>{es ? "CONTINUAR DONDE LO DEJÓ" : "CONTINUE WHERE YOU LEFT OFF"}</small><strong>{resume.title}</strong><em>{resume.detail}</em></span><ArrowRight aria-hidden size={16}/></button>}
  </section>;
}
