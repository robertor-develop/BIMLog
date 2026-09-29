import { validatedReturn } from "@/lib/return-context";
import { Link, useSearch } from "wouter";
import { useI18n } from "@/lib/i18n";

/** Shared location and stable destinations; destination pages retain authorization. */
export function ProjectLocation({ projectId, projectName, location }: { projectId: number; projectName: string; location: string }) {
  const { tt } = useI18n();
  const returnTo = validatedReturn(useSearch(), projectId);
  return <nav aria-label={tt("Project context", "Contexto del proyecto")} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", minWidth: 0 }}>
    <Link href="/dashboard">{tt("Headquarters", "Sede")}</Link><span aria-hidden="true">/</span>
    <Link href={`/projects/${projectId}`} style={{ overflowWrap: "anywhere" }}>{projectName}</Link><span aria-hidden="true">/</span>
    <strong aria-current="page">{location}</strong>
    <Link href={`/projects/${projectId}/analytics`}>{tt("Analytics", "Analítica")}</Link>
    {returnTo && <Link href={returnTo} title={tt("Save changes here before returning. Your Intake draft is preserved.", "Guarde los cambios antes de volver. Su borrador de Ingreso se conserva.")}>{tt("Return to Job Intake", "Volver al Ingreso del Trabajo")}</Link>}
  </nav>;
}
