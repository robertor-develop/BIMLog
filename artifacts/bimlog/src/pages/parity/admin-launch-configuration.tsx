import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LaunchConfigurationPanel } from "@/components/admin/LaunchConfigurationPanel";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

export function LaunchConfiguration() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const t = (en: string, es: string) => lang === "es" ? es : en;
  return <main id="main-content" tabIndex={-1} style={{ maxWidth: 1180, margin: "0 auto", padding: "28px clamp(16px,4vw,42px)" }}>
    <Button variant="outline" onClick={() => setLocation("/all-tools")}>{t("Back to All Tools", "Volver a Todas las herramientas")}</Button>
    <header><h1>{t("Governed Launch Configuration", "Configuración gobernada de lanzamiento")}</h1><p>{t("Direct expert access to the complete launch workflow. Secrets remain masked, sensitive mutations require step-up authentication, every revision is immutable, and provider verification is required before production activation.", "Acceso experto directo al flujo completo de lanzamiento. Los secretos permanecen ocultos, las mutaciones sensibles requieren autenticación reforzada, cada revisión es inmutable y se exige verificación de proveedores antes de activar producción.")}</p></header>
    {token ? <LaunchConfigurationPanel token={token} /> : <p role="status">{t("Verifying authorization…", "Verificando autorización…")}</p>}
  </main>;
}
export default LaunchConfiguration;
