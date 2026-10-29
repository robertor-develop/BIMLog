import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { OverviewTab } from "@/pages/AdminPanel";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

export function AdminOverview() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  return <main id="main-content" tabIndex={-1} style={{ maxWidth: 1180, margin: "0 auto", padding: "28px clamp(16px,4vw,42px)" }}>
    <Button variant="outline" onClick={() => setLocation("/all-tools")}>{t("Back to All Tools", "Volver a Todas las herramientas")}</Button>
    <header><h1>{t("Administration Overview", "Resumen de administración")}</h1><p>{t("Operational summary for your administered projects. Counts summarize governed records; recent activity links the evidence trail to the people, project, action, entity and time involved.", "Resumen operativo de sus proyectos administrados. Los conteos resumen registros gobernados; la actividad reciente vincula la evidencia con las personas, proyecto, acción, entidad y momento involucrados.")}</p></header>
    {token ? <OverviewTab token={token} /> : <p role="status">{t("Verifying authorization…", "Verificando autorización…")}</p>}
  </main>;
}
export default AdminOverview;
