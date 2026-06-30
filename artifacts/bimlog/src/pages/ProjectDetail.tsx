import React from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useGetProject, useListMembers } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { useConfig } from "@/lib/config-context";
import { useAuthStore } from "@/store/auth";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { FilesTab } from "./project/FilesTab";
import { RfisTab } from "./project/RfisTab";
import { SubmittalsTab } from "./project/SubmittalsTab";
import { SubmittalTrackerTab } from "./project/SubmittalTrackerTab";
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
import { ClashReportsTab } from "./project/ClashReportsTab";
import { CoordinationHub } from "./project/CoordinationHub";
import { ChevronLeft, HelpCircle, Link2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLES, getRole, type RoleKey } from "@/lib/roles";

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
  const canEditConvention = memberRole === "project_admin" || memberRole === "convention_manager";

  const adminMember = members?.find(m => m.role === "project_admin");
  const myRoleInfo = getRole(memberRole);

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
            {/* Project Code badge (Fix 3B) */}
            <span
              title="Project Code (used in file naming)"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 30, padding: "0 12px",
                fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
                background: "rgba(245,158,11,0.12)", color: "#D97706",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: 999,
              }}>
              <span style={{ fontWeight: 600, opacity: 0.7, fontFamily: "inherit" }}>CODE</span>
              {project.code}
            </span>

            {/* Role badge */}
            {myRoleInfo && (
              <span
                title={myRoleInfo.description}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  height: 30, padding: "0 10px",
                  fontSize: 11, fontWeight: 700,
                  background: myRoleInfo.badgeBg,
                  color: myRoleInfo.badgeText,
                  border: `1px solid ${myRoleInfo.badgeBg}`,
                  borderRadius: 999,
                }}>
                <Shield style={{ width: 12, height: 12 }} />
                {myRoleInfo.label}
              </span>
            )}

            {/* Admin inline card (Fix A) — visible without hover */}
            {adminMember && (
              <span
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  height: 30, padding: "0 12px",
                  fontSize: 11, fontWeight: 600,
                  background: "#F8FAFC", color: "#0F172A",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Admin
                </span>
                <span style={{ fontWeight: 700 }}>{adminMember.userFullName}</span>
                {adminMember.userCompanyName && (
                  <span style={{ color: "#64748B", fontWeight: 500 }}>· {adminMember.userCompanyName}</span>
                )}
                {adminMember.userEmail && (
                  <a
                    href={`mailto:${adminMember.userEmail}`}
                    style={{ color: "#1D4ED8", textDecoration: "none", fontWeight: 500 }}
                  >
                    · {adminMember.userEmail}
                  </a>
                )}
              </span>
            )}
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
          {tab === "coordination"   && <CoordinationHub  projectId={projectId} canWrite={canWrite} currentUserRole={memberRole} members={members ?? []} />}
          {tab === "analytics"      && <AnalyticsTab     projectId={projectId} />}
          {tab === "files"          && <FilesTab          projectId={projectId} canWrite={canWrite} />}
          {tab === "rfis"           && <RfisTab           projectId={projectId} canWrite={canWrite} />}
          {tab === "submittals"     && <SubmittalsTab     projectId={projectId} canWrite={canWrite} />}
          {tab === "submittal-tracker" && <SubmittalTrackerTab projectId={projectId} canWrite={canWrite} />}
          {tab === "activity"       && <ActivityTab       projectId={projectId} />}
          {tab === "team"           && <TeamTab           projectId={projectId} isAdmin={isAdmin} />}
          {tab === "generator"      && <NameGenerator     projectId={projectId} onGoToConvention={() => setLocation(`/projects/${projectId}/convention`)} />}
          {tab === "convention"     && (
            <ConventionBuilderErrorBoundary>
              <ConventionBuilder projectId={projectId} isAdmin={canEditConvention} currentUserRole={memberRole as RoleKey} />
            </ConventionBuilderErrorBoundary>
          )}
          {tab === "reports"        && <ReportsTab        projectId={projectId} isAdmin={isAdmin} />}
          {tab === "integrations"   && <IntegrationsTab   projectId={projectId} />}
          {tab === "directory"      && <DirectoryTab      projectId={projectId} canWrite={canWrite} />}
          {tab === "transmittals"   && <TransmittalsTab   projectId={projectId} canWrite={canWrite} />}
          {tab === "change-orders"  && <ChangeOrdersTab   projectId={projectId} canWrite={canWrite} />}
          {tab === "meetings"       && <MeetingsTab       projectId={projectId} canWrite={canWrite} />}
          {tab === "schedule"       && <ScheduleTab       projectId={projectId} canWrite={canWrite} />}
          {tab === "clash-reports"  && <ClashReportsTab    projectId={projectId} canWrite={canWrite} />}
        </div>
      </div>
    </div>
  );
}

class ConventionBuilderErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { setTimeout(() => this.setState({ hasError: false }), 100); }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
