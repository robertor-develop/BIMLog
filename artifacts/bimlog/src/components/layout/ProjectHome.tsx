import { ProjectNextAction } from "@/components/layout/ProjectNextAction";
import { ProjectJourneyProgress } from "@/components/layout/ProjectJourneyProgress";
import { projectJourneyAction } from "@/lib/project-journey";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { BarChart3, BriefcaseBusiness, CalendarDays, ClipboardList, FileCheck2, FolderOpen, RefreshCw, Users } from "lucide-react";
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
    { href: `/projects/${projectId}/intake`, available: true, icon: ClipboardList, title: lang === "es" ? "Configuración" : "Setup", detail: active ? (lang === "es" ? "Revise la configuración activada y sus fuentes." : "Review the activated setup and its source records.") : (lang === "es" ? "Defina cliente, contrato, alcance y entrega." : "Define the customer, contract, scope, and delivery.") },
    { href: `/projects/${projectId}/operations`, available: active, icon: BriefcaseBusiness, title: lang === "es" ? "Trabajo" : "Work", detail: active ? (lang === "es" ? "Asigne personas, avance, horas y entregables." : "Manage people, progress, hours, and deliverables.") : (lang === "es" ? "Inicie el proyecto desde Configuración para habilitar el trabajo." : "Start the project from Setup to make work available.") },
    { href: `/projects/${projectId}/command-center`, available: active, icon: FileCheck2, title: lang === "es" ? "Atención" : "Attention", detail: active ? (lang === "es" ? "Vea lo vencido, bloqueado o pendiente de respuesta." : "See overdue, blocked, or unanswered work.") : (lang === "es" ? "Las alertas aparecerán cuando comience el trabajo." : "Attention items appear after project work starts.") },
    { href: `/projects/${projectId}/analytics`, available: true, icon: BarChart3, title: lang === "es" ? "Resultados" : "Results", detail: lang === "es" ? "Revise indicadores, cumplimiento e informes." : "Review indicators, compliance, and reports." },
  ];
  const commonTasks = active ? [
    { href: `/projects/${projectId}/files`, icon: FolderOpen, en: "Open project files", es: "Abrir archivos del proyecto" },
    { href: `/projects/${projectId}/team`, icon: Users, en: "Review the project team", es: "Revisar el equipo del proyecto" },
    { href: `/projects/${projectId}/submittals`, icon: FileCheck2, en: "Open deliverables", es: "Abrir entregables" },
    { href: `/projects/${projectId}/schedule`, icon: CalendarDays, en: "Review the schedule", es: "Revisar el cronograma" },
  ] : [
    { href: `/projects/${projectId}/intake`, icon: ClipboardList, en: "Continue required setup", es: "Continuar configuración requerida" },
    { href: `/projects/${projectId}/directory`, icon: Users, en: "Review project companies", es: "Revisar empresas del proyecto" },
    { href: `/projects/${projectId}/files`, icon: FolderOpen, en: "Review source files", es: "Revisar archivos fuente" },
  ];

  return <main className="project-home-page">
    <header className="project-home-header"><div><span className="project-home-kicker">{lang === "es" ? "INICIO DEL PROYECTO" : "PROJECT HOME"}</span><h1>{projectName}</h1><p>{projectCode} · {lang === "es" ? "Un lugar para saber qué sigue y continuar el trabajo." : "One place to see what comes next and continue the work."}</p></div><span className={`project-home-state ${active ? "active" : "draft"}`}>{active ? (lang === "es" ? "Proyecto iniciado" : "Project started") : (lang === "es" ? "Configuración en curso" : "Setup in progress")}</span></header>
    {state === "loading" && <section className="project-home-loading" role="status">{lang === "es" ? "Cargando el estado del proyecto…" : "Loading project status…"}</section>}
    {state === "error" && <section className="project-home-error" role="alert"><div><strong>{lang === "es" ? "No se pudo cargar el siguiente paso." : "The next step could not be loaded."}</strong><p>{lang === "es" ? "No se modificó ningún dato. Vuelva a intentar." : "No project data was changed. Retry the status check."}</p></div><button type="button" onClick={() => setRetry(value => value + 1)}><RefreshCw aria-hidden="true" />{lang === "es" ? "Reintentar" : "Retry"}</button></section>}
    {state === "ready" && <ProjectNextAction action={action} />}
    {state === "ready" && <ProjectJourneyProgress status={intake?.status} />}
    <section className="project-home-workspaces" aria-labelledby="project-workspaces-title"><div className="project-home-section-heading"><h2 id="project-workspaces-title">{lang === "es" ? "Continuar por objetivo" : "Continue by goal"}</h2><p>{lang === "es" ? "Cada destino conserva el mismo proyecto." : "Every destination keeps the same project context."}</p></div><div className="project-home-grid">{cards.map(card => { const Icon = card.icon; const content = <><Icon aria-hidden="true" /><span><strong>{card.title}</strong><small>{card.detail}</small></span>{!card.available && <em>{lang === "es" ? "Aún no disponible" : "Not available yet"}</em>}</>; return card.available ? <Link key={card.href} className="project-home-card" href={card.href}>{content}</Link> : <div key={card.href} className="project-home-card unavailable" aria-disabled="true">{content}</div>; })}</div></section>
    <section className="project-home-common" aria-labelledby="project-common-title"><div className="project-home-section-heading"><h2 id="project-common-title">{lang === "es" ? "Tareas comunes" : "Common tasks"}</h2><p>{lang === "es" ? "Accesos directos para esta etapa." : "Shortcuts for the current stage."}</p></div><div className="project-home-task-list">{commonTasks.map(task => { const Icon = task.icon; return <Link key={task.href} href={task.href}><Icon aria-hidden="true" />{lang === "es" ? task.es : task.en}</Link>; })}</div></section>
  </main>;
}
