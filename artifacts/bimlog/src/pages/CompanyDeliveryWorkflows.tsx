import { Link, useLocation, useSearch } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import { CompanyDeliveryWorkflowsTab } from "@/components/admin/CompanyDeliveryWorkflowsTab";
import { IntakeReturnBanner } from "@/components/layout/IntakeReturnBanner";
import { safeOperationsReturnTarget } from "@/lib/job-operations-daily-work";
import "./CompanyDeliveryWorkflows.css";

export function CompanyDeliveryWorkflows() {
  const { token } = useAuthStore();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const search = useSearch();
  const query = new URLSearchParams(search);
  const projectId = Number(query.get("projectId"));
  const operationReturn = safeOperationsReturnTarget(query.get("returnTo"), projectId);
  if (!token) return null;
  return (
    <div style={{ display: "flex", minHeight: "100vh", minWidth: 0 }}>
      <MasterSidebar />
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: "clamp(16px,3vw,36px)",
          overflowX: "auto",
        }}
      >
        <button type="button" onClick={() => setLocation("/dashboard")}>
          {lang === "es" ? "Volver a la Sede" : "Back to Headquarters"}
        </button>
        <IntakeReturnBanner />
        {operationReturn && (
          <section role="status" style={{ margin: "12px 0", padding: 12, border: "1px solid #BFDBFE", borderRadius: 8, background: "#EFF6FF", color: "#1E3A8A" }}>
            <strong>{lang === "es" ? "Flujo para la tarea seleccionada" : "Workflow for the selected task"}</strong>
            <p style={{ margin: "4px 0 8px" }}>{lang === "es" ? "Revise o publique el flujo requerido y vuelva a la tarea exacta de Operaciones." : "Review or publish the required workflow, then return to the exact Operations task."}</p>
            <Link href={operationReturn.returnTo}>{lang === "es" ? "Volver a la tarea seleccionada" : "Return to selected task"}</Link>
          </section>
        )}
        <CompanyDeliveryWorkflowsTab token={token} spanish={lang === "es"} />
      </main>
    </div>
  );
}
