import type { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronLeft, Shield } from "lucide-react";
import { useGetProject, useListMembers } from "@workspace/api-client-react";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import { useAuthStore } from "@/store/auth";
import { useConfig } from "@/lib/config-context";
import { useI18n } from "@/lib/i18n";
import { getRole } from "@/lib/roles";

type FinancialProjectShellProps = {
  projectId: number;
  activeTab: "budget" | "contracts" | "apu";
  children: ReactNode;
};

export function FinancialProjectShell({ projectId, activeTab, children }: FinancialProjectShellProps) {
  const { user } = useAuthStore();
  const { adminRoles } = useConfig();
  const { lang } = useI18n();
  const { data: project, isLoading } = useGetProject(projectId);
  const { data: members } = useListMembers(projectId);
  const member = members?.find((item) => item.userId === user?.id);
  const memberRole = member?.role ?? "";
  const role = getRole(memberRole);
  const roleLabel = role ? (lang === "es" ? role.labelEs : role.label) : "";
  const activeLabel =
    activeTab === "budget"
      ? lang === "es" ? "Presupuesto del Proyecto" : "Project Budget"
      : activeTab === "contracts"
        ? lang === "es" ? "Contratos y Compromisos" : "Contracts & Commitments"
        : lang === "es" ? "APU genérico" : "Generic APU";

  if (isLoading) {
    return (
      <div className="app-shell">
        <div className="sidebar" />
        <div className="main-area">
          <div className="page-content">
            <div className="skeleton" style={{ height: 20, width: 220, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 40, width: 340 }} />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="app-shell">
        <div className="main-area">
          <div className="project-context-bar">
            <Link href="/dashboard" className="breadcrumb">
              <ChevronLeft style={{ width: 14, height: 14 }} />
              {lang === "es" ? "Sede BIMLog" : "Dashboard"}
            </Link>
          </div>
          <div className="page-content" role="alert">
            {lang === "es"
              ? "No se pudo cargar el contexto autorizado del proyecto."
              : "The authorized project context could not be loaded."}
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
        activeTab={activeTab}
        isAdmin={adminRoles.includes(memberRole)}
        memberRole={memberRole}
      />
      <div className="main-area">
        <div className="project-context-bar">
          <div className="breadcrumb">
            <Link
              href={`/projects/${projectId}/dashboard`}
              style={{ display: "flex", alignItems: "center", gap: 4, color: "hsl(var(--muted-foreground))", textDecoration: "none" }}
            >
              <ChevronLeft style={{ width: 14, height: 14 }} />
              {project.name}
            </Link>
            <span style={{ color: "hsl(var(--border))" }}>/</span>
            <span>{lang === "es" ? "Comercial" : "Commercial"}</span>
            <span style={{ color: "hsl(var(--border))" }}>/</span>
            <span className="breadcrumb-active">{activeLabel}</span>
          </div>
          <div className="project-context-actions">
            <span className="context-chip context-chip-mono">
              <span className="context-chip-label">{lang === "es" ? "CÓDIGO" : "CODE"}</span>
              {project.code}
            </span>
            {roleLabel && (
              <span className="context-chip">
                <Shield style={{ width: 12, height: 12 }} />
                {roleLabel}
              </span>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
