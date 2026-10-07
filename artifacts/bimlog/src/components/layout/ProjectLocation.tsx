import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";

/** One project breadcrumb for every project surface. */
export function ProjectLocation({ projectId, projectName, location }: { projectId: number; projectName: string; location: string }) {
  const { tt } = useI18n();
  return <nav aria-label={tt("Project context", "Contexto del proyecto")} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
    <Link href="/dashboard">{tt("Headquarters", "Sede")}</Link><span aria-hidden="true">/</span>
    <Link href={`/projects/${projectId}`} style={{ overflowWrap: "anywhere" }} title={tt("Open Project Home", "Abrir Inicio del Proyecto")}>{projectName}</Link><span aria-hidden="true">/</span>
    <strong aria-current="page">{location}</strong>
  </nav>;
}
