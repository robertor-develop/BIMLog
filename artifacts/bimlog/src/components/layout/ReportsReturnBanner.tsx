import { Link, useSearch } from "wouter";
import { useI18n } from "@/lib/i18n";
import { parseReportEvidenceReturn } from "@/lib/report-evidence-return";

export function ReportsReturnBanner({ projectId }: { projectId: number }) {
  const { lang } = useI18n();
  const context = parseReportEvidenceReturn(useSearch(), projectId);
  if (!context) return null;
  return (
    <section role="status" aria-label={lang === "es" ? "Regreso a informes" : "Reports return"}
      style={{ marginBottom: 14, padding: "12px 14px", border: "1px solid #BFDBFE", borderRadius: 8, background: "#EFF6FF", color: "#1E3A8A" }}>
      <strong>{lang === "es" ? "Historial de evidencia" : "Evidence history"}</strong>{" "}
      <span>{lang === "es" ? "Revise este registro sin perder su lugar en Informes." : "Review this register without losing your place in Reports."}</span>{" "}
      <Link href={context.returnTo}>{lang === "es" ? "Volver a Informes" : "Return to Reports"}</Link>
    </section>
  );
}
