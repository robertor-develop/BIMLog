import { ArrowRight, CheckCircle2, Compass } from "lucide-react";

type TodayAction = { title: string; detail: string; href: string; label: string };

export function TodayWorkspace({ lang, action, onOpen }: { lang: string; action: TodayAction | null; onOpen: (href: string) => void }) {
  const es = lang === "es";
  return <section className="today-workspace" aria-labelledby="today-workspace-title">
    <div className="today-workspace__heading"><span><Compass aria-hidden size={18} /></span><div><p>{es ? "HOY" : "TODAY"}</p><h2 id="today-workspace-title">{es ? "Continúe con lo más importante" : "Continue with what matters most"}</h2></div></div>
    {action ? <div className="today-workspace__action"><div><strong>{action.title}</strong><p>{action.detail}</p></div><button type="button" onClick={() => onOpen(action.href)}>{action.label}<ArrowRight aria-hidden size={16}/></button></div>
      : <div className="today-workspace__clear"><CheckCircle2 aria-hidden size={20}/><div><strong>{es ? "No hay trabajo urgente" : "No urgent work is waiting"}</strong><p>{es ? "Abra un proyecto para continuar el trabajo planificado." : "Open a project to continue planned work."}</p></div></div>}
  </section>;
}
