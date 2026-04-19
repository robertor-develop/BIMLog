import { Link, useRoute, useLocation } from "wouter";
import { useGetProject, useListMembers } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { useAuthStore } from "@/store/auth";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { FilesTab } from "./project/FilesTab";
import { RfisTab } from "./project/RfisTab";
import { SubmittalsTab } from "./project/SubmittalsTab";
import { ActivityTab } from "./project/ActivityTab";
import { TeamTab } from "./project/TeamTab";
import { ConventionBuilder } from "./project/ConventionBuilder";
import { NameGenerator } from "./project/NameGenerator";
import { AnalyticsTab } from "./project/AnalyticsTab";
import { IntegrationsTab } from "./project/IntegrationsTab";
import { ReportsTab } from "./project/ReportsTab";
import { DirectoryTab } from "./project/DirectoryTab";
import { TransmittalsTab } from "./project/TransmittalsTab";
import { ChangeOrdersTab } from "./project/ChangeOrdersTab";
import { MeetingsTab } from "./project/MeetingsTab";
import { ScheduleTab } from "./project/ScheduleTab";
import { CoordinationHub } from "./project/CoordinationHub";
import { ChevronLeft, HelpCircle, Link2, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export function ProjectDetail() {
  const [, params] = useRoute("/projects/:id/:tab");
  const projectId = params?.id ? parseInt(params.id) : 0;
  const tab = params?.tab || "analytics";

  const [, setLocation] = useLocation();
  const { t } = useI18n();
  const { user } = useAuthStore();
  const { adminRoles, writeRoles } = useConfig();

  const { data: project, isLoading } = useGetProject(projectId);
  const { data: members } = useListMembers(projectId);

  const currentMember = members?.find(m => m.userId === user?.id);
  const memberRole = currentMember?.role || "";
  const isAdmin = adminRoles.includes(memberRole);
  const canWrite = writeRoles.includes(memberRole);

  // ── Issue 10: First-visit onboarding overlay ─────────────────────────────
  const onboardingKey = user?.id && projectId ? `bimlog_onboarding_${user.id}_${projectId}` : "";
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(true);
  useEffect(() => {
    if (!onboardingKey) return;
    try {
      if (!localStorage.getItem(onboardingKey)) {
        setShowOnboarding(true);
      }
    } catch { /* localStorage may be unavailable */ }
  }, [onboardingKey]);
  const closeOnboarding = () => {
    if (dontShowAgain && onboardingKey) {
      try { localStorage.setItem(onboardingKey, new Date().toISOString()); } catch { /* noop */ }
    }
    setShowOnboarding(false);
  };

  if (isLoading) {
    return (
      <div className="app-shell">
        <div className="sidebar" />
        <div className="main-area">
          <div className="page-content">
            <div className="skeleton" style={{ height: 20, width: 200, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 40, width: 320 }} />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="app-shell">
        <div className="main-area">
          <div className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "hsl(var(--muted-foreground))", marginBottom: 16 }}>{t("project.notFound")}</p>
              <Link href="/dashboard"><Button variant="outline" size="sm">Back to Dashboard</Button></Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <ProjectSidebar
        projectId={projectId}
        projectCode={project.code}
        projectName={project.name}
        projectDesc={project.description ?? undefined}
        activeTab={tab}
        isAdmin={isAdmin}
        memberRole={memberRole}
      />

      <div className="main-area">
        {/* Top bar */}
        <div className="topbar">
          <div className="breadcrumb">
            <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 4, color: "hsl(var(--muted-foreground))", textDecoration: "none" }}>
              <ChevronLeft style={{ width: 14, height: 14 }} />
              Dashboard
            </Link>
            <span style={{ color: "hsl(var(--border))" }}>/</span>
            <span className="breadcrumb-active">{project.name}</span>
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-flex", alignItems: "center",
              height: 30, padding: "0 12px",
              fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
              background: "rgba(245,158,11,0.12)", color: "#D97706",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 999,
            }}>{project.code}</span>
            <Link href={`/setup-guide?from=${encodeURIComponent(`/projects/${projectId}/${tab}`)}`}>
              <button style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                height: 30, padding: "0 12px", borderRadius: 6,
                fontSize: 11, fontWeight: 600,
                color: "hsl(var(--muted-foreground))",
                background: "hsl(var(--secondary))",
                border: "1px solid hsl(var(--border))",
                cursor: "pointer",
              }}>
                <HelpCircle style={{ width: 13, height: 13 }} />
                Help
              </button>
            </Link>
          </div>
        </div>

        {/* Tab content */}
        <div className="page-content">
          {tab === "coordination"   && <CoordinationHub  projectId={projectId} canWrite={canWrite} />}
          {tab === "analytics"      && <AnalyticsTab     projectId={projectId} />}
          {tab === "files"          && <FilesTab          projectId={projectId} canWrite={canWrite} />}
          {tab === "rfis"           && <RfisTab           projectId={projectId} canWrite={canWrite} />}
          {tab === "submittals"     && <SubmittalsTab     projectId={projectId} canWrite={canWrite} />}
          {tab === "activity"       && <ActivityTab       projectId={projectId} />}
          {tab === "team"           && <TeamTab           projectId={projectId} isAdmin={isAdmin} />}
          {tab === "generator"      && <NameGenerator     projectId={projectId} onGoToConvention={() => setLocation(`/projects/${projectId}/convention`)} />}
          {tab === "convention"     && <ConventionBuilder projectId={projectId} isAdmin={isAdmin} />}
          {tab === "reports"        && <ReportsTab        projectId={projectId} isAdmin={isAdmin} />}
          {tab === "integrations"   && <IntegrationsTab   projectId={projectId} />}
          {tab === "directory"      && <DirectoryTab      projectId={projectId} canWrite={canWrite} />}
          {tab === "transmittals"   && <TransmittalsTab   projectId={projectId} canWrite={canWrite} />}
          {tab === "change-orders"  && <ChangeOrdersTab   projectId={projectId} canWrite={canWrite} />}
          {tab === "meetings"       && <MeetingsTab       projectId={projectId} canWrite={canWrite} />}
          {tab === "schedule"       && <ScheduleTab       projectId={projectId} canWrite={canWrite} />}
          {tab === "clash-reports"  && (
            <div style={{ textAlign: "center", padding: "80px 40px" }}>
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "center" }}><Link2 style={{ width: 52, height: 52, color: "#D1D5DB" }} /></div>
              <h2 style={{ fontWeight: 800, fontSize: 20, color: "#111827", marginBottom: 8 }}>Clash Reports</h2>
              <div style={{
                display: "inline-block", padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A", marginBottom: 16,
              }}>Coming Soon</div>
              <p style={{ fontSize: 14, color: "#6B7280", maxWidth: 440, margin: "0 auto 24px", lineHeight: 1.7 }}>
                Clash Detection Integration — automated detection of geometric conflicts
                across Revit, IFC, and NWD models. Full audit trail with resolution tracking.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {["Revit Integration", "IFC Support", "NWD/NWC", "Auto-grouping", "Resolution Workflow", "PDF Reports"].map(f => (
                  <span key={f} style={{ padding: "5px 12px", background: "#F3F4F6", borderRadius: 20, fontSize: 12, color: "#374151", border: "1px solid #E5E7EB" }}>{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Issue 10: First-visit onboarding overlay ───────────────────── */}
      {showOnboarding && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closeOnboarding}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 12,
              maxWidth: 560, width: "100%",
              maxHeight: "90vh", overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <div style={{
              padding: "18px 22px",
              borderBottom: "1px solid hsl(var(--border))",
              display: "flex", alignItems: "center", gap: 10,
              background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
              borderTopLeftRadius: 12, borderTopRightRadius: 12,
            }}>
              <Sparkles style={{ width: 20, height: 20, color: "#1D4ED8", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1E3A8A" }}>
                  Welcome to {project.name}
                </div>
                <div style={{ fontSize: 12, color: "#1E40AF", marginTop: 2 }}>
                  Here's how BIMLog helps you coordinate this project.
                </div>
              </div>
              <button
                type="button"
                onClick={closeOnboarding}
                aria-label="Close"
                style={{
                  padding: 6, border: "none", background: "transparent",
                  cursor: "pointer", color: "#1E40AF",
                  display: "flex", alignItems: "center", borderRadius: 6,
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { n: 1, title: "Set up your naming convention", body: "Use Convention Builder to define how every file in this project should be named." },
                { n: 2, title: "Use Coordination Hub to intake files from all trades", body: "BIMLog reads and renames them automatically to match your convention." },
                { n: 3, title: "Check Analytics for compliance and file health", body: "Track adoption, naming compliance, and overall project file quality." },
                { n: 4, title: "Use Files for manual file name validation", body: "Validate, rename, and manage individual files with full version history." },
                { n: 5, title: "Use Reports for PDF exports", body: "Generate audit-ready reports for stakeholders, owners, and regulators." },
              ].map(s => (
                <div key={s.n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    flexShrink: 0, width: 28, height: 28, borderRadius: "50%",
                    background: "#1D4ED8", color: "white",
                    fontSize: 13, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{s.n}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: "#4B5563", marginTop: 2, lineHeight: 1.5 }}>{s.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              padding: "14px 22px",
              borderTop: "1px solid hsl(var(--border))",
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              background: "hsl(var(--secondary))",
              borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "hsl(var(--muted-foreground))", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={e => setDontShowAgain(e.target.checked)}
                  style={{ width: 14, height: 14, cursor: "pointer" }}
                />
                Don't show this again
              </label>
              <Button onClick={closeOnboarding} size="sm" style={{ fontSize: 12 }}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
