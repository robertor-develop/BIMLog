import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { Footer } from "@/components/layout/Footer";
import { ChevronLeft } from "lucide-react";

const CONTENT = {
  en: {
    title: "Data Retention Policy",
    effectiveDate: "March 21, 2026",
    lastUpdated: "March 21, 2026",
    sections: [
      {
        heading: "1. Overview",
        body: "This Data Retention Policy explains what data BIMLog retains, for how long, and how it is managed. BIMLog is operated by BIMCapital Partners INC through its IgniteSmart technology division.",
      },
      {
        heading: "2. What BIMLog Does Not Retain",
        body: "BIMLog does not permanently store physical project files. All files uploaded through BIMLog are validated and immediately routed to the client's designated storage environment. BIMLog retains no copy of any physical file after routing is complete. This includes Revit models, Navisworks composites, AutoCAD drawings, PDFs, Word documents, Excel files, and all other file types.",
      },
      {
        heading: "3. What BIMLog Retains",
        body: "Account Data: User profiles, company profiles, authentication credentials, notification preferences, and API tokens are retained for the lifetime of the account. Upon account deletion account data is removed within 30 days subject to the exceptions below.\n\nProject Metadata: Project names, codes, settings, naming conventions, and team membership records are retained for the lifetime of the project plus seven years from the project's marked completion date.\n\nFile Metadata and Audit Records: File names, upload timestamps, uploader identity, SHA-256 hashes, document relationship declarations, convention compliance results, and content verification results are retained for the lifetime of the project plus seven years.\n\nRFI and Submittal Records: Complete lifecycle data including all status changes, responses, ball-in-court history, view events, and AI check results are retained for the lifetime of the project plus seven years.\n\nActivity Log: The immutable activity log for each project is retained permanently and is never deleted regardless of project status. This log constitutes the core audit trail of the platform.\n\nGenerated Reports: Audit Certificates, delay attribution reports, compliance summaries, and other generated documents are retained for 90 days after generation and then purged. Users are responsible for downloading and retaining copies of any generated reports they require for legal or contractual purposes.",
      },
      {
        heading: "4. Project Archive Policy",
        body: "When a project is marked as complete it moves to read-only archive status. Archived projects cannot be modified but all data, audit trails, and records remain fully accessible. Archived projects are never deleted. Project Admins and users with read access can continue to view and export data from archived projects at any time. Audit Certificates can be generated on archived projects indefinitely.",
      },
      {
        heading: "5. Account Deletion",
        body: 'When a user requests account deletion their personal profile data is removed within 30 days. However activity log entries attributed to that user within projects they participated in are retained as part of the project\'s immutable audit trail. These entries are anonymized — the user\'s name is replaced with "Deleted User" — but the actions they performed remain in the record to preserve audit trail integrity.',
      },
      {
        heading: "6. Data Export",
        body: "Users may request a full export of their personal data at any time by contacting info@ignitesmart.ai. Project data exports are available to Project Admins through the platform's built-in export functions. For bulk data exports or custom export requests contact info@ignitesmart.ai.",
      },
      {
        heading: "7. Legal Hold",
        body: "In the event of litigation, regulatory investigation, or formal legal dispute involving a project on BIMLog, BIMCapital Partners INC will place a legal hold on all data associated with that project, suspending normal retention schedules until the matter is resolved. Users should notify BIMCapital Partners INC immediately if they anticipate legal proceedings involving a BIMLog project by contacting info@ignitesmart.ai.",
      },
      {
        heading: "8. Changes to This Policy",
        body: "We may update this Data Retention Policy from time to time. We will notify registered users by email of any material changes.",
      },
      {
        heading: "9. Contact",
        body: "info@ignitesmart.ai\nBIMCapital Partners INC\n7901 4th Street North STE 300\nSt. Petersburg FL 33702",
      },
    ],
  },
  es: {
    title: "Política de Retención de Datos",
    effectiveDate: "21 de marzo de 2026",
    lastUpdated: "21 de marzo de 2026",
    sections: [
      {
        heading: "1. Descripción General",
        body: "Esta Política de Retención de Datos explica qué datos retiene BIMLog, por cuánto tiempo y cómo se gestionan. BIMLog es operado por BIMCapital Partners INC a través de su división tecnológica IgniteSmart.",
      },
      {
        heading: "2. Lo Que BIMLog No Retiene",
        body: "BIMLog no almacena permanentemente archivos físicos de proyecto. Todos los archivos cargados a través de BIMLog son validados y enrutados inmediatamente al entorno de almacenamiento designado del cliente. BIMLog no retiene ninguna copia de ningún archivo físico después de que el enrutamiento esté completo. Esto incluye modelos Revit, composites Navisworks, dibujos AutoCAD, PDFs, documentos Word, archivos Excel y todos los demás tipos de archivo.",
      },
      {
        heading: "3. Lo Que BIMLog Retiene",
        body: "Datos de Cuenta: Perfiles de usuario, perfiles de empresa, credenciales de autenticación, preferencias de notificaciones y tokens de API se retienen durante la vida útil de la cuenta. Al eliminar la cuenta, los datos de la cuenta se eliminan dentro de los 30 días sujeto a las excepciones a continuación.\n\nMetadatos de Proyecto: Nombres de proyectos, códigos, configuraciones, convenciones de nombres y registros de membresía del equipo se retienen durante la vida útil del proyecto más siete años desde la fecha de finalización marcada del proyecto.\n\nMetadatos de Archivos y Registros de Auditoría: Nombres de archivos, marcas de tiempo de carga, identidad del cargador, hashes SHA-256, declaraciones de relación de documentos, resultados de cumplimiento de convenciones y resultados de verificación de contenido se retienen durante la vida útil del proyecto más siete años.\n\nRegistros de RFI y Entregables: Datos completos del ciclo de vida incluyendo todos los cambios de estado, respuestas, historial de responsabilidad, eventos de visualización y resultados de verificación de IA se retienen durante la vida útil del proyecto más siete años.\n\nRegistro de Actividad: El registro de actividad inmutable para cada proyecto se retiene permanentemente y nunca se elimina independientemente del estado del proyecto. Este registro constituye el núcleo de la auditoría de la plataforma.\n\nInformes Generados: Certificados de Auditoría, informes de atribución de retrasos, resúmenes de cumplimiento y otros documentos generados se retienen por 90 días después de la generación y luego se purgan. Los usuarios son responsables de descargar y conservar copias de los informes generados que requieran para fines legales o contractuales.",
      },
      {
        heading: "4. Política de Archivo de Proyectos",
        body: "Cuando un proyecto se marca como completado pasa a estado de archivo de solo lectura. Los proyectos archivados no pueden ser modificados pero todos los datos, registros de auditoría y registros permanecen completamente accesibles. Los proyectos archivados nunca se eliminan. Los Administradores de Proyecto y los usuarios con acceso de lectura pueden continuar viendo y exportando datos de proyectos archivados en cualquier momento. Los Certificados de Auditoría pueden generarse en proyectos archivados indefinidamente.",
      },
      {
        heading: "5. Eliminación de Cuenta",
        body: 'Cuando un usuario solicita la eliminación de cuenta sus datos de perfil personal se eliminan dentro de los 30 días. Sin embargo, las entradas del registro de actividad atribuidas a ese usuario dentro de los proyectos en que participó se retienen como parte del registro de auditoría inmutable del proyecto. Estas entradas son anonimizadas — el nombre del usuario se reemplaza por "Usuario Eliminado" — pero las acciones que realizaron permanecen en el registro para preservar la integridad del registro de auditoría.',
      },
      {
        heading: "6. Exportación de Datos",
        body: "Los usuarios pueden solicitar una exportación completa de sus datos personales en cualquier momento contactando info@ignitesmart.ai. Las exportaciones de datos de proyectos están disponibles para los Administradores de Proyecto a través de las funciones de exportación integradas de la plataforma. Para exportaciones masivas de datos o solicitudes de exportación personalizadas contacte info@ignitesmart.ai.",
      },
      {
        heading: "7. Retención Legal",
        body: "En caso de litigio, investigación regulatoria o disputa legal formal que involucre un proyecto en BIMLog, BIMCapital Partners INC colocará una retención legal en todos los datos asociados con ese proyecto, suspendiendo los cronogramas normales de retención hasta que el asunto se resuelva. Los usuarios deben notificar a BIMCapital Partners INC inmediatamente si anticipan procedimientos legales que involucren un proyecto de BIMLog contactando info@ignitesmart.ai.",
      },
      {
        heading: "8. Cambios a Esta Política",
        body: "Podemos actualizar esta Política de Retención de Datos de vez en cuando. Notificaremos a los usuarios registrados por correo electrónico sobre cualquier cambio material.",
      },
      {
        heading: "9. Contacto",
        body: "info@ignitesmart.ai\nBIMCapital Partners INC\n7901 4th Street North STE 300\nSt. Petersburg FL 33702",
      },
    ],
  },
};

export function DataRetention() {
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
