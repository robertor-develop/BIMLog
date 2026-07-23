import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Footer } from "@/components/layout/Footer";
import { ChevronLeft } from "lucide-react";

const CONTENT = {
  en: {
    title: "Privacy Policy",
    effectiveDate: "March 21, 2026",
    lastUpdated: "March 21, 2026",
    sections: [
      {
        heading: "1. Who We Are",
        body: 'BIMCapital Partners INC ("BIMCapital", "we", "us", "our") operates BIMLog, a cloud-based project intelligence and accountability platform for the architecture, engineering, and construction industry. BIMLog is developed and operated through our IgniteSmart technology division.',
      },
      {
        heading: "2. What Data We Collect",
        body: "Account Data: Full name, email address, company name, job title, phone number, and password stored as a secure hash. We never store plain text passwords.\n\nProfile Data: Profile photo, digital signature, company logo stored as encoded images. Job title, phone number, notification preferences, and API token.\n\nProject Data: Project names, project codes, naming conventions, uploaded or imported project files, file names, upload timestamps, uploader identity, convention compliance results, SHA-256 cryptographic hashes, and document relationship declarations. Files may remain in the storage configured for the BIMLog environment so the requested project workflows can operate.\n\nRFI and Submittal Data: Full lifecycle data for every RFI and submittal — parties, dates, status history, ball-in-court records, response attempts, view events, and AI compliance check results.\n\nActivity Data: A timestamped record of actions taken on the platform — uploads, status changes, responses, and team changes.\n\nUsage Data: Browser type, IP address, pages visited, and session duration may be collected for platform security and performance monitoring.",
      },
      {
        heading: "3. Project File Storage",
        body: "BIMLog may store uploaded and imported project files in the storage configured for the deployed environment. Retention and deletion depend on the applicable customer configuration, contract, and legal requirements. Connecting a read-only file source imports a selected copy into BIMLog; it does not imply automatic delivery to another platform.",
      },
      {
        heading: "4. How We Use Your Data",
        body: "We use your data to operate and improve the BIMLog platform, send notifications you have configured, generate audit trails and compliance reports, calculate your BIMLog Performance Score, and provide customer support. We do not use your data for advertising. We do not sell your data to any third party under any circumstances.",
      },
      {
        heading: "5. How We Store and Protect Your Data",
        body: "BIMLog uses access controls and transport security appropriate to the configured environment. Hosting region, storage encryption, backup, and production-access commitments are deployment-specific and are stated in the applicable customer agreement or environment documentation.",
      },
      {
        heading: "6. Data Retention",
        body: "We retain account, project, file, and audit data according to the configured customer policy and applicable contractual or legal requirements. You may request information about export, retention, or deletion by contacting info@ignitesmart.ai.",
      },
      {
        heading: "7. Your Rights",
        body: "You have the right to access the personal data we hold about you, correct inaccurate data, request deletion of your account data subject to legal retention requirements, export your data in a machine-readable format, and withdraw consent for non-essential data processing. To exercise any of these rights contact info@ignitesmart.ai.",
      },
      {
        heading: "8. Third Party Services",
        body: "BIMLog may use configured infrastructure, email, AI, notification, and customer-authorized connector providers to deliver requested features. The providers and data flows applicable to a deployment are disclosed through the relevant customer terms or environment documentation. Connector credentials are handled server-side and are not returned in the customer-facing connection catalog.",
      },
      {
        heading: "9. Cookies",
        body: "BIMLog uses essential cookies only for session authentication. We do not use advertising cookies or third party tracking cookies.",
      },
      {
        heading: "10. Changes to This Policy",
        body: "We may update this Privacy Policy from time to time. We will notify registered users by email of any material changes. Continued use of BIMLog after notification constitutes acceptance of the updated policy.",
      },
      {
        heading: "11. Contact",
        body: "info@ignitesmart.ai\nBIMCapital Partners INC\n7901 4th Street North STE 300\nSt. Petersburg FL 33702",
      },
    ],
  },
  es: {
    title: "Política de Privacidad",
    effectiveDate: "21 de marzo de 2026",
    lastUpdated: "21 de marzo de 2026",
    sections: [
      {
        heading: "1. Quiénes Somos",
        body: 'BIMCapital Partners INC ("BIMCapital", "nosotros", "nuestro") opera BIMLog, una plataforma de inteligencia de proyectos y responsabilidad basada en la nube para la industria de arquitectura, ingeniería y construcción. BIMLog es desarrollado y operado a través de nuestra división tecnológica IgniteSmart.',
      },
      {
        heading: "2. Qué Datos Recopilamos",
        body: "Datos de Cuenta: Nombre completo, dirección de correo electrónico, nombre de empresa, cargo, número de teléfono y contraseña almacenada como hash seguro. Nunca almacenamos contraseñas en texto plano.\n\nDatos de Perfil: Foto de perfil, firma digital, logo de empresa almacenados como imágenes codificadas. Cargo, número de teléfono, preferencias de notificaciones y token de API.\n\nDatos de Proyecto: Nombres y códigos de proyectos, convenciones de nombres, archivos de proyecto cargados o importados, nombres de archivos, marcas de tiempo, identidad del cargador, resultados de cumplimiento, hashes criptográficos SHA-256 y relaciones documentales. Los archivos pueden permanecer en el almacenamiento configurado para el entorno BIMLog para que funcionen los flujos solicitados.\n\nDatos de RFI y Entregables: Datos del ciclo de vida de cada RFI y entregable, incluidas partes, fechas, historial de estado, responsabilidad, respuestas, visualizaciones y verificaciones de IA.\n\nDatos de Actividad: Registro con marca de tiempo de acciones realizadas en la plataforma.\n\nDatos de Uso: El tipo de navegador, dirección IP, páginas visitadas y duración de sesión pueden recopilarse para seguridad y rendimiento.",
      },
      {
        heading: "3. Almacenamiento de Archivos de Proyecto",
        body: "BIMLog puede almacenar archivos de proyecto cargados e importados en el almacenamiento configurado para el entorno desplegado. La retención y eliminación dependen de la configuración del cliente, el contrato y los requisitos legales aplicables. Conectar una fuente de archivos de solo lectura importa una copia seleccionada a BIMLog; no implica entrega automática a otra plataforma.",
      },
      {
        heading: "4. Cómo Usamos Sus Datos",
        body: "Usamos sus datos para operar y mejorar la plataforma BIMLog, enviar notificaciones que usted haya configurado, generar registros de auditoría e informes de cumplimiento, calcular su BIMLog Performance Score y proporcionar soporte al cliente. No usamos sus datos para publicidad. No vendemos sus datos a ningún tercero bajo ninguna circunstancia.",
      },
      {
        heading: "5. Cómo Almacenamos y Protegemos Sus Datos",
        body: "BIMLog usa controles de acceso y seguridad de transporte apropiados para el entorno configurado. La región de alojamiento, el cifrado de almacenamiento, las copias de seguridad y los compromisos de acceso a producción son específicos del despliegue y se indican en el acuerdo del cliente o la documentación del entorno.",
      },
      {
        heading: "6. Retención de Datos",
        body: "Retenemos datos de cuenta, proyecto, archivos y auditoría según la política configurada para el cliente y los requisitos contractuales o legales aplicables. Puede solicitar información sobre exportación, retención o eliminación contactando info@ignitesmart.ai.",
      },
      {
        heading: "7. Sus Derechos",
        body: "Tiene derecho a acceder a los datos personales que tenemos sobre usted, corregir datos inexactos, solicitar la eliminación de sus datos de cuenta sujeto a requisitos de retención legal, exportar sus datos en formato legible por máquina y retirar el consentimiento para el procesamiento de datos no esenciales. Para ejercer cualquiera de estos derechos contacte info@ignitesmart.ai.",
      },
      {
        heading: "8. Servicios de Terceros",
        body: "BIMLog puede usar proveedores configurados de infraestructura, correo, IA, notificaciones y conectores autorizados por el cliente para entregar las funciones solicitadas. Los proveedores y flujos aplicables a cada despliegue se informan en los términos del cliente o la documentación del entorno. Las credenciales de conectores se manejan en el servidor y no se devuelven en el catálogo de conexiones.",
      },
      {
        heading: "9. Cookies",
        body: "BIMLog usa solo cookies esenciales para la autenticación de sesión. No usamos cookies de publicidad ni cookies de seguimiento de terceros.",
      },
      {
        heading: "10. Cambios a Esta Política",
        body: "Podemos actualizar esta Política de Privacidad de vez en cuando. Notificaremos a los usuarios registrados por correo electrónico sobre cualquier cambio material. El uso continuado de BIMLog después de la notificación constituye aceptación de la política actualizada.",
      },
      {
        heading: "11. Contacto",
        body: "info@ignitesmart.ai\nBIMCapital Partners INC\n7901 4th Street North STE 300\nSt. Petersburg FL 33702",
      },
    ],
  },
};

export function Privacy() {
  const { language, t } = useI18n();
  const content = language === "es" ? CONTENT.es : CONTENT.en;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px", flex: 1 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "hsl(var(--muted-foreground))", textDecoration: "none", marginBottom: 32 }}>
          <ChevronLeft style={{ width: 14, height: 14 }} />
          {t("legal.backToHome")}
        </Link>

        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "hsl(var(--primary))", background: "hsl(var(--primary)/0.08)", padding: "3px 10px", borderRadius: 4 }}>Legal</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "hsl(var(--foreground))", marginBottom: 8, fontFamily: "var(--font-display)" }}>{content.title}</h1>
        <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{t("legal.effectiveDate")}: {content.effectiveDate}</div>
        <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 4 }}>{t("legal.lastUpdated")}: {content.lastUpdated}</div>
        <div style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", marginBottom: 32 }}>BIMCapital Partners INC · 7901 4th Street North, STE 300 · St. Petersburg, FL 33702 · info@ignitesmart.ai</div>

        <div style={{ borderTop: "1px solid hsl(var(--border))", paddingTop: 32 }}>
          {content.sections.map((sec, i) => (
            <div key={i} style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 10, fontFamily: "var(--font-display)" }}>{sec.heading}</h2>
              {sec.body.split("\n\n").map((para, j) => (
                <p key={j} style={{ fontSize: 14, color: "hsl(var(--muted-foreground))", lineHeight: 1.7, marginBottom: 10, whiteSpace: "pre-line" }}>{para}</p>
              ))}
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}
