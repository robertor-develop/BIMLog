import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";

const STORAGE_KEY = "bimlog_guide_enabled";

const TIPS: Record<string, { title: string; body: string; nextStep?: string }> = {
  coordination: {
    title: "Coordination Hub",
    body: "You are in the Coordination Hub. Drop any file here — BIMLog reads it, understands the content, and proposes the correct name based on your active convention. Review the proposal, confirm or adjust, then download the renamed file. Everything is logged automatically.",
    nextStep: "sube tu primer archivo de prueba para ver el análisis AI en acción.",
  },
  convention: {
    title: "Convention Builder",
    body: "You are in Convention Builder. Define your naming convention here — choose your separator, add your fields, and set the allowed values for each field. When done, save and activate. Only project admins can edit the convention. All other modules use this convention as their source of truth.",
    nextStep: "activa tu convención para que el Coordination Hub pueda analizar archivos.",
  },
  generator: {
    title: "Name Generator",
    body: "You are in the Name Generator. Select values for each field to manually build a compliant file name. All options come from your active convention. Use this when you already know what you want to name a file and just need to build it quickly.",
  },
  files: {
    title: "Files",
    body: "You are in Files. Upload a file here to check whether its existing name passes your active convention. This module validates names only — it does not rename or store files. Use Coordination Hub if you want BIMLog to rename the file for you.",
    nextStep: "confirma un archivo en Coordination Hub y aparecerá aquí automáticamente.",
  },
  analytics: {
    title: "Analytics",
    body: "You are in Analytics. This dashboard shows your project naming compliance in real time. Files processed through Coordination Hub and Files both feed into these charts. No data here means no files have been processed yet.",
    nextStep: "cuando tengas 5+ archivos confirmados, revisa los patrones de actividad.",
  },
  rfis: {
    title: "RFIs",
    body: "You are in RFIs. Create and track Requests for Information here. RFIs have a ball-in-court system that tracks who is responsible for the next action and timestamps every response. Overdue RFIs appear in red.",
  },
  submittals: {
    title: "Submittals",
    body: "You are in Submittals. Track all submittals here with status, reviewer, and due dates. Submittals feed into the compliance dashboard and delay attribution engine.",
  },
  transmittals: {
    title: "Transmittals",
    body: "You are in Transmittals. Formal document transmittal records with acknowledgement tracking. Every file sent to external parties should have a transmittal.",
  },
  reports: {
    title: "Reports",
    body: "You are in Reports. Generate PDF exports of your project data here — compliance reports, RFI logs, submittal status, meeting minutes, and more. All reports pull from live production data.",
    nextStep: "genera tu primer reporte después de tener 10+ archivos confirmados.",
  },
  activity: {
    title: "Activity Log",
    body: "You are in the Activity Log. Every event on this project is permanently and immutably recorded here — file uploads, renames, RFI actions, convention changes, everything. This log cannot be edited or deleted.",
  },
  directory: {
    title: "Project Directory",
    body: "You are in the Project Directory. All team members and stakeholders on this project appear here automatically from the project team. You can also add additional contacts manually.",
    nextStep: "invita a tus subcontratistas con rol Sub-trade para que puedan subir archivos.",
  },
  team: {
    title: "Team",
    body: "You are in the Team page. Manage project members and their roles here. Each role controls what the user can do — see role descriptions on hover.",
    nextStep: "asigna un Convention Manager si quieres delegar la gestión de convenciones.",
  },
  meetings: {
    title: "Meetings",
    body: "You are in Meetings. Record meeting minutes here with attendees, agenda items, and action items. Meeting records are linked to the project timeline.",
  },
  schedule: {
    title: "Schedule",
    body: "You are in Schedule. Import your MS Project file to activate delay attribution tracking. BIMLog will classify delays by responsible party based on RFI response times and ball-in-court history.",
  },
};

const DEFAULT_TIP = {
  title: "Smart Guide",
  body: "Select a module from the sidebar to get started. Coordination Hub is the recommended starting point for new projects — it is where files come in and get normalized to your naming convention.",
} as { title: string; body: string; nextStep?: string };

export function SmartGuide({ activeTab }: { activeTab: string }) {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) return true;
      return stored === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(isOpen));
    } catch {
      /* localStorage may be unavailable */
    }
  }, [isOpen]);

  const tip = TIPS[activeTab] ?? DEFAULT_TIP;

  return (
    <>
      {isOpen && (
        <div
          role="dialog"
          aria-label={`Smart Guide — ${tip.title}`}
          style={{
            position: "fixed",
            left: 24,
            bottom: 80,
            zIndex: 1000,
            width: 320,
            maxWidth: "calc(100vw - 48px)",
            background: "white",
            border: "1px solid hsl(var(--border))",
            borderRadius: 12,
            boxShadow: "0 20px 40px -12px rgba(15, 23, 42, 0.25)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
              borderBottom: "1px solid hsl(var(--border))",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <HelpCircle style={{ width: 16, height: 16, color: "#1D4ED8", flexShrink: 0 }} />
            <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: "#1E3A8A" }}>{tip.title}</div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close guide"
              style={{
                padding: 4,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "#1E40AF",
                display: "flex",
                alignItems: "center",
                borderRadius: 4,
              }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <div style={{ padding: "12px 14px", fontSize: 12, color: "#374151", lineHeight: 1.55 }}>
            {tip.body}
          </div>
          {tip.nextStep && (
            <div
              style={{
                padding: "10px 14px",
                fontSize: 11,
                color: "#1D4ED8",
                borderTop: "1px solid hsl(var(--border))",
                background: "#F8FAFC",
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontWeight: 700 }}>Próximo paso:</span> {tip.nextStep}
            </div>
          )}
          <div
            style={{
              padding: "8px 14px 10px",
              fontSize: 10,
              color: "hsl(var(--muted-foreground))",
              borderTop: "1px solid hsl(var(--border))",
              background: "hsl(var(--secondary))",
            }}
          >
            Click Guide anytime to bring this back.
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        aria-label={isOpen ? "Close guide" : "Open guide"}
        aria-pressed={isOpen}
        style={{
          position: "fixed",
          left: 24,
          bottom: 24,
          zIndex: 1000,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "10px 14px",
          height: 40,
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          background: isOpen ? "#2563EB" : "white",
          color: isOpen ? "white" : "#1D4ED8",
          border: isOpen ? "1px solid #1D4ED8" : "1px solid hsl(var(--border))",
          boxShadow: "0 10px 25px -8px rgba(15, 23, 42, 0.25)",
        }}
      >
        <HelpCircle style={{ width: 16, height: 16 }} />
        Guide
      </button>
    </>
  );
}
