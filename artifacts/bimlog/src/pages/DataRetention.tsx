import { Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { useI18n } from "@/lib/i18n";
import { TRUST_FACTS } from "@/lib/trust-copy";

export function DataRetention() {
  const { language, t } = useI18n(); const lang = language === "es" ? "es" : "en";
  const sections = lang === "es" ? [
    ["1. Alcance", "Esta política explica la retención de datos de BIMLog. BIMLog es operado por BIMCapital Partners INC mediante su división tecnológica IgniteSmart."],
    ["2. Archivos y almacenamiento", TRUST_FACTS.files.es],
    ["3. Plazos aplicables", TRUST_FACTS.retention.es],
    ["4. Datos de cuenta y proyecto", "Los perfiles, membresías, configuraciones, registros operativos, metadatos de archivos y evidencia de auditoría se conservan según la política aplicable al entorno y al cliente. Una solicitud de eliminación no elimina registros que deban conservarse por contrato, obligación legal, seguridad o integridad del proyecto."],
    ["5. Exportación y solicitudes", "Las funciones de exportación disponibles dependen del registro, rol y paquete. Para solicitar información sobre exportación, retención o eliminación, escriba a info@ignitesmart.ai."],
    ["6. Controles del entorno", TRUST_FACTS.security.es],
  ] : [
    ["1. Scope", "This policy explains BIMLog data retention. BIMLog is operated by BIMCapital Partners INC through its IgniteSmart technology division."],
    ["2. Files and storage", TRUST_FACTS.files.en],
    ["3. Applicable periods", TRUST_FACTS.retention.en],
    ["4. Account and project data", "Profiles, memberships, configuration, operational records, file metadata, and audit evidence are retained under the policy applicable to the environment and customer. A deletion request does not remove records that must remain for contract, legal obligation, security, or project-record integrity."],
    ["5. Export and requests", "Available export functions depend on the record, role, and enabled package. To request information about export, retention, or deletion, contact info@ignitesmart.ai."],
    ["6. Environment controls", TRUST_FACTS.security.en],
  ];
  return <div className="min-h-screen flex flex-col"><main className="max-w-3xl mx-auto px-6 py-10 flex-1 w-full">
    <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-8"><ChevronLeft size={14}/>{t("legal.backToHome")}</Link>
    <span className="text-xs font-bold uppercase tracking-wider text-primary">Legal</span><h1 className="font-display text-3xl font-bold mt-2">{lang === "es" ? "Política de Retención de Datos" : "Data Retention Policy"}</h1>
    <p className="text-sm text-muted-foreground mt-2 mb-8">{lang === "es" ? "Última actualización: 29 de septiembre de 2026" : "Last updated: September 29, 2026"} · BIMCapital Partners INC</p>
    <div className="border-t border-border pt-8">{sections.map(([heading, body])=><section key={heading} className="mb-8"><h2 className="font-display font-bold mb-2">{heading}</h2><p className="text-sm text-muted-foreground leading-7">{body}</p></section>)}</div>
  </main><Footer/></div>;
}
