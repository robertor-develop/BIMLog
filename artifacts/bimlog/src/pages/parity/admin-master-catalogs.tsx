import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MasterCatalogsTab } from "@/pages/AdminPanel";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

export function AdminMasterCatalogs() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  return <main id="main-content" tabIndex={-1} style={{ maxWidth: 1100, margin: "0 auto", padding: "28px clamp(16px,4vw,42px)" }}>
    <Button variant="outline" onClick={() => setLocation("/all-tools")}>{t("Back to All Tools", "Volver a Todas las herramientas")}</Button>
    <header><h1>{t("Platform Master Catalogs", "Catálogos maestros de plataforma")}</h1><p>{t("Direct Super Admin access to create and govern global service and phase values. State changes preserve historical project records and affect future Intake choices.", "Acceso directo de Super Admin para crear y gobernar valores globales de servicios y fases. Los cambios de estado conservan registros históricos de proyectos y afectan futuras opciones de Ingreso.")}</p></header>
    {token ? <MasterCatalogsTab token={token} /> : <p role="status">{t("Verifying authorization…", "Verificando autorización…")}</p>}
  </main>;
}
export default AdminMasterCatalogs;
