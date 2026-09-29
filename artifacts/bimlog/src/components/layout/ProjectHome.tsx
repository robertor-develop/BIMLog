import { projectHomeDestination } from "@/lib/project-home-destination";
import { useEffect, useState } from "react";
import { Link, Redirect } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
export function ProjectHome({ projectId, role }: { projectId: number; role: string }) {
  const { token } = useAuthStore(); const { tt } = useI18n();
  const [state, setState] = useState<"loading" | "draft" | "active" | "error">("loading");
  const [retry, setRetry] = useState(0);
  const manager = role === "project_admin";
  useEffect(() => {
    if (!manager) return;
    let current = true; setState("loading");
    fetch(`${import.meta.env.VITE_API_URL || ""}/api/v1/projects/${projectId}/intake`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => { if (!response.ok) throw new Error("unavailable"); return response.json(); })
      .then(intake => { if (current) { const target = projectHomeDestination(projectId, role, intake); setState(!target ? "error" : target.endsWith("operations") ? "active" : "draft"); } })
      .catch(() => { if (current) setState("error"); });
    return () => { current = false; };
  }, [manager, projectId, token, retry]);
  if (!manager) return <Redirect key={`${projectId}-${role}`} to={projectHomeDestination(projectId, role)!} />;
  if (state === "draft") return <Redirect key={`${projectId}-draft`} to={`/projects/${projectId}/intake`} />;
  if (state === "active") return <Redirect key={`${projectId}-active`} to={`/projects/${projectId}/operations`} />;
  return <section role={state === "error" ? "alert" : "status"}>
    <p>{state === "error" ? tt("Project setup status could not be loaded.", "No se pudo cargar el estado de configuración.") : tt("Opening your project workspace…", "Abriendo su espacio de trabajo…")}</p>
    {state === "error" && <button onClick={() => setRetry(value => value + 1)}>{tt("Retry", "Reintentar")}</button>}
    <Link href={`/projects/${projectId}/analytics`}>{tt("Open Analytics", "Abrir Analítica")}</Link>
  </section>;
}
