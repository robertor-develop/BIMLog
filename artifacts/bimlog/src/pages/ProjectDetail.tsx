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
import { ChevronLeft, Shield } from "lucide-react";
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
        activeTab={tab === "submittal-tracker" ? "submittals" : tab}
        isAdmin={isAdmin}
        memberRole={memberRole}
      />

      <div className="main-area">
        <div className="project-context-bar">
          <div className="breadcrumb">
            <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 4, color: "hsl(var(--muted-foreground))", textDecoration: "none" }}>
              <ChevronLeft style={{ width: 14, height: 14 }} />
              Dashboard
            </Link>
            <span style={{ color: "hsl(var(--border))" }}>/</span>
            <span className="breadcrumb-active">{project.name}</span>
          </div>

          <div className="project-context-actions">
            <span
              className="context-chip context-chip-mono"
              title="Project Code (used in file naming)"
            >
              <span className="context-chip-label">CODE</span>
              {project.code}
            </span>

            {myRoleInfo && (
              <span
                className="context-chip"
                title={myRoleInfo.description}
              >
                <Shield style={{ width: 12, height: 12 }} />
                {myRoleInfo.label}
              </span>
            )}

            {adminMember && (
              <span
                className="context-chip context-chip-wide"
                title={adminMember.userEmail ? `Project Admin: ${adminMember.userEmail}` : "Project Admin"}
              >
                <span className="context-chip-strong">{adminMember.userFullName}</span>
                {adminMember.userCompanyName && (
                  <span className="context-chip-muted">- {adminMember.userCompanyName}</span>
                )}
                {adminMember.userEmail && (
                  <a
                    href={`mailto:${adminMember.userEmail}`}
                    className="context-chip-link"
                  >
                    - {adminMember.userEmail}
                  </a>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className="page-content">
          {tab === "coordination"   && <CoordinationHub  projectId={projectId} canWrite={canWrite} currentUserRole={memberRole} members={members ?? []} />}
          {tab === "analytics"      && <AnalyticsTab     projectId={projectId} />}
          {tab === "files"          && <FilesTab          projectId={projectId} canWrite={canWrite} />}
          {tab === "rfis"           && <RfisTab           projectId={projectId} canWrite={canWrite} />}
          {tab === "submittals"     && <SubmittalsTab     projectId={projectId} canWrite={canWrite} />}
          {tab === "submittal-tracker" && <SubmittalsTab projectId={projectId} canWrite={canWrite} initialView="tracking" />}
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
