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
import { ChevronLeft, HelpCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    </div>
  );
}
