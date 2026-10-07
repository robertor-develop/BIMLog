import { Link, useSearch } from "wouter";
import { useI18n } from "@/lib/i18n";
import { safeOperationsReturnTarget } from "@/lib/job-operations-daily-work";

export function OperationsReturnBanner({ projectId }: { projectId: number }) {
  const { lang } = useI18n();
  const context = safeOperationsReturnTarget(new URLSearchParams(useSearch()).get("returnTo"), projectId);
  if (!context) return null;
  return <section role="status" style={{ margin: "12px 0", padding: 12, border: "1px solid #BFDBFE", borderRadius: 8, background: "#EFF6FF", color: "#1E3A8A" }}>
    <strong>{lang === "es" ? "Configuración para la tarea seleccionada" : "Setup for the selected task"}</strong>
    <p style={{ margin: "4px 0 8px" }}>{lang === "es" ? "Complete el origen requerido y vuelva a la tarea exacta de Operaciones." : "Complete the required source, then return to the exact Operations task."}</p>
    <Link href={context.returnTo}>{lang === "es" ? "Volver a la tarea seleccionada" : "Return to selected task"}</Link>
  </section>;
}
