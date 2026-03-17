import { Link, useRoute } from "wouter";
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
import { ChevronLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ProjectDetail() {
  const [, params] = useRoute("/projects/:id/:tab");
  const projectId = params?.id ? parseInt(params.id) : 0;
  const tab = params?.tab || "analytics";

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
              fontSize: 10, fontWeight: 700, fontFamily: "var(--font-mono)",
              background: "rgba(245,158,11,0.1)", color: "#D97706",
              border: "1px solid rgba(245,158,11,0.25)",
              padding: "3px 10px", borderRadius: 5
            }}>{project.code}</span>
            <Link href={`/setup-guide?from=${encodeURIComponent(`/projects/${projectId}/${tab}`)}`}>
              <button style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px", borderRadius: 6,
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
            {canWrite && (
              <Link href={`/projects/${projectId}/files`}>
                <Button size="sm" style={{ fontSize: 12 }}>+ Upload File</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className="page-content">
          {tab === "analytics"    && <AnalyticsTab     projectId={projectId} />}
          {tab === "files"        && <FilesTab          projectId={projectId} canWrite={canWrite} />}
          {tab === "rfis"         && <RfisTab           projectId={projectId} canWrite={canWrite} />}
          {tab === "submittals"   && <SubmittalsTab     projectId={projectId} canWrite={canWrite} />}
          {tab === "activity"     && <ActivityTab       projectId={projectId} />}
          {tab === "team"         && <TeamTab           projectId={projectId} isAdmin={isAdmin} />}
          {tab === "generator"    && <NameGenerator     projectId={projectId} />}
          {tab === "convention"   && isAdmin && <ConventionBuilder projectId={projectId} />}
          {tab === "integrations" && <IntegrationsTab   projectId={projectId} />}
        </div>
      </div>
    </div>
  );
}
