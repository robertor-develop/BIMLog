import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";

const STORAGE_KEY = "bimlog-onboarding-done";
const API = "/api/v1";

type FlowType = "invited" | "new" | null;

interface Step {
  id: string;
  icon: string;
  titleEn: string;
  titleEs: string;
  bodyEn: string;
  bodyEs: string;
}

const STEPS_INVITED: Step[] = [
  {
    id: "welcome",
    icon: "🎉",
    titleEn: "Welcome to BIMLog",
    titleEs: "Bienvenido a BIMLog",
    bodyEn: "You've been invited to collaborate on a BIM project. BIMLog keeps every file, RFI, submittal, and coordination issue in one immutable audit trail.",
    bodyEs: "Has sido invitado a colaborar en un proyecto BIM. BIMLog mantiene cada archivo, RFI, submittal y punto de coordinación en un historial de auditoría inmutable.",
  },
  {
    id: "project",
    icon: "📁",
    titleEn: "Your Project is Ready",
    titleEs: "Tu Proyecto Está Listo",
    bodyEn: "Head to your Dashboard to see the project you've been added to. Click into it to explore files, RFIs, submittals, transmittals, and more.",
    bodyEs: "Ve a tu Dashboard para ver el proyecto al que fuiste agregado. Haz clic para explorar archivos, RFIs, submittals, transmisiones y más.",
  },
  {
    id: "naming",
    icon: "✅",
    titleEn: "ISO 19650 Naming Convention",
    titleEs: "Convención de Nombres ISO 19650",
    bodyEn: "Every file you upload is validated against the project's naming convention. Use the Name Generator tool to create compliant file names instantly.",
    bodyEs: "Cada archivo que subes es validado contra la convención del proyecto. Usa el Generador de Nombres para crear nombres de archivo conformes al instante.",
  },
  {
    id: "audit",
    icon: "🔒",
    titleEn: "Immutable Audit Trail",
    titleEs: "Historial de Auditoría Inmutable",
    bodyEn: "Every action — uploads, approvals, comments, supersessions — is permanently logged. Nothing can be deleted. This protects you legally.",
    bodyEs: "Cada acción — subidas, aprobaciones, comentarios, supersesiones — queda registrada permanentemente. Nada puede eliminarse. Esto te protege legalmente.",
  },
  {
    id: "done",
    icon: "🚀",
    titleEn: "You're All Set!",
    titleEs: "¡Todo Listo!",
    bodyEn: "You're ready to use BIMLog. If you need help, click the Help button in any project view. Welcome to the team!",
    bodyEs: "Estás listo para usar BIMLog. Si necesitas ayuda, haz clic en Ayuda en cualquier vista de proyecto. ¡Bienvenido al equipo!",
  },
];

const STEPS_NEW: Step[] = [
  {
    id: "welcome",
    icon: "👋",
    titleEn: "Welcome to BIMLog by IgniteSmart",
    titleEs: "Bienvenido a BIMLog by IgniteSmart",
    bodyEn: "BIMLog is the intelligence layer for AEC project coordination — ISO 19650 compliant naming, immutable audit trails, RFIs, submittals, transmittals, and AI-powered insights.",
    bodyEs: "BIMLog es la capa de inteligencia para coordinación de proyectos AEC — nombres conformes ISO 19650, historial inmutable, RFIs, submittals, transmisiones e insights con IA.",
  },
  {
    id: "create",
    icon: "🏗️",
    titleEn: "Create Your First Project",
    titleEs: "Crea Tu Primer Proyecto",
    bodyEn: "From your Dashboard, click \"New Project\" and enter a project code and name. The project code should follow your organisation's prefix convention (e.g. NYC-270).",
    bodyEs: "Desde tu Dashboard, haz clic en \"Nuevo Proyecto\" e ingresa un código y nombre. El código debe seguir la convención de prefijos de tu organización (p.ej. NYC-270).",
  },
  {
    id: "convention",
    icon: "📐",
    titleEn: "Configure Naming Convention",
    titleEs: "Configura la Convención de Nombres",
    bodyEn: "Go to your project → Tools → Naming Convention to set up ISO 19650-compliant naming rules. This governs every file uploaded to the project.",
    bodyEs: "Ve a tu proyecto → Herramientas → Convención de Nombres para configurar reglas ISO 19650. Esto rige cada archivo subido al proyecto.",
  },
  {
    id: "team",
    icon: "👥",
    titleEn: "Invite Your Team",
    titleEs: "Invita a Tu Equipo",
    bodyEn: "In your project, go to the Team tab to add members. You can assign roles: Project Admin, BIM Manager, Document Controller, Engineer, Architect, or Viewer.",
    bodyEs: "En tu proyecto, ve a la pestaña Equipo para agregar miembros. Puedes asignar roles: Admin, BIM Manager, Controlador de Documentos, Ingeniero, Arquitecto o Viewer.",
  },
  {
    id: "modules",
    icon: "📦",
    titleEn: "Explore the Modules",
    titleEs: "Explora los Módulos",
    bodyEn: "BIMLog includes Files, RFIs, Submittals, Transmittals, Change Orders, Meeting Minutes, Schedule, Directory, and AI Reports — everything you need for project coordination.",
    bodyEs: "BIMLog incluye Archivos, RFIs, Submittals, Transmisiones, Órdenes de Cambio, Actas, Cronograma, Directorio y Reportes IA — todo para coordinar tu proyecto.",
  },
  {
    id: "done",
    icon: "✨",
    titleEn: "You're Ready to Build!",
    titleEs: "¡Listo para Construir!",
    bodyEn: "Your workspace is set up. Head to the Dashboard to create your first project. Remember: every action is logged permanently — so work with confidence.",
    bodyEs: "Tu espacio de trabajo está configurado. Ve al Dashboard para crear tu primer proyecto. Recuerda: cada acción se registra permanentemente — trabaja con confianza.",
  },
];

export function OnboardingFlow({ onDone }: { onDone: () => void }) {
  const { lang } = useI18n();
  const { user, token } = useAuthStore();
  const tl = (en: string, es: string) => lang === "es" ? es : en;

  const [flowType, setFlowType] = useState<FlowType>(null);
  const [step, setStep] = useState(0);
  const [hasProjects, setHasProjects] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/projects`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then((projects: unknown[]) => {
        const inProject = Array.isArray(projects) && projects.length > 0;
        setHasProjects(inProject);
        setFlowType(inProject ? "invited" : "new");
      })
      .catch(() => setFlowType("new"));
  }, [token]);

  if (!flowType) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
        <div style={{ background: "white", borderRadius: 16, padding: 40, width: 360, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚡</div>
          <div style={{ color: "#6B7280", fontSize: 13 }}>{tl("Loading…", "Cargando…")}</div>
        </div>
      </div>
    );
  }

  const steps = flowType === "invited" ? STEPS_INVITED : STEPS_NEW;
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const pct = Math.round(((step + 1) / steps.length) * 100);

  const complete = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    onDone();
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000,
    }}>
      <div style={{
        background: "white", borderRadius: 20, width: 480, maxWidth: "92vw",
        overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
      }}>
        {/* Top progress bar */}
        <div style={{ height: 4, background: "#E5E7EB" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "#2563EB", transition: "width 0.4s ease" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px 0" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                background: i <= step ? "#2563EB" : "#E5E7EB", transition: "all 0.3s",
              }} />
            ))}
          </div>
          <button
            onClick={complete}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9CA3AF", fontWeight: 500 }}
          >
            {tl("Skip", "Omitir")}
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "28px 32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 52, marginBottom: 16, lineHeight: 1 }}>{current.icon}</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 12, lineHeight: 1.3 }}>
            {tl(current.titleEn, current.titleEs)}
          </h2>
          <p style={{ fontSize: 14, color: "#4B5563", lineHeight: 1.7, margin: 0 }}>
            {tl(current.bodyEn, current.bodyEs)}
          </p>

          {/* Step indicator */}
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 20 }}>
            {tl(`Step ${step + 1} of ${steps.length}`, `Paso ${step + 1} de ${steps.length}`)}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "0 32px 28px", display: "flex", gap: 10 }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                flex: 1, padding: "10px 0", border: "1.5px solid #E5E7EB", borderRadius: 9,
                background: "white", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151",
              }}
            >
              {tl("Back", "Atrás")}
            </button>
          )}
          <button
            onClick={() => isLast ? complete() : setStep(s => s + 1)}
            style={{
              flex: 2, padding: "10px 0", border: "none", borderRadius: 9,
              background: "#2563EB", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "white",
            }}
          >
            {isLast
              ? tl("Go to Dashboard →", "Ir al Dashboard →")
              : tl("Next →", "Siguiente →")}
          </button>
        </div>

        {/* Flow label */}
        <div style={{ textAlign: "center", padding: "0 0 16px", fontSize: 10, color: "#D1D5DB" }}>
          {flowType === "invited"
            ? tl("Invited user onboarding", "Onboarding de usuario invitado")
            : tl("New account onboarding", "Onboarding de cuenta nueva")}
        </div>
      </div>
    </div>
  );
}

export function useOnboarding() {
  const { token } = useAuthStore();
  const isDone = () => !!localStorage.getItem(STORAGE_KEY);
  return { shouldShow: !!token && !isDone(), markDone: () => localStorage.setItem(STORAGE_KEY, "1") };
}
