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
        body: "Account Data: Full name, email address, company name, job title, phone number, and password stored as a secure hash. We never store plain text passwords.\n\nProfile Data: Profile photo, digital signature, company logo stored as encoded images. Job title, phone number, notification preferences, and API token.\n\nProject Data: Project names, project codes, naming conventions, file metadata including file names, upload timestamps, uploader identity, convention compliance results, SHA-256 cryptographic hashes, and document relationship declarations. We do not store physical project files — only the metadata and audit records associated with them.\n\nRFI and Submittal Data: Full lifecycle data for every RFI and submittal — parties, dates, status history, ball-in-court records, response attempts, view events, and AI compliance check results.\n\nActivity Data: An immutable timestamped record of every action taken on the platform by every user — uploads, status changes, responses, and team changes.\n\nUsage Data: Browser type, IP address, pages visited, and session duration collected for platform security and performance monitoring.",
      },
      {
        heading: "3. What We Do NOT Store",
        body: "BIMLog does not permanently store physical project files. All files uploaded through BIMLog are validated and routed to the client's designated storage environment such as Procore, OneDrive, or their designated CDE. BIMLog retains no copy of the physical file after routing is complete. BIMLog stores only the metadata, audit trail, and analytical outputs associated with each file event.",
      },
      {
        heading: "4. How We Use Your Data",
        body: "We use your data to operate and improve the BIMLog platform, send notifications you have configured, generate audit trails and compliance reports, calculate your BIMLog Performance Score, and provide customer support. We do not use your data for advertising. We do not sell your data to any third party under any circumstances.",
      },
      {
        heading: "5. How We Store and Protect Your Data",
        body: "All data is hosted on Amazon Web Services with primary infrastructure in US-East and a secondary region in South America for Latin American data residency. All data is encrypted in transit using TLS 1.3 and encrypted at rest using AES-256. Access to production data is restricted to authorized IgniteSmart engineering personnel only.",
      },
      {
        heading: "6. Data Retention",
        body: "We retain your account data for as long as your account is active. Project data and audit trails are retained for the life of the project plus seven years to support potential legal and contractual obligations of our clients. Completed projects move to read-only archive status and are never deleted. You may request export of your data at any time by contacting info@ignitesmart.ai.",
      },
      {
        heading: "7. Your Rights",
        body: "You have the right to access the personal data we hold about you, correct inaccurate data, request deletion of your account data subject to legal retention requirements, export your data in a machine-readable format, and withdraw consent for non-essential data processing. To exercise any of these rights contact info@ignitesmart.ai.",
      },
      {
        heading: "8. Third Party Services",
        body: "BIMLog uses the following third party services: Amazon Web Services for infrastructure and hosting, AI API providers for AI-powered features where only anonymized project content is processed, and Resend for transactional email delivery. Each third party is bound by a data processing agreement consistent with applicable privacy law.",
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
        body: "Datos de Cuenta: Nombre completo, dirección de correo electrónico, nombre de empresa, cargo, número de teléfono y contraseña almacenada como hash seguro. Nunca almacenamos contraseñas en texto plano.\n\nDatos de Perfil: Foto de perfil, firma digital, logo de empresa almacenados como imágenes codificadas. Cargo, número de teléfono, preferencias de notificaciones y token de API.\n\nDatos de Proyecto: Nombres de proyectos, códigos de proyectos, convenciones de nombres, metadatos de archivos incluyendo nombres de archivos, marcas de tiempo de carga, identidad del cargador, resultados de cumplimiento de convenciones, hashes criptográficos SHA-256 y declaraciones de relación de documentos. No almacenamos archivos físicos de proyecto — solo los metadatos y registros de auditoría asociados.\n\nDatos de RFI y Entregables: Datos completos del ciclo de vida de cada RFI y entregable — partes, fechas, historial de estado, registros de responsabilidad, intentos de respuesta, eventos de visualización y resultados de verificación de cumplimiento de IA.\n\nDatos de Actividad: Un registro inmutable con marca de tiempo de cada acción realizada en la plataforma por cada usuario — cargas, cambios de estado, respuestas y cambios de equipo.\n\nDatos de Uso: Tipo de navegador, dirección IP, páginas visitadas y duración de sesión recopilados para seguridad y monitoreo del rendimiento de la plataforma.",
      },
      {
        heading: "3. Lo Que NO Almacenamos",
        body: "BIMLog no almacena permanentemente archivos físicos de proyecto. Todos los archivos cargados a través de BIMLog son validados y enrutados al entorno de almacenamiento designado del cliente. BIMLog no retiene ninguna copia del archivo físico después de que el enrutamiento esté completo. BIMLog almacena solo los metadatos, la auditoría y los resultados analíticos asociados a cada evento de archivo.",
      },
      {
        heading: "4. Cómo Usamos Sus Datos",
        body: "Usamos sus datos para operar y mejorar la plataforma BIMLog, enviar notificaciones que usted haya configurado, generar registros de auditoría e informes de cumplimiento, calcular su BIMLog Performance Score y proporcionar soporte al cliente. No usamos sus datos para publicidad. No vendemos sus datos a ningún tercero bajo ninguna circunstancia.",
      },
      {
        heading: "5. Cómo Almacenamos y Protegemos Sus Datos",
        body: "Todos los datos están alojados en Amazon Web Services con infraestructura principal en US-East y una región secundaria en América del Sur para residencia de datos latinoamericanos. Todos los datos están encriptados en tránsito usando TLS 1.3 y encriptados en reposo usando AES-256. El acceso a los datos de producción está restringido al personal de ingeniería autorizado de IgniteSmart.",
      },
      {
        heading: "6. Retención de Datos",
        body: "Retenemos sus datos de cuenta mientras su cuenta esté activa. Los datos de proyecto y registros de auditoría se retienen durante la vida del proyecto más siete años para apoyar posibles obligaciones legales y contractuales de nuestros clientes. Los proyectos completados pasan a estado de archivo de solo lectura y nunca se eliminan. Puede solicitar exportar sus datos en cualquier momento contactando info@ignitesmart.ai.",
      },
      {
        heading: "7. Sus Derechos",
        body: "Tiene derecho a acceder a los datos personales que tenemos sobre usted, corregir datos inexactos, solicitar la eliminación de sus datos de cuenta sujeto a requisitos de retención legal, exportar sus datos en formato legible por máquina y retirar el consentimiento para el procesamiento de datos no esenciales. Para ejercer cualquiera de estos derechos contacte info@ignitesmart.ai.",
      },
      {
        heading: "8. Servicios de Terceros",
        body: "BIMLog utiliza los siguientes servicios de terceros: Amazon Web Services para infraestructura y alojamiento, proveedores de API de IA para funciones impulsadas por IA donde solo se procesa contenido de proyecto anonimizado, y Resend para entrega de correo electrónico transaccional. Cada tercero está sujeto a un acuerdo de procesamiento de datos consistente con la ley de privacidad aplicable.",
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
