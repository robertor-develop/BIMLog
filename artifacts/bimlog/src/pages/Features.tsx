import { Link } from "wouter";
import { Footer } from "@/components/layout/Footer";
import { useI18n } from "@/lib/i18n";
import { ChevronLeft, Check } from "lucide-react";

const SECTIONS = [
  {
    heading: "Document Intelligence",
    description: "Every file that enters your project is validated, fingerprinted, and recorded before it goes anywhere.",
    features: [
      "Server-side naming convention validation — ISO 19650 defaults or custom 4-step builder",
      "SHA-256 cryptographic fingerprinting — tamper-evident proof of file content at upload",
      "Mandatory declaration on every upload — uploader declares relationship to superseded version",
      "Duplicate content detection — catches re-uploaded files regardless of filename changes",
      "Superseded version tracking — full lineage from first issue to current revision",
      "Convention violation flagging with email notification to project admin",
      "AI Name Suggestion — generates a compliant filename from plain English description",
      "BIMLog Sync Agent — Windows desktop app that watches folders and validates automatically",
    ],
  },
  {
    heading: "RFI Management",
    description: "Full RFI lifecycle from creation to close — tracked, audited, and ready to export.",
    features: [
      "Create RFIs with subject, discipline, question, and due date",
      "Ball-in-court tracking — always know who is responsible and for how long",
      "Multiple response rounds with full history",
      "Conflict detection — flags RFIs that reference disputed information",
      "Rapid Approval Detection — flags reviews completed in under 60 seconds",
      "AI-assisted RFI question drafting — write better questions faster",
      "AI-assisted response drafting — structured answers in seconds",
      "Export individual RFIs to Word and PDF with checkboxes",
      "Export full RFI log to Excel",
      "Email notification when an RFI is assigned to you",
      "Email notification when an RFI goes overdue",
    ],
  },
  {
    heading: "Submittal Register",
    description: "Track every submittal from first submission through approval — with lead times, compliance checks, and audit certificates.",
    features: [
      "Submittal register with status tracking — In Review, Approved, Rejected, Revise and Resubmit",
      "Lead time management — enter required lead time and track against schedule",
      "AI Pre-Submission Compliance Check — catches the 7 most common rejection causes before submission",
      "Procurement Before Approval warning — catches the most expensive mistake in construction",
      "Audit Certificate PDF — legally formatted, UUID certified, tamper-evident",
      "AI-assisted submittal description rewriting — professional language in seconds",
      "Export individual submittals to Word and PDF",
      "Export full submittal log to Excel",
      "Email notification when a submittal is assigned to you",
    ],
  },
  {
    heading: "Immutable Activity Log",
    description: "Every action on the platform is recorded, timestamped, and permanently retained.",
    features: [
      "Every file upload, status change, RFI response, and team change is logged",
      "Immutable — records cannot be edited or deleted by any user",
      "Timestamped with UTC precision",
      "User identity recorded on every entry",
      "Company identity recorded on every entry",
      "Exportable at any time for legal or contractual purposes",
      "Audit Certificate generation — UUID-certified PDF ready for dispute resolution",
      "7-year retention after project completion",
    ],
  },
  {
    heading: "Team and Access Control",
    description: "Role-based access that mirrors how construction teams actually work.",
    features: [
      "Four roles — Drafter, Coordinator, BIM Manager, Project Admin",
      "Invite team members by email",
      "Per-project membership — users only see projects they are on",
      "Project Admin controls who can upload, respond, and approve",
      "Email notification when a team member is added to a project",
      "Up to 5 members on Free tier, 25 on Professional, unlimited on Business and Enterprise",
    ],
  },
  {
    heading: "Naming Convention Builder",
    description: "Build and enforce your project's naming convention — from scratch or from ISO 19650 defaults.",
    features: [
      "4-step wizard to define your convention",
      "ISO 19650 field defaults pre-loaded",
      "Custom fields for project code, originator, volume, level, type, role, and sequence",
      "Convention acceptance — team members must accept before uploading",
      "Real-time validation feedback on upload",
      "AI Name Generator — enter a plain English description, get a compliant filename",
      "Convention violation log with trigger and email notification",
    ],
  },
  {
    heading: "Analytics and Reporting",
    description: "Understand how your project is performing — compliance rates, RFI aging, violation trends.",
    features: [
      "Compliance rate dashboard — percentage of files passing convention on first upload",
      "Violations by company — identify which firms are causing the most issues",
      "RFI aging report — how long RFIs have been open and with whom",
      "Submittal lead time performance",
      "Rapid Approval Detection analytics",
      "Procurement risk alerts",
      "AI Report Assistant — natural language queries across all project data (Business and above)",
      "Discipline Performance Report (Business and above)",
      "BIMLog Performance Score — company-level verified rating (Business and above)",
    ],
  },
  {
    heading: "Integrations and Exports",
    description: "BIMLog supports governed file exchange and approved connectors without making every provider a public dependency.",
    features: [
      "Approved read-only file sources when configured",
      "Open-format exchange — IFC/openBIM, Excel, CSV, Word, and PDF",
      "Export to Excel — RFI log, Submittal log",
      "Export to Word and PDF — individual RFIs and Submittals",
      "Audit Certificate PDF export",
      "Authenticated API access for supported BIMLog workflows",
      "BIMLog Sync Agent — Windows desktop app for automatic folder watching and validation",
    ],
  },
];

const FEATURES_ES_COPY: Record<string, string> = {
  "Document Intelligence": "Inteligencia Documental",
  "Every file that enters your project is validated, fingerprinted, and recorded before it goes anywhere.": "Cada archivo que entra en su proyecto se valida, se identifica mediante una huella digital y se registra antes de seguir adelante.",
  "Server-side naming convention validation — ISO 19650 defaults or custom 4-step builder": "Validación de convenciones de nomenclatura del lado del servidor — valores predeterminados ISO 19650 o constructor personalizado de 4 pasos",
  "SHA-256 cryptographic fingerprinting — tamper-evident proof of file content at upload": "Huella criptográfica SHA-256 — prueba del contenido del archivo con evidencia de alteraciones al cargarlo",
  "Mandatory declaration on every upload — uploader declares relationship to superseded version": "Declaración obligatoria en cada carga — quien carga el archivo declara su relación con la versión reemplazada",
  "Duplicate content detection — catches re-uploaded files regardless of filename changes": "Detección de contenido duplicado — identifica archivos recargados aunque cambie el nombre",
  "Superseded version tracking — full lineage from first issue to current revision": "Seguimiento de versiones reemplazadas — linaje completo desde la primera emisión hasta la revisión actual",
  "Convention violation flagging with email notification to project admin": "Marcado de incumplimientos de la convención con notificación por correo al administrador del proyecto",
  "AI Name Suggestion — generates a compliant filename from plain English description": "Sugerencia de Nombre con IA — genera un nombre de archivo conforme a partir de una descripción en lenguaje natural",
  "BIMLog Sync Agent — Windows desktop app that watches folders and validates automatically": "BIMLog Sync Agent — aplicación de escritorio para Windows que supervisa carpetas y valida automáticamente",
  "RFI Management": "Gestión de RFI",
  "Full RFI lifecycle from creation to close — tracked, audited, and ready to export.": "Ciclo de vida completo de RFI, desde la creación hasta el cierre — con seguimiento, auditoría y listo para exportar.",
  "Create RFIs with subject, discipline, question, and due date": "Cree RFI con asunto, disciplina, pregunta y fecha de vencimiento",
  "Ball-in-court tracking — always know who is responsible and for how long": "Seguimiento del responsable — sepa siempre quién es responsable y desde hace cuánto",
  "Multiple response rounds with full history": "Múltiples rondas de respuestas con historial completo",
  "Conflict detection — flags RFIs that reference disputed information": "Detección de conflictos — marca las RFI que hacen referencia a información en disputa",
  "Rapid Approval Detection — flags reviews completed in under 60 seconds": "Detección de Aprobación Rápida — marca las revisiones completadas en menos de 60 segundos",
  "AI-assisted RFI question drafting — write better questions faster": "Redacción de preguntas de RFI asistida por IA — redacte mejores preguntas más rápido",
  "AI-assisted response drafting — structured answers in seconds": "Redacción de respuestas asistida por IA — respuestas estructuradas en segundos",
  "Export individual RFIs to Word and PDF with checkboxes": "Exporte RFI individuales a Word y PDF con casillas de verificación",
  "Export full RFI log to Excel": "Exporte el registro completo de RFI a Excel",
  "Email notification when an RFI is assigned to you": "Notificación por correo electrónico cuando se le asigna una RFI",
  "Email notification when an RFI goes overdue": "Notificación por correo electrónico cuando vence una RFI",
  "Submittal Register": "Registro de Submittals",
  "Track every submittal from first submission through approval — with lead times, compliance checks, and audit certificates.": "Realice el seguimiento de cada submittal desde el primer envío hasta la aprobación — con plazos de entrega, verificaciones de cumplimiento y certificados de auditoría.",
  "Submittal register with status tracking — In Review, Approved, Rejected, Revise and Resubmit": "Registro de submittals con seguimiento de estado — En Revisión, Aprobado, Rechazado, Revisar y Reenviar",
  "Lead time management — enter required lead time and track against schedule": "Gestión de plazos de entrega — introduzca el plazo requerido y compárelo con el cronograma",
  "AI Pre-Submission Compliance Check — catches the 7 most common rejection causes before submission": "Verificación de Cumplimiento Previa al Envío con IA — detecta las 7 causas de rechazo más comunes antes del envío",
  "Procurement Before Approval warning — catches the most expensive mistake in construction": "Advertencia de Compra Antes de la Aprobación — detecta el error más costoso de la construcción",
  "Audit Certificate PDF — legally formatted, UUID certified, tamper-evident": "PDF de Certificado de Auditoría — con formato jurídico, UUID certificado y evidencia de alteraciones",
  "AI-assisted submittal description rewriting — professional language in seconds": "Reescritura de descripciones de submittals asistida por IA — lenguaje profesional en segundos",
  "Export individual submittals to Word and PDF": "Exporte submittals individuales a Word y PDF",
  "Export full submittal log to Excel": "Exporte el registro completo de submittals a Excel",
  "Email notification when a submittal is assigned to you": "Notificación por correo electrónico cuando se le asigna un submittal",
  "Immutable Activity Log": "Registro de Actividad Inmutable",
  "Every action on the platform is recorded, timestamped, and permanently retained.": "Cada acción en la plataforma se registra, recibe una marca de tiempo y se conserva permanentemente.",
  "Every file upload, status change, RFI response, and team change is logged": "Se registra cada carga de archivo, cambio de estado, respuesta de RFI y cambio de equipo",
  "Immutable — records cannot be edited or deleted by any user": "Inmutable — ningún usuario puede editar ni eliminar los registros",
  "Timestamped with UTC precision": "Marca de tiempo con precisión UTC",
  "User identity recorded on every entry": "Identidad del usuario registrada en cada entrada",
  "Company identity recorded on every entry": "Identidad de la empresa registrada en cada entrada",
  "Exportable at any time for legal or contractual purposes": "Exportable en cualquier momento para fines jurídicos o contractuales",
  "Audit Certificate generation — UUID-certified PDF ready for dispute resolution": "Generación de Certificados de Auditoría — PDF con UUID certificado listo para la resolución de disputas",
  "7-year retention after project completion": "Retención de 7 años después de finalizar el proyecto",
  "Team and Access Control": "Equipo y Control de Acceso",
  "Role-based access that mirrors how construction teams actually work.": "Acceso basado en roles que refleja cómo trabajan realmente los equipos de construcción.",
  "Four roles — Drafter, Coordinator, BIM Manager, Project Admin": "Cuatro roles — Dibujante, Coordinador, Gerente BIM y Administrador de Proyecto",
  "Invite team members by email": "Invite a miembros del equipo por correo electrónico",
  "Per-project membership — users only see projects they are on": "Membresía por proyecto — los usuarios solo ven los proyectos en los que participan",
  "Project Admin controls who can upload, respond, and approve": "El Administrador de Proyecto controla quién puede cargar, responder y aprobar",
  "Email notification when a team member is added to a project": "Notificación por correo electrónico cuando se añade un miembro del equipo a un proyecto",
  "Up to 5 members on Free tier, 25 on Professional, unlimited on Business and Enterprise": "Hasta 5 miembros en el plan Gratis, 25 en Profesional e ilimitados en Business y Enterprise",
  "Naming Convention Builder": "Constructor de Convenciones de Nomenclatura",
  "Build and enforce your project's naming convention — from scratch or from ISO 19650 defaults.": "Cree y aplique la convención de nomenclatura de su proyecto — desde cero o a partir de los valores predeterminados ISO 19650.",
  "4-step wizard to define your convention": "Asistente de 4 pasos para definir su convención",
  "ISO 19650 field defaults pre-loaded": "Valores predeterminados de campos ISO 19650 precargados",
  "Custom fields for project code, originator, volume, level, type, role, and sequence": "Campos personalizados para código de proyecto, originador, volumen, nivel, tipo, rol y secuencia",
  "Convention acceptance — team members must accept before uploading": "Aceptación de la convención — los miembros del equipo deben aceptarla antes de cargar archivos",
  "Real-time validation feedback on upload": "Resultados de validación en tiempo real durante la carga",
  "AI Name Generator — enter a plain English description, get a compliant filename": "Generador de Nombres con IA — introduzca una descripción en lenguaje natural y obtenga un nombre de archivo conforme",
  "Convention violation log with trigger and email notification": "Registro de incumplimientos de la convención con activador y notificación por correo electrónico",
  "Analytics and Reporting": "Analítica e Informes",
  "Understand how your project is performing — compliance rates, RFI aging, violation trends.": "Comprenda el rendimiento de su proyecto — tasas de cumplimiento, antigüedad de RFI y tendencias de incumplimiento.",
  "Compliance rate dashboard — percentage of files passing convention on first upload": "Panel de tasa de cumplimiento — porcentaje de archivos que cumplen la convención en la primera carga",
  "Violations by company — identify which firms are causing the most issues": "Incumplimientos por empresa — identifique qué empresas generan más problemas",
  "RFI aging report — how long RFIs have been open and with whom": "Informe de antigüedad de RFI — cuánto tiempo llevan abiertas y quién es responsable",
  "Submittal lead time performance": "Rendimiento de plazos de entrega de submittals",
  "Rapid Approval Detection analytics": "Analítica de Detección de Aprobación Rápida",
  "Procurement risk alerts": "Alertas de riesgo de compras",
  "AI Report Assistant — natural language queries across all project data (Business and above)": "Asistente de Informes con IA — consultas en lenguaje natural sobre todos los datos del proyecto (Business y superiores)",
  "Discipline Performance Report (Business and above)": "Informe de Rendimiento por Disciplina (Business y superiores)",
  "BIMLog Performance Score — company-level verified rating (Business and above)": "Puntuación de Rendimiento BIMLog — calificación verificada a nivel de empresa (Business y superiores)",
  "Integrations and Exports": "Integraciones y Exportaciones",
  "BIMLog supports governed file exchange and approved connectors without making every provider a public dependency.": "BIMLog admite el intercambio gobernado de archivos y conectores aprobados sin convertir a cada proveedor en una dependencia pública.",
  "Approved read-only file sources when configured": "Fuentes de archivos de solo lectura aprobadas cuando estén configuradas",
  "Open-format exchange — IFC/openBIM, Excel, CSV, Word, and PDF": "Intercambio en formatos abiertos — IFC/openBIM, Excel, CSV, Word y PDF",
  "Export to Excel — RFI log, Submittal log": "Exportación a Excel — registro de RFI y registro de submittals",
  "Export to Word and PDF — individual RFIs and Submittals": "Exportación a Word y PDF — RFI y submittals individuales",
  "Audit Certificate PDF export": "Exportación del PDF de Certificado de Auditoría",
  "Authenticated API access for supported BIMLog workflows": "Acceso autenticado a la API para flujos de trabajo compatibles de BIMLog",
  "BIMLog Sync Agent — Windows desktop app for automatic folder watching and validation": "BIMLog Sync Agent — aplicación de escritorio para Windows que supervisa y valida carpetas automáticamente",
  "Back to home": "Volver al inicio",
  "Platform": "Plataforma",
  "BIMLog Features": "Funciones de BIMLog",
  "Everything you need to govern your project from first file to final certificate.": "Todo lo que necesita para gobernar su proyecto desde el primer archivo hasta el certificado final.",
  "Ready to get started?": "¿Listo para comenzar?",
  "Your first project is free. No credit card required. Start building your project record today.": "Su primer proyecto es gratis. No se requiere tarjeta de crédito. Comience hoy mismo a crear el registro de su proyecto.",
  "Start Free": "Comience gratis",
  "View Pricing": "Ver precios",
  "Contact Us": "Contáctenos",
};

function FeatureSection({ section, index, translate }: { section: typeof SECTIONS[0]; index: number; translate: (copy: string) => string }) {
  const accent = index % 2 === 0 ? "hsl(var(--primary))" : "#7c3aed";
  return (
    <div style={{ marginBottom: 56 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ width: 4, height: 32, background: accent, borderRadius: 2, marginBottom: 12 }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 8, fontFamily: "var(--font-display)" }}>{translate(section.heading)}</h2>
          <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", lineHeight: 1.7, marginBottom: 20 }}>{translate(section.description)}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {section.features.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: `${accent}18`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  <Check style={{ width: 10, height: 10, color: accent }} />
                </div>
                <span style={{ fontSize: 13, color: "hsl(var(--foreground))", lineHeight: 1.6 }}>{translate(f)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Features() {
  const { tt } = useI18n();
  const translate = (copy: string) => tt(copy, FEATURES_ES_COPY[copy] ?? copy);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px", flex: 1, width: "100%" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "hsl(var(--muted-foreground))", textDecoration: "none", marginBottom: 40 }}>
          <ChevronLeft style={{ width: 14, height: 14 }} />
          {translate("Back to home")}
        </Link>

        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--primary))", background: "hsl(var(--primary)/0.08)", padding: "3px 10px", borderRadius: 4 }}>{translate("Platform")}</span>
        </div>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 14, fontFamily: "var(--font-display)" }}>
          {translate("BIMLog Features")}
        </h1>
        <p style={{ fontSize: 16, color: "hsl(var(--muted-foreground))", marginBottom: 64, lineHeight: 1.7 }}>
          {translate("Everything you need to govern your project from first file to final certificate.")}
        </p>

        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 48 }}>
          {SECTIONS.map((section, i) => (
            <FeatureSection key={section.heading} section={section} index={i} translate={translate} />
          ))}
        </div>

        <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, padding: "32px 36px", textAlign: "center", marginTop: 16 }}>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 8, fontFamily: "var(--font-display)" }}>{translate("Ready to get started?")}</h3>
          <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", marginBottom: 24, lineHeight: 1.7 }}>
            {translate("Your first project is free. No credit card required. Start building your project record today.")}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/register" style={{ background: "hsl(var(--primary))", color: "white", padding: "11px 24px", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>{translate("Start Free")}</a>
            <a href="/pricing" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", padding: "11px 24px", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>{translate("View Pricing")}</a>
            <a href="/contact" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))", padding: "11px 24px", borderRadius: 8, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>{translate("Contact Us")}</a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
