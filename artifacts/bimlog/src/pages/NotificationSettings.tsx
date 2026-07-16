import { Link } from "wouter";
import { Bell, ChevronLeft } from "lucide-react";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import { NotificationPreferenceCenter } from "@/components/notifications/NotificationPreferenceCenter";
import { useI18n } from "@/lib/i18n";

export function NotificationSettings() {
  const { tt } = useI18n();
  return <div className="app-shell notification-settings-page">
    <style>{`@media (max-width:720px){.notification-settings-page>.sidebar{display:none}.notification-settings-page>.main-area{width:100%;max-width:100%;min-width:0;overflow-x:hidden}.notification-settings-page .topbar{padding-left:12px;padding-right:12px}.notification-settings-page .page-content{width:100%;max-width:100%!important;min-width:0;box-sizing:border-box;overflow-x:hidden}.notification-settings-page section{width:100%;max-width:100%;min-width:0;box-sizing:border-box}}`}</style>
    <MasterSidebar />
    <div className="main-area">
      <div className="topbar"><div className="breadcrumb">
        <Link href="/profile" style={{ display: "flex", gap: 4, alignItems: "center" }}><ChevronLeft style={{ width: 14 }} />{tt("Profile", "Perfil")}</Link>
        <span>/</span><span className="breadcrumb-active">{tt("Notification Center", "Centro de Notificaciones")}</span>
      </div></div>
      <main className="page-content" style={{ padding: "20px clamp(14px,3vw,32px) 60px", maxWidth: 1100, margin: "0 auto" }}>
        <header style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}><Bell style={{ color: "#1D4ED8", flexShrink: 0 }} /><div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{tt("Notification Center", "Centro de Notificaciones")}</h1>
          <p style={{ fontSize: 12, color: "#6B7280", margin: "3px 0 0", overflowWrap: "anywhere" }}>{tt("One canonical place for BIMLog product notification preferences.", "Un lugar canónico para las preferencias de notificaciones del producto BIMLog.")}</p>
        </div></header>
        <NotificationPreferenceCenter />
      </main>
    </div>
  </div>;
}
