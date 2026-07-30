import { useState } from "react";
import { Link } from "wouter";
import { Footer } from "@/components/layout/Footer";
import { useI18n } from "@/lib/i18n";
import { ChevronLeft, Check, Star } from "lucide-react";

const FREE_FEATURES = [
  "1 active project",
  "3 months full access",
  "Naming convention builder",
  "Name generator",
  "File upload with server-side validation",
  "RFI tracking and management",
  "Submittal register",
  "Activity log — immutable audit trail",
  "Team management — up to 5 members",
  "Bilingual EN/ES",
  "BIMLog Sync Agent — desktop app",
  "Email support",
];

const PRO_FEATURES = [
  "Everything in Free, plus:",
  "Up to 3 active projects",
  "Document Integrity System — SHA-256 cryptographic fingerprinting",
  "Mandatory declaration logging on every upload",
  "Duplicate content detection",
  "Superseded version tracking",
  "AI Pre-Submission Compliance Check",
  "Procurement Before Approval warning",
  "Rapid Approval Detection",
  "Full RFI lifecycle — ball-in-court tracking, multiple responses, conflict detection",
  "Submittal Register with lead time management",
  "Audit Certificate PDF — legally formatted, UUID certified, tamper-evident",
  "AI-assisted RFI question and response drafting",
  "AI-assisted submittal description rewriting",
  "Convention Builder — 4-step wizard, ISO 19650 defaults",
  "Automated email notifications",
  "Analytics dashboard",
  "Export to Excel — RFI log, Submittal log",
  "Export to Word and PDF",
  "Team invite by email",
  "Up to 25 team members per project",
  "Priority email support",
];

const TEAM_FEATURES = [
  "Everything in Professional, plus:",
  "Up to 5 active projects",
  "BIMLog Performance Score — company-level verified rating",
  "Drawing Register",
  "Change Order Log",
  "Punch List and Snagging",
  "Daily Reports",
];

const BUSINESS_FEATURES = [
  "Everything in Team, plus:",
  "Up to 10 active projects",
  "Unlimited team members",
  "Transmittal Manager",
  "Meeting Minutes and Action Items tracker",
  "AI Report Assistant — natural language queries across all project data",
  "Coordination Accountability Report",
  "Discipline Performance Report",
  "Compliance Badge — verifiable digital award on project completion",
  "Governed connectors subject to provider and customer approval",
  "Open-format file exchange and approved file sources",
  "Delay Attribution reporting",
  "Dedicated onboarding support",
  "Phone and email support",
  "SLA guaranteed uptime",
];

const ENTERPRISE_FEATURES = [
  "Everything in Business, plus:",
  "Unlimited active projects",
  "White-label option — your logo and branding",
  "Custom report templates tailored to your requirements",
  "BIMLog Sync Agent — enterprise folder watching and automatic validation",
  "Approved OAuth file sources when configured",
  "Authenticated API access for supported workflows",
  "Custom data retention policy",
  "Dedicated account manager",
  "Custom SLA and uptime guarantees",
  "Bulk seat pricing",
  "Priority feature development — your requests go to the top of the roadmap",
  "Founding Partner designation — if signing before public launch",
  "Locked pricing for 36 months",
];

const FAQS = [
  {
    q: "Do I need to ask my GC's permission to use BIMLog?",
    a: "No. Subcontractors and coordinators can sign up and use BIMLog on any project independently. You do not need permission from anyone above you in the project hierarchy. Start building your project record today for free.",
  },
  {
    q: "Does BIMLog replace my existing project systems?",
    a: "BIMLog can work alongside approved customer systems through governed, reversible file exchange. Connector availability depends on provider approval, customer entitlement, and deployment configuration.",
  },
  {
    q: "What happens to my data after 3 months on the free tier?",
    a: "Your project moves to read-only mode. All data and audit trails are permanently retained. You can still view and export everything. You just cannot upload new files or create new RFIs without upgrading.",
  },
  {
    q: "Is my data secure?",
    a: "BIMLog applies access controls and transport security. Uploaded and imported files may be retained in the configured project storage so BIMLog can provide its documented workflows. Deployment and retention details are stated in the applicable customer terms and Privacy Policy.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. Every log, every RFI, every submittal, every audit certificate is exportable at any time. Your data belongs to you. We are a recording system, not a lock-in.",
  },
  {
    q: "What is the Founding Partner program?",
    a: "We are currently accepting a limited number of founding partners — GCs and BIM coordination firms who will help shape the platform and receive locked pricing for 3 years. Contact us at info@ignitesmart.ai to discuss.",
  },
];

const PRICING_ES_COPY: Record<string, string> = {
  "1 active project": "1 proyecto activo",
  "3 months full access": "3 meses de acceso completo",
  "Naming convention builder": "Constructor de convenciones de nomenclatura",
  "Name generator": "Generador de nombres",
  "File upload with server-side validation": "Carga de archivos con validación del lado del servidor",
  "RFI tracking and management": "Seguimiento y gestión de RFI",
  "Submittal register": "Registro de submittals",
  "Activity log — immutable audit trail": "Registro de actividad — pista de auditoría inmutable",
  "Team management — up to 5 members": "Gestión de equipos — hasta 5 miembros",
  "Bilingual EN/ES": "Bilingüe EN/ES",
  "BIMLog Sync Agent — desktop app": "BIMLog Sync Agent — aplicación de escritorio",
  "Email support": "Soporte por correo electrónico",
  "Everything in Free, plus:": "Todo lo incluido en Gratis, más:",
  "Up to 3 active projects": "Hasta 3 proyectos activos",
  "Document Integrity System — SHA-256 cryptographic fingerprinting": "Sistema de Integridad Documental — huella criptográfica SHA-256",
  "Mandatory declaration logging on every upload": "Registro obligatorio de declaración en cada carga",
  "Duplicate content detection": "Detección de contenido duplicado",
  "Superseded version tracking": "Seguimiento de versiones reemplazadas",
  "AI Pre-Submission Compliance Check": "Verificación de Cumplimiento Previa al Envío con IA",
  "Procurement Before Approval warning": "Advertencia de Compra Antes de la Aprobación",
  "Rapid Approval Detection": "Detección de Aprobación Rápida",
  "Full RFI lifecycle — ball-in-court tracking, multiple responses, conflict detection": "Ciclo de vida completo de RFI — seguimiento del responsable, múltiples respuestas y detección de conflictos",
  "Submittal Register with lead time management": "Registro de submittals con gestión de plazos de entrega",
  "Audit Certificate PDF — legally formatted, UUID certified, tamper-evident": "PDF de Certificado de Auditoría — con formato jurídico, UUID certificado y evidencia de alteraciones",
  "AI-assisted RFI question and response drafting": "Redacción de preguntas y respuestas de RFI asistida por IA",
  "AI-assisted submittal description rewriting": "Reescritura de descripciones de submittals asistida por IA",
  "Convention Builder — 4-step wizard, ISO 19650 defaults": "Constructor de Convenciones — asistente de 4 pasos y valores predeterminados ISO 19650",
  "Automated email notifications": "Notificaciones automáticas por correo electrónico",
  "Analytics dashboard": "Panel de analítica",
  "Export to Excel — RFI log, Submittal log": "Exportación a Excel — registro de RFI y registro de submittals",
  "Export to Word and PDF": "Exportación a Word y PDF",
  "Team invite by email": "Invitación al equipo por correo electrónico",
  "Up to 25 team members per project": "Hasta 25 miembros del equipo por proyecto",
  "Priority email support": "Soporte prioritario por correo electrónico",
  "Everything in Professional, plus:": "Todo lo incluido en Profesional, más:",
  "Up to 5 active projects": "Hasta 5 proyectos activos",
  "BIMLog Performance Score — company-level verified rating": "Puntuación de Rendimiento BIMLog — calificación verificada a nivel de empresa",
  "Drawing Register": "Registro de planos",
  "Change Order Log": "Registro de órdenes de cambio",
  "Punch List and Snagging": "Lista de pendientes y deficiencias",
  "Daily Reports": "Informes diarios",
  "Everything in Team, plus:": "Todo lo incluido en Equipo, más:",
  "Up to 10 active projects": "Hasta 10 proyectos activos",
  "Unlimited team members": "Miembros del equipo ilimitados",
  "Transmittal Manager": "Gestor de transmittals",
  "Meeting Minutes and Action Items tracker": "Seguimiento de minutas de reunión y elementos de acción",
  "AI Report Assistant — natural language queries across all project data": "Asistente de Informes con IA — consultas en lenguaje natural sobre todos los datos del proyecto",
  "Coordination Accountability Report": "Informe de Responsabilidad de Coordinación",
  "Discipline Performance Report": "Informe de Rendimiento por Disciplina",
  "Compliance Badge — verifiable digital award on project completion": "Insignia de Cumplimiento — reconocimiento digital verificable al finalizar el proyecto",
  "Governed connectors subject to provider and customer approval": "Conectores gobernados sujetos a la aprobación del proveedor y del cliente",
  "Open-format file exchange and approved file sources": "Intercambio de archivos en formatos abiertos y fuentes de archivos aprobadas",
  "Delay Attribution reporting": "Informes de Atribución de Retrasos",
  "Dedicated onboarding support": "Soporte dedicado de incorporación",
  "Phone and email support": "Soporte telefónico y por correo electrónico",
  "SLA guaranteed uptime": "Disponibilidad garantizada por SLA",
  "Everything in Business, plus:": "Todo lo incluido en Business, más:",
  "Unlimited active projects": "Proyectos activos ilimitados",
  "White-label option — your logo and branding": "Opción de marca blanca — su logotipo e identidad de marca",
  "Custom report templates tailored to your requirements": "Plantillas de informes personalizadas según sus requisitos",
  "BIMLog Sync Agent — enterprise folder watching and automatic validation": "BIMLog Sync Agent — supervisión de carpetas empresariales y validación automática",
  "Approved OAuth file sources when configured": "Fuentes de archivos OAuth aprobadas cuando estén configuradas",
  "Authenticated API access for supported workflows": "Acceso autenticado a la API para flujos de trabajo compatibles",
  "Custom data retention policy": "Política personalizada de retención de datos",
  "Dedicated account manager": "Gerente de cuenta dedicado",
  "Custom SLA and uptime guarantees": "SLA y garantías de disponibilidad personalizados",
  "Bulk seat pricing": "Precios por volumen de licencias",
  "Priority feature development — your requests go to the top of the roadmap": "Desarrollo prioritario de funciones — sus solicitudes pasan al inicio de la hoja de ruta",
  "Founding Partner designation — if signing before public launch": "Designación de Socio Fundador — si firma antes del lanzamiento público",
  "Locked pricing for 36 months": "Precio fijo durante 36 meses",
  "Do I need to ask my GC's permission to use BIMLog?": "¿Necesito pedir permiso a mi contratista general para usar BIMLog?",
  "No. Subcontractors and coordinators can sign up and use BIMLog on any project independently. You do not need permission from anyone above you in the project hierarchy. Start building your project record today for free.": "No. Los subcontratistas y coordinadores pueden registrarse y usar BIMLog de forma independiente en cualquier proyecto. No necesitan permiso de nadie por encima de ellos en la jerarquía del proyecto. Comience hoy mismo a crear el registro de su proyecto de forma gratuita.",
  "Does BIMLog replace my existing project systems?": "¿BIMLog reemplaza mis sistemas de proyecto actuales?",
  "BIMLog can work alongside approved customer systems through governed, reversible file exchange. Connector availability depends on provider approval, customer entitlement, and deployment configuration.": "BIMLog puede funcionar junto con los sistemas aprobados del cliente mediante un intercambio de archivos gobernado y reversible. La disponibilidad de conectores depende de la aprobación del proveedor, la habilitación del cliente y la configuración del despliegue.",
  "What happens to my data after 3 months on the free tier?": "¿Qué sucede con mis datos después de 3 meses en el plan gratuito?",
  "Your project moves to read-only mode. All data and audit trails are permanently retained. You can still view and export everything. You just cannot upload new files or create new RFIs without upgrading.": "Su proyecto pasa al modo de solo lectura. Todos los datos y las pistas de auditoría se conservan permanentemente. Puede seguir consultando y exportando todo, pero no puede cargar archivos nuevos ni crear nuevas RFI sin cambiar de plan.",
  "Is my data secure?": "¿Mis datos están seguros?",
  "BIMLog applies access controls and transport security. Uploaded and imported files may be retained in the configured project storage so BIMLog can provide its documented workflows. Deployment and retention details are stated in the applicable customer terms and Privacy Policy.": "BIMLog aplica controles de acceso y seguridad de transporte. Los archivos cargados e importados pueden conservarse en el almacenamiento configurado del proyecto para que BIMLog pueda proporcionar sus flujos de trabajo documentados. Los detalles de despliegue y retención se indican en los términos aplicables al cliente y en la Política de Privacidad.",
  "Can I export my data?": "¿Puedo exportar mis datos?",
  "Yes. Every log, every RFI, every submittal, every audit certificate is exportable at any time. Your data belongs to you. We are a recording system, not a lock-in.": "Sí. Cada registro, RFI, submittal y certificado de auditoría se puede exportar en cualquier momento. Sus datos le pertenecen. Somos un sistema de registro, no una plataforma cerrada.",
  "What is the Founding Partner program?": "¿Qué es el programa de Socios Fundadores?",
  "We are currently accepting a limited number of founding partners — GCs and BIM coordination firms who will help shape the platform and receive locked pricing for 3 years. Contact us at info@ignitesmart.ai to discuss.": "Actualmente aceptamos un número limitado de socios fundadores — contratistas generales y empresas de coordinación BIM que ayudarán a dar forma a la plataforma y recibirán un precio fijo durante 3 años. Comuníquese con nosotros en info@ignitesmart.ai para conversar.",
  "MOST POPULAR": "MÁS POPULAR",
  "Back to home": "Volver al inicio",
  "Pricing": "Precios",
  "Simple, transparent pricing that scales with your projects": "Precios simples y transparentes que crecen con sus proyectos",
  "Start free. Upgrade when you are ready. No credit card required to get started.": "Comience gratis. Cambie de plan cuando esté listo. No se requiere tarjeta de crédito para comenzar.",
  "Monthly": "Mensual",
  "Annual": "Anual",
  "SAVE 2 MO": "AHORRE 2 MESES",
  "Free": "Gratis",
  "Perfect for getting started": "Perfecto para comenzar",
  "No credit card required": "No se requiere tarjeta de crédito",
  "Start Free — no credit card required": "Comience gratis — no se requiere tarjeta de crédito",
  "Professional": "Profesional",
  "For small coordination firms and independent BIM coordinators. Up to 3 active projects.": "Para pequeñas empresas de coordinación y coordinadores BIM independientes. Hasta 3 proyectos activos.",
  "$149 / month": "$149 / mes",
  "$1,490 / year": "$1,490 / año",
  "Save 2 months — best value": "Ahorre 2 meses — la mejor relación calidad-precio",
  "Get Started": "Comenzar",
  "Team": "Equipo",
  "For mid-size firms running multiple projects simultaneously. Up to 5 active projects.": "Para empresas medianas que gestionan varios proyectos simultáneamente. Hasta 5 proyectos activos.",
  "$249 / month": "$249 / mes",
  "$2,490 / year": "$2,490 / año",
  "Business": "Business",
  "For established GCs and BIM management firms. Up to 10 active projects.": "Para contratistas generales consolidados y empresas de gestión BIM. Hasta 10 proyectos activos.",
  "$399 / month": "$399 / mes",
  "$3,990 / year": "$3,990 / año",
  "Enterprise": "Enterprise",
  "For large GCs, developers, and institutions managing unlimited projects.": "Para grandes contratistas generales, desarrolladores e instituciones que gestionan proyectos ilimitados.",
  "Custom pricing": "Precio personalizado",
  "Starting at $2,000 / month": "Desde $2,000 / mes",
  "Contact Us — we build a proposal": "Contáctenos — preparamos una propuesta",
  "Limited Availability": "Disponibilidad limitada",
  "Founding Partner Program": "Programa de Socios Fundadores",
  "Sign before public launch and lock your pricing for 36 months. Founding Partners receive:": "Firme antes del lanzamiento público y fije su precio durante 36 meses. Los Socios Fundadores reciben:",
  "$99 / month": "$99 / mes",
  "$179 / month": "$179 / mes",
  "$299 / month": "$299 / mes",
  "Negotiated individually": "Negociado individualmente",
  "Founding Partners also receive priority feature development — your requests go to the top of the roadmap — and the Founding Partner designation on your company profile visible to all BIMLog users.": "Los Socios Fundadores también reciben desarrollo prioritario de funciones — sus solicitudes pasan al inicio de la hoja de ruta — y la designación de Socio Fundador en el perfil de su empresa, visible para todos los usuarios de BIMLog.",
  "Apply for Founding Partner Status": "Solicitar la condición de Socio Fundador",
  "Why BIMLog pays for itself": "Por qué BIMLog se paga por sí mismo",
  "Industry research across thousands of AEC professionals shows:": "La investigación del sector con miles de profesionales de AEC demuestra:",
  "of submittals are rejected on first submission": "de los submittals se rechazan en el primer envío",
  "average cost per rejection in administrative time and delay": "costo promedio por rechazo en tiempo administrativo y retrasos",
  "lost on a project with 2,000 submittals at 35% rejection rate": "perdidos en un proyecto con 2,000 submittals y una tasa de rechazo del 35%",
  "2–4 weeks": "2–4 semanas",
  "added to the project schedule per rejection": "añadidas al cronograma del proyecto por cada rechazo",
  "BIMLog's AI pre-submission check catches the 7 most common rejection causes before the submittal leaves your hands.": "La verificación previa al envío con IA de BIMLog detecta las 7 causas de rechazo más comunes antes de que el submittal salga de sus manos.",
  "One prevented rejection on a complex submittal pays for BIMLog for an entire year.": "Evitar un solo rechazo en un submittal complejo paga BIMLog durante un año completo.",
  "And that is before you count the value of having a legally defensible audit trail when a dispute arises.": "Y eso es antes de contar el valor de disponer de una pista de auditoría jurídicamente defendible cuando surge una disputa.",
  "Frequently asked questions": "Preguntas frecuentes",
};

interface TierCardProps {
  name: string;
  subtitle: string;
  monthlyPrice: string;
  annualPrice?: string;
  annualNote?: string;
  priceNote?: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
  annual: boolean;
  translate: (copy: string) => string;
}

function TierCard({ name, subtitle, monthlyPrice, annualPrice, annualNote, priceNote, features, ctaLabel, ctaHref, highlight, annual, translate }: TierCardProps) {
  const displayPrice = annual && annualPrice ? annualPrice : monthlyPrice;
  const displayNote = annual && annualNote ? annualNote : priceNote;

  return (
    <div style={{
      flex: 1, minWidth: 220,
      background: highlight ? "hsl(var(--primary))" : "hsl(var(--card))",
      border: highlight ? "2px solid hsl(var(--primary))" : "1px solid hsl(var(--border))",
      borderRadius: 14,
      padding: "28px 22px",
      display: "flex", flexDirection: "column",
      position: "relative",
    }}>
      {highlight && (
        <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "#f59e0b", color: "white", fontSize: 10, fontWeight: 800, padding: "3px 12px", borderRadius: 99, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
          {translate("MOST POPULAR")}
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: highlight ? "rgba(255,255,255,0.7)" : "hsl(var(--primary))", marginBottom: 6 }}>{translate(name)}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: highlight ? "rgba(255,255,255,0.85)" : "hsl(var(--foreground))", marginBottom: 10, lineHeight: 1.4 }}>{translate(subtitle)}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: highlight ? "white" : "hsl(var(--foreground))" }}>{translate(displayPrice)}</div>
        {displayNote && (
          <div style={{ fontSize: 12, color: highlight ? "rgba(255,255,255,0.65)" : "hsl(var(--muted-foreground))", marginTop: 4 }}>{translate(displayNote)}</div>
        )}
      </div>

      <div style={{ flex: 1, marginBottom: 24 }}>
        {features.map((f, i) => {
          const label = translate(f);
          return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            {f.endsWith(":") ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: highlight ? "rgba(255,255,255,0.6)" : "hsl(var(--muted-foreground))", marginTop: 4, display: "block" }}>{label}</span>
            ) : (
              <>
                <Check style={{ width: 13, height: 13, flexShrink: 0, marginTop: 2, color: highlight ? "rgba(255,255,255,0.9)" : "#22c55e" }} />
                <span style={{ fontSize: 13, color: highlight ? "rgba(255,255,255,0.85)" : "hsl(var(--foreground))", lineHeight: 1.5 }}>{label}</span>
              </>
            )}
          </div>
        )})}
      </div>

      <a
        href={ctaHref}
        style={{
          display: "block", textAlign: "center", padding: "11px 16px",
          borderRadius: 8, fontWeight: 700, fontSize: 13, textDecoration: "none",
          background: highlight ? "white" : "hsl(var(--primary))",
          color: highlight ? "hsl(var(--primary))" : "white",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
        onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
      >
        {translate(ctaLabel)}
      </a>
    </div>
  );
}

export function Pricing() {
  const [annual, setAnnual] = useState(false);
  const { tt } = useI18n();
  const translate = (copy: string) => tt(copy, PRICING_ES_COPY[copy] ?? copy);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 24px", flex: 1, width: "100%" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "hsl(var(--muted-foreground))", textDecoration: "none", marginBottom: 40 }}>
          <ChevronLeft style={{ width: 14, height: 14 }} />
          {translate("Back to home")}
        </Link>

        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--primary))", background: "hsl(var(--primary)/0.08)", padding: "3px 10px", borderRadius: 4 }}>{translate("Pricing")}</span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 14, fontFamily: "var(--font-display)" }}>
            {translate("Simple, transparent pricing that scales with your projects")}
          </h1>
          <p style={{ fontSize: 16, color: "hsl(var(--muted-foreground))", maxWidth: 560, margin: "0 auto 28px" }}>
            {translate("Start free. Upgrade when you are ready. No credit card required to get started.")}
          </p>

          {/* Monthly / Annual Toggle */}
          <div style={{ display: "inline-flex", alignItems: "center", background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))", borderRadius: 99, padding: 4, gap: 2 }}>
            <button
              onClick={() => setAnnual(false)}
              style={{
                padding: "7px 20px", borderRadius: 99, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                background: !annual ? "hsl(var(--background))" : "transparent",
                color: !annual ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                boxShadow: !annual ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}
            >
              {translate("Monthly")}
            </button>
            <button
              onClick={() => setAnnual(true)}
              style={{
                padding: "7px 20px", borderRadius: 99, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                background: annual ? "hsl(var(--background))" : "transparent",
                color: annual ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))",
                boxShadow: annual ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {translate("Annual")}
              <span style={{ background: "#22c55e", color: "white", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 99, letterSpacing: "0.04em" }}>{translate("SAVE 2 MO")}</span>
            </button>
          </div>
        </div>

        {/* Tier Cards */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 48, alignItems: "flex-start" }}>
          <TierCard
            name="Free"
            subtitle="Perfect for getting started"
            monthlyPrice="$0"
            priceNote="No credit card required"
            features={FREE_FEATURES}
            ctaLabel="Start Free — no credit card required"
            ctaHref="/register"
            annual={annual}
            translate={translate}
          />
          <TierCard
            name="Professional"
            subtitle="For small coordination firms and independent BIM coordinators. Up to 3 active projects."
            monthlyPrice="$149 / month"
            annualPrice="$1,490 / year"
            annualNote="Save 2 months — best value"
            features={PRO_FEATURES}
            ctaLabel="Get Started"
            ctaHref="/contact"
            highlight
            annual={annual}
            translate={translate}
          />
          <TierCard
            name="Team"
            subtitle="For mid-size firms running multiple projects simultaneously. Up to 5 active projects."
            monthlyPrice="$249 / month"
            annualPrice="$2,490 / year"
            annualNote="Save 2 months — best value"
            features={TEAM_FEATURES}
            ctaLabel="Get Started"
            ctaHref="/contact"
            annual={annual}
            translate={translate}
          />
          <TierCard
            name="Business"
            subtitle="For established GCs and BIM management firms. Up to 10 active projects."
            monthlyPrice="$399 / month"
            annualPrice="$3,990 / year"
            annualNote="Save 2 months — best value"
            features={BUSINESS_FEATURES}
            ctaLabel="Get Started"
            ctaHref="/contact"
            annual={annual}
            translate={translate}
          />
          <TierCard
            name="Enterprise"
            subtitle="For large GCs, developers, and institutions managing unlimited projects."
            monthlyPrice="Custom pricing"
            priceNote="Starting at $2,000 / month"
            features={ENTERPRISE_FEATURES}
            ctaLabel="Contact Us — we build a proposal"
            ctaHref="/contact"
            annual={annual}
            translate={translate}
          />
        </div>

        {/* Founding Partner Banner */}
        <div style={{
          background: "linear-gradient(135deg, #fffbeb, #fef3c7)",
          border: "2px solid #f59e0b",
          borderRadius: 14,
          padding: "32px 36px",
          marginBottom: 56,
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 120, height: 120, background: "#f59e0b11", borderRadius: "0 0 0 120px" }} />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center" }}><Star size={28} color="#92400e" fill="#f59e0b" /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#92400e", marginBottom: 6 }}>{translate("Limited Availability")}</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#78350f", marginBottom: 10, fontFamily: "var(--font-display)" }}>
                {translate("Founding Partner Program")}
              </h2>
              <p style={{ fontSize: 14, color: "#92400e", lineHeight: 1.7, marginBottom: 16 }}>
                {translate("Sign before public launch and lock your pricing for 36 months. Founding Partners receive:")}
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                {[
                  { tier: "Professional", price: "$99 / month" },
                  { tier: "Team", price: "$179 / month" },
                  { tier: "Business", price: "$299 / month" },
                  { tier: "Enterprise", price: "Negotiated individually" },
                ].map(item => (
                  <div key={item.tier} style={{ background: "white", border: "1px solid #f59e0b", borderRadius: 8, padding: "10px 16px", minWidth: 160 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#92400e", marginBottom: 2 }}>{translate(item.tier)}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#78350f" }}>{translate(item.price)}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 13, color: "#92400e", lineHeight: 1.7, marginBottom: 20 }}>
                {translate("Founding Partners also receive priority feature development — your requests go to the top of the roadmap — and the Founding Partner designation on your company profile visible to all BIMLog users.")}
              </p>
              <a
                href="/contact"
                style={{
                  display: "inline-block", background: "#f59e0b", color: "white",
                  padding: "10px 22px", borderRadius: 8, fontWeight: 700, fontSize: 14,
                  textDecoration: "none", transition: "opacity 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
              >
                {translate("Apply for Founding Partner Status")}
              </a>
            </div>
          </div>
        </div>

        {/* ROI Section */}
        <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 14, padding: "36px 40px", marginBottom: 64 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 8, fontFamily: "var(--font-display)" }}>
            {translate("Why BIMLog pays for itself")}
          </h2>
          <p style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", marginBottom: 24, lineHeight: 1.7 }}>
            {translate("Industry research across thousands of AEC professionals shows:")}
          </p>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
            {[
              { stat: "30–40%", label: "of submittals are rejected on first submission" },
              { stat: "$805", label: "average cost per rejection in administrative time and delay" },
              { stat: "$500k+", label: "lost on a project with 2,000 submittals at 35% rejection rate" },
              { stat: "2–4 weeks", label: "added to the project schedule per rejection" },
            ].map(item => (
              <div key={item.stat} style={{ flex: 1, minWidth: 180, background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "20px 20px" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "hsl(var(--primary))", marginBottom: 4 }}>{translate(item.stat)}</div>
                <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>{translate(item.label)}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 14, color: "hsl(var(--foreground))", lineHeight: 1.7, margin: 0 }}>
            {translate("BIMLog's AI pre-submission check catches the 7 most common rejection causes before the submittal leaves your hands.")}{" "}
            <strong>{translate("One prevented rejection on a complex submittal pays for BIMLog for an entire year.")}</strong>{" "}
            {translate("And that is before you count the value of having a legally defensible audit trail when a dispute arises.")}
          </p>
        </div>

        {/* FAQ Section */}
        <div style={{ marginBottom: 64 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 32, fontFamily: "var(--font-display)" }}>
            {translate("Frequently asked questions")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "20px 24px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 8 }}>{translate(faq.q)}</div>
                <div style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", lineHeight: 1.7 }}>{translate(faq.a)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
