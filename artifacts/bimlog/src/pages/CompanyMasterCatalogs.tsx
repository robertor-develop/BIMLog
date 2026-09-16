import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import { CompanyMasterCatalogsTab } from "@/components/admin/CompanyMasterCatalogsTab";

export function CompanyMasterCatalogs() {
  const { token } = useAuthStore();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const spanish = lang === "es";

  if (!token) return null;
  return <div style={{ display: "flex", minHeight: "100vh", minWidth: 0 }}>
    <MasterSidebar />
    <main style={{ flex: 1, minWidth: 0, padding: "clamp(16px, 3vw, 36px)", overflowX: "auto" }}>
      <button type="button" onClick={() => setLocation("/dashboard")} style={{ marginBottom: 18 }}>
        {spanish ? "Volver a la Sede" : "Back to Headquarters"}
      </button>
      <CompanyMasterCatalogsTab token={token} spanish={spanish} />
    </main>
  </div>;
}
