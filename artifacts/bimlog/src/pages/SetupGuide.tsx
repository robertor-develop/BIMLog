import { Link } from "wouter";
import { ChevronLeft, UserPlus, Settings2, Wand2, Upload, MessageSquare, Puzzle, Monitor, Mic } from "lucide-react";
import { useState } from "react";
import { Footer } from "@/components/layout/Footer";

function useFromParam(): string | null {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  return params.get("from");
}

const sections = [
  {
    id: "getting-started",
    icon: UserPlus,
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    title: "Getting Started",
    steps: [
      {
        label: "Create your account",
        desc: "Go to the BIMLog landing page and click Get Started. Enter your name, company name, email, and a password. No credit card required — your first project is free.",
      },
      {
        label: "Create your first project",
        desc: "After logging in, click New Project on the Dashboard. Enter a project name, a short unique code (e.g. NYC-270), and an optional description. The project is created instantly.",
      },
      {
        label: "Invite your team",
        desc: "Open your project and go to the Team tab. Enter a team member's email and assign their role — Drafter, Coordinator, BIM Manager, or Project Admin. They receive access immediately after registering.",
      },
    ],
  },
  {
    id: "convention-builder",
    icon: Settings2,
    iconBg: "#F0FDF4",
    iconColor: "#16A34A",
    title: "Convention Builder",
    steps: [
      {
        label: "Define your naming fields",
        desc: "Go to Convention Builder in the left sidebar. Add fields in order — for example: Project Code, Originator, Volume, Level, File Type, Role, Sequence Number. Each field becomes a segment in your final file name.",
      },
      {
        label: "Set allowed values",
        desc: "For each field, enter the list of allowed values separated by commas (e.g. A, B, C, D for Level). Only these values will be accepted. Any other value causes an automatic rejection.",
      },
      {
        label: "Choose a separator",
        desc: "Select the character that separates each field in the file name — typically a hyphen (-) or underscore (_). The separator applies consistently across all fields.",
      },
      {
        label: "Activate enforcement",
        desc: "Toggle the convention to Active. From this point forward, every file uploaded to the project is validated against this convention. Files that do not conform are rejected with a field-level breakdown of the violations.",
      },
    ],
  },
  {
    id: "name-generator",
    icon: Wand2,
    iconBg: "#FFF7ED",
    iconColor: "#C2410C",
    title: "Name Generator",
    steps: [
      {
        label: "Open the Name Generator",
        desc: "Go to the Name Generator tab in the left sidebar. This tool reads your active naming convention and builds the file name field by field — no free-text entry allowed.",
      },
      {
        label: "Select a value for each field",
        desc: "Use the dropdown for each field to select the correct value. Only allowed values appear in the dropdown. You cannot type a free value.",
      },
      {
        label: "Copy the generated name",
        desc: "Once all fields are filled, the compliant file name appears at the bottom. Click Copy to copy it to your clipboard. Use this name when saving your file before uploading.",
      },
    ],
  },
  {
    id: "uploading-files",
    icon: Upload,
    iconBg: "#F5F3FF",
    iconColor: "#7C3AED",
    title: "Uploading Files",
    steps: [
      {
        label: "Upload through BIMLog",
        desc: "Go to the Files tab and click Upload File, or use the Upload File button in the top bar. Enter the file name and select the file. BIMLog validates the name against your active convention before accepting it.",
      },
      {
        label: "What happens when a file is rejected",
        desc: "If the file name does not comply, the upload is blocked immediately. No file is stored. You see a rejection notice explaining exactly which field failed and why.",
      },
      {
        label: "Read the field-level error breakdown",
        desc: "The rejection panel shows each field that failed — the field name, the value you provided, and the allowed values. Fix the file name and re-upload. The activity log records every attempt, including rejections.",
      },
    ],
  },
  {
    id: "rfis-submittals",
    icon: MessageSquare,
    iconBg: "#FFFBEB",
    iconColor: "#D97706",
    title: "RFIs and Submittals",
    steps: [
      {
        label: "Create and track RFIs",
        desc: "Go to the RFIs tab and click New RFI. Enter a subject, description, priority, and assigned person. Each RFI gets a unique number automatically.",
      },
      {
        label: "Create and track Submittals",
        desc: "Go to the Submittals tab and click New Submittal. Enter the title, specification section, revision, and assigned reviewer. Each submittal follows a defined review workflow.",
      },
      {
        label: "ISO 19650 status workflow",
        desc: "Both RFIs and Submittals follow the ISO 19650 status cycle: Open → In Review → Responded / Approved / Rejected / Resubmit Required. Each status change is logged with a timestamp and the responsible user.",
      },
      {
        label: "Escalation notifications",
        desc: "Items approaching their due date generate escalation alerts visible in the project dashboard. Overdue items are flagged automatically so nothing is missed.",
      },
    ],
  },
  {
    id: "audio-transcription",
    icon: Mic,
    iconBg: "#F0F7FF",
    iconColor: "#1E40AF",
    title: "Audio Transcription — Meeting Minutes",
    steps: [
      {
        label: "Audio Transcription — Meeting Minutes",
        desc: "Upload a recording of your coordination meeting and BIMLog will automatically fill in the attendees, agenda, RFIs, deliverables, viewpoints, and action items using AI.\n\nRequires your own OpenAI API key — add it once in your Profile. Cost: approximately $0.006 per minute of audio (~$0.36 per hour). You pay OpenAI directly. BIMLog does not charge for transcription.\n\nSupported formats: MP3, MP4, M4A, WAV, WebM, OGG. Maximum 25MB per file.\n\nTo get started: Profile → OpenAI API Key → paste your key → Save.",
      },
    ],
  },
  {
    id: "integrations",
    icon: Puzzle,
    iconBg: "#E0F2FE",
    iconColor: "#0369A1",
    title: "Integrations",
    options: [
      {
        title: "Validate and Download",
        badge: "Free",
        desc: "Upload your file through BIMLog. We validate it instantly and return the approved file with a full audit record. You then upload it yourself to Procore, OneDrive, Google Drive, or wherever your project lives. Works today. Zero setup required.",
      },
      {
        title: "BIMLog Sync Agent",
        badge: "Professional",
        desc: "A lightweight desktop app watches a folder on your computer or server. Drop any file into the folder and BIMLog validates and routes it to the right platform automatically. No manual upload, no API setup, just a folder you already know how to use.",
      },
      {
        title: "Managed Connection",
        badge: "Team and up",
        desc: "Our team logs in on your behalf using your API token or credentials and configures the connection for you. White-glove setup is included with founding partner onboarding. Contact info@ignitesmart.ai.",
      },
      {
        title: "OAuth Connection",
        badge: "Business and up",
        desc: "You log in with your own credentials through a secure window. We never see your password. BIMLog receives a secure token and delivers your files automatically to the right project. Available on Business plans and up.",
      },
    ],
    note: "For Managed and OAuth connections, contact info@ignitesmart.ai.",
  },
];

function SyncAgentDownload() {
  return (
    <div style={{
      marginTop: 14, padding: "12px 16px",
      background: "#F5F3FF", border: "1px solid #DDD6FE",
      borderRadius: 8, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
    }}>
      <Monitor style={{ width: 16, height: 16, color: "#7C3AED", flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#5B21B6" }}>BIMLog Sync Agent — Desktop App</div>
        <div style={{ fontSize: 11, color: "#6D28D9" }}>Windows · Watch a folder, validate automatically</div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a
          href="/api/v1/downloads/sync-agent-windows"
          download="BIMLog-Sync-Agent-Windows-Portable.zip"
          style={{
            padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "#7C3AED", color: "#fff", border: "none", cursor: "pointer",
            textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5,
          }}
        >
          ⬇ Windows Portable (ZIP)
        </a>
        <a
          href="mailto:info@ignitesmart.ai?subject=BIMLog%20Sync%20Agent%20Mac%20Installer&body=Hello%2C%0A%0AI%20would%20like%20to%20receive%20the%20BIMLog%20Sync%20Agent%20installer%20for%20Mac."
          style={{
            padding: "6px 14px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: "#EDE9FE", color: "#7C3AED",
            border: "1px solid #DDD6FE", cursor: "pointer",
            textDecoration: "none", display: "inline-flex", alignItems: "center",
          }}
        >
          Mac — Coming Soon
        </a>
      </div>
    </div>
  );
}

function SetupGuideBackButton() {
  const from = useFromParam();
  if (from) {
    return (
      <Link
        href={from}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "hsl(var(--muted-foreground))", textDecoration: "none", marginBottom: 20 }}
      >
        <ChevronLeft style={{ width: 14, height: 14 }} />
        Back to Project
      </Link>
    );
  }
  return (
    <Link
      href="/dashboard"
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "hsl(var(--muted-foreground))", textDecoration: "none", marginBottom: 20 }}
    >
      <ChevronLeft style={{ width: 14, height: 14 }} />
      Back to Dashboard
    </Link>
  );
}

export function SetupGuide() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
    <div style={{ maxWidth: 820, margin: "0 auto", padding: "28px 24px", flex: 1, width: "100%" }}>
      {/* Back */}
      <SetupGuideBackButton />

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700,
          color: "hsl(var(--foreground))", marginBottom: 6,
        }}>
          How It Works
        </h1>
        <p style={{ fontSize: 13, color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>
          Everything you need to get BIMLog running on your project — from account setup to integrations.
        </p>
      </div>

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sections.map((section, idx) => {
          const Icon = section.icon;
          const isOpen = activeSection === section.id;

          return (
            <div
              key={section.id}
              className="card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              {/* Section header — clickable */}
              <button
                onClick={() => setActiveSection(isOpen ? null : section.id)}
                style={{
                  width: "100%", padding: "16px 20px",
                  display: "flex", alignItems: "center", gap: 14,
                  background: "none", border: "none", cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 9,
                  background: section.iconBg, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon style={{ width: 17, height: 17, color: section.iconColor }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))",
                      fontFamily: "var(--font-mono)",
                    }}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span style={{
                      fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600,
                      color: "hsl(var(--foreground))",
                    }}>
                      {section.title}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: 16, color: "hsl(var(--muted-foreground))", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                  ▾
                </span>
              </button>

              {/* Section content */}
              {isOpen && (
                <div style={{
                  padding: "0 20px 18px",
                  borderTop: "1px solid hsl(var(--border))",
                  paddingTop: 16,
                }}>
                  {"steps" in section && section.steps?.map((step, si) => (
                    <div key={si} style={{ display: "flex", gap: 14, marginBottom: si < section.steps!.length - 1 ? 14 : 0 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%",
                        background: section.iconBg, color: section.iconColor,
                        fontSize: 10, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, marginTop: 1,
                      }}>
                        {si + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 3 }}>
                          {step.label}
                        </div>
                        <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>
                          {step.desc}
                        </div>
                      </div>
                    </div>
                  ))}

                  {"options" in section && section.options?.map((opt, oi) => (
                    <div
                      key={oi}
                      style={{
                        padding: "12px 14px", borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--background))",
                        marginBottom: oi < section.options!.length - 1 ? 8 : 0,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "hsl(var(--foreground))" }}>
                          {opt.title}
                        </span>
                        {opt.badge && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, textTransform: "uppercase",
                            letterSpacing: "0.06em", padding: "1px 6px", borderRadius: 4,
                            background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0",
                          }}>
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>
                        {opt.desc}
                      </div>
                    </div>
                  ))}

                  {"options" in section && <SyncAgentDownload />}

                  {"note" in section && section.note && (
                    <div style={{ marginTop: 12, fontSize: 11, color: "hsl(var(--muted-foreground))", lineHeight: 1.5 }}>
                      {section.note}{" "}
                      <a href="mailto:info@ignitesmart.ai" style={{ color: "#0369A1" }}>info@ignitesmart.ai</a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 24, padding: "14px 18px",
        background: "#F0F7FF", border: "1px solid #BFDBFE",
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8", marginBottom: 3 }}>
          Need help?
        </div>
        <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>
          Contact the IgniteSmart team at{" "}
          <a href="mailto:info@ignitesmart.ai" style={{ color: "#2563EB", fontWeight: 600 }}>
            info@ignitesmart.ai
          </a>
          {" "}— we respond within one business day.
        </div>
      </div>
    </div>
    <Footer />
    </div>
  );
}
