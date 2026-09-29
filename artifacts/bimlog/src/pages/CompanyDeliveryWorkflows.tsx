import { intakePrerequisiteReturn } from "@/lib/return-context";
import { useLocation, useSearch } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import { CompanyDeliveryWorkflowsTab } from "@/components/admin/CompanyDeliveryWorkflowsTab";
import "./CompanyDeliveryWorkflows.css";

export function CompanyDeliveryWorkflows() {
  const { token } = useAuthStore();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const intakeReturn = intakePrerequisiteReturn(useSearch());
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
        {intakeReturn && <button type="button" onClick={() => setLocation(intakeReturn)}>{lang === "es" ? "Volver a la entrega del ingreso" : "Return to Intake delivery"}</button>}
        <CompanyDeliveryWorkflowsTab token={token} spanish={lang === "es"} />
      </main>
    </div>
  );
}
