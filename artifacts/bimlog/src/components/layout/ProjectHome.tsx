import { ProjectNextAction } from "@/components/layout/ProjectNextAction";
import { ProjectJourneyProgress } from "@/components/layout/ProjectJourneyProgress";
import { projectJourneyAction } from "@/lib/project-journey";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { BarChart3, BriefcaseBusiness, ClipboardList, FileCheck2, RefreshCw } from "lucide-react";
import "./ProjectHome.css";

type IntakeSummary = { status?: string; intake?: unknown } | null;

export function ProjectHome({ projectId, projectName, projectCode }: { projectId: number; projectName: string; projectCode: string }) {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [intake, setIntake] = useState<IntakeSummary>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/projects/${projectId}/intake`, {
      headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error("PROJECT_HOME_STATUS_UNAVAILABLE");
      return response.json();
    }).then(summary => { setIntake(summary); setState("ready"); })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [projectId, retry, token]);

  const action = useMemo(() => projectJourneyAction(projectId, intake), [intake, projectId]);
  const active = intake?.status === "activated";
  const cards = [
    { href: `/projects/${projectId}/intake`, icon: ClipboardList, title: lang === "es" ? "Configuración" : "Setup", detail: active ? (lang === "es" ? "Revise la configuración activada y sus fuentes." : "Review the activated setup and its source records.") : (lang === "es" ? "Defina cliente, contrato, alcance y entrega." : "Define the customer, contract, scope, and delivery.") },
    { href: `/projects/${projectId}/operations`, icon: BriefcaseBusiness, title: lang === "es" ? "Trabajo" : "Work", detail: active ? (lang === "es" ? "Asigne personas, avance, horas y entregables." : "Manage people, progress, hours, and deliverables.") : (lang === "es" ? "Disponible después de iniciar el proyecto." : "Available after the project is started.") },
    { href: `/projects/${projectId}/command-center`, icon: FileCheck2, title: lang === "es" ? "Atención" : "Attention", detail: lang === "es" ? "Vea lo vencido, bloqueado o pendiente de respuesta." : "See overdue, blocked, or unanswered work." },
    { href: `/projects/${projectId}/analytics`, icon: BarChart3, title: lang === "es" ? "Resultados" : "Results", detail: lang === "es" ? "Revise indicadores, cumplimiento e informes." : "Review indicators, compliance, and reports." },
  ];

  return <main className="project-home-page">
    <header className="project-home-header"><div><span className="project-home-kicker">{lang === "es" ? "INICIO DEL PROYECTO" : "PROJECT HOME"}</span><h1>{projectName}</h1><p>{projectCode} · {lang === "es" ? "Un lugar para saber qué sigue y continuar el trabajo." : "One place to see what comes next and continue the work."}</p></div><span className={`project-home-state ${active ? "active" : "draft"}`}>{active ? (lang === "es" ? "Proyecto iniciado" : "Project started") : (lang === "es" ? "Configuración en curso" : "Setup in progress")}</span></header>
    {state === "loading" && <section className="project-home-loading" role="status">{lang === "es" ? "Cargando el estado del proyecto…" : "Loading project status…"}</section>}
    {state === "error" && <section className="project-home-error" role="alert"><div><strong>{lang === "es" ? "No se pudo cargar el siguiente paso." : "The next step could not be loaded."}</strong><p>{lang === "es" ? "No se modificó ningún dato. Vuelva a intentar." : "No project data was changed. Retry the status check."}</p></div><button type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw aria-hidden="true" />{lang === "es" ? "Reintentar" : "Retry"}</button></section>}
    {state === "ready" && <ProjectNextAction action={action} />}
    {state === "ready" && <ProjectJourneyProgress status={intake?.status} />}
    <section className="project-home-workspaces" aria-labelledby="project-workspaces-title"><div className="project-home-section-heading"><h2 id="project-workspaces-title">{lang === "es" ? "Continuar por objetivo" : "Continue by goal"}</h2><p>{lang === "es" ? "Cada destino conserva el mismo proyecto." : "Every destination keeps the same project context."}</p></div><div className="project-home-grid">{cards.map(card => { const Icon = card.icon; return <Link key={card.href} className="project-home-card" href={card.href}><Icon aria-hidden="true" /><span><strong>{card.title}</strong><small>{card.detail}</small></span></Link>; })}</div></section>
  </main>;
}
