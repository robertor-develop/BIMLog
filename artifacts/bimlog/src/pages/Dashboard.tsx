import { useState } from "react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Users, FileText, ArrowRight, X, FolderOpen, BarChart2, AlertCircle, RefreshCw, LogOut, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { MasterSidebar } from "@/components/layout/MasterSidebar";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function deleteProject(projectId: number, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to delete project.");
  }
}

export function Dashboard() {
  const { t } = useI18n();
  const { data: projects, isLoading, isError, error, refetch } = useListProjects();
  const logout = useAuthStore(s => s.logout);
  const token = useAuthStore(s => s.token);
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  function clearSessionAndRetry() {
    localStorage.removeItem("bimlog-auth");
    logout();
    window.location.href = "/";
  }

  const activeProjects = projects?.filter(p => p.status === "active") ?? [];
  const totalFiles = projects?.reduce((sum, p) => sum + (p.fileCount || 0), 0) ?? 0;
  const totalMembers = projects?.reduce((sum, p) => sum + (p.memberCount || 0), 0) ?? 0;

  async function handleDelete(projectId: number, projectName: string) {
    const confirmed = window.confirm(
      `Are you sure you want to delete this project?\n\n"${projectName}"\n\nThis cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await deleteProject(projectId, token!);
      queryClient.invalidateQueries({ queryKey: ["/api/v1/projects"] });
      toast({ title: "Project deleted." });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to delete project.", variant: "destructive" });
    }
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <MasterSidebar />
      <div style={{ flex: 1, overflowY: "auto" }}>
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 4 }}>
            {t("dashboard.title")}
          </h1>
          <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            {projects?.length ?? 0} project{(projects?.length ?? 0) !== 1 ? "s" : ""} · {totalFiles} files · {totalMembers} team members
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} style={{ gap: 6, fontSize: 13 }}>
          <Plus style={{ width: 14, height: 14 }} />
          {t("dashboard.newProject")}
        </Button>
      </div>

      {/* Summary KPIs */}
      {!isLoading && (projects?.length ?? 0) > 0 && (
        <div className="kpi-grid-4" style={{ marginBottom: 24 }}>
          <div className="kpi-card">
            <div className="kpi-label">Total projects</div>
            <div className="kpi-value">{projects?.length ?? 0}</div>
            <div className="kpi-sub">{activeProjects.length} active</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Total files</div>
            <div className="kpi-value">{totalFiles}</div>
            <div className="kpi-sub">Across all projects</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Team members</div>
            <div className="kpi-value">{totalMembers}</div>
            <div className="kpi-sub">Across all projects</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Platform</div>
            <div className="kpi-value" style={{ fontSize: 16, color: "#2563EB" }}>BIMLog</div>
            <div className="kpi-sub">by IgniteSmart · ISO 19650</div>
          </div>
        </div>
      )}

      {/* Create project form */}
      {showCreate && (
        <CreateProjectForm onClose={() => setShowCreate(false)} />
      )}

      {/* Error state */}
      {isError && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "14px 16px", marginBottom: 20,
          background: "hsl(var(--destructive) / 0.06)",
          border: "1px solid hsl(var(--destructive) / 0.3)",
          borderRadius: 8
        }}>
          <AlertCircle style={{ width: 16, height: 16, color: "hsl(var(--destructive))", flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "hsl(var(--destructive))", marginBottom: 3 }}>
              Could not load projects
            </div>
            <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", marginBottom: 10, fontFamily: "var(--font-mono)" }}>
              {error instanceof Error ? error.message : "Unknown error — try signing out and back in"}
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()} style={{ gap: 5, fontSize: 11 }}>
              <RefreshCw style={{ width: 11, height: 11 }} />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 14 }} />
              <div className="skeleton" style={{ height: 16, width: "70%", marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 12, width: "50%" }} />
            </div>
          ))}
        </div>
      )}

      {/* Projects grid */}
      {!isLoading && <div id="projects" style={{ scrollMarginTop: 16 }} />}
      {!isLoading && (
        <>
          {(projects?.length ?? 0) > 0 ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {projects!.map(project => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : !showCreate && (
            <div className="empty-state">
              <div className="empty-icon">
                <FolderOpen style={{ width: 22, height: 22, color: "hsl(var(--muted-foreground))" }} />
              </div>
              <div className="empty-title">{t("dashboard.empty")}</div>
              <div className="empty-desc" style={{ marginBottom: 16 }}>{t("dashboard.emptyDesc")}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <Button onClick={() => setShowCreate(true)} variant="outline" style={{ gap: 6, fontSize: 12 }}>
                  <Plus style={{ width: 13, height: 13 }} />
                  {t("dashboard.createProject")}
                </Button>
                <button
                  onClick={clearSessionAndRetry}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    fontSize: 11, color: "hsl(var(--muted-foreground))",
                    background: "none", border: "none", cursor: "pointer",
                    padding: "4px 8px", borderRadius: 4,
                    textDecoration: "underline", textUnderlineOffset: 3,
                  }}
                >
                  <LogOut style={{ width: 11, height: 11 }} />
                  Clear session &amp; sign in again
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: {
    id: number;
    name: string;
    code: string;
    description?: string | null;
    status: string;
    memberCount?: number;
    fileCount?: number;
    userRole?: string;
  };
  onDelete: (id: number, name: string) => void;
}

function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const { t } = useI18n();
  const isActive = project.status === "active";
  const isAdmin = project.userRole === "project_admin";

  return (
    <div style={{ position: "relative" }}>
      <Link href={`/projects/${project.id}/analytics`} style={{ textDecoration: "none", display: "block" }}>
        <div
          className="card"
          style={{
            padding: "18px 20px",
            cursor: "pointer",
            transition: "box-shadow 0.15s, transform 0.15s",
            height: "100%",
            display: "flex",
            flexDirection: "column",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)";
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
            (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
          }}
        >
          {/* Top row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 9,
              background: "#EFF6FF", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
              <Building2 style={{ width: 18, height: 18, color: "#2563EB" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                color: "#D97706", background: "rgba(245,158,11,0.1)",
                border: "1px solid rgba(245,158,11,0.25)",
                padding: "2px 8px", borderRadius: 4
              }}>{project.code}</span>
              <span className={`badge ${isActive ? "badge-green" : "badge-gray"}`}>
                {project.status}
              </span>
            </div>
          </div>

          {/* Name + description */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600,
              color: "hsl(var(--foreground))", marginBottom: 6, lineHeight: 1.3
            }}>
              {project.name}
            </div>
            <div style={{
              fontSize: 12, color: "hsl(var(--muted-foreground))",
              lineHeight: 1.5, marginBottom: 14,
              display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", overflow: "hidden"
            }}>
              {project.description || t("dashboard.noDescription")}
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingTop: 12, borderTop: "1px solid hsl(var(--border))"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                <Users style={{ width: 13, height: 13 }} />
                {project.memberCount || 1}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                <FileText style={{ width: 13, height: 13 }} />
                {project.fileCount || 0}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                <BarChart2 style={{ width: 13, height: 13 }} />
                Analytics
              </span>
            </div>
            <ArrowRight style={{ width: 14, height: 14, color: "hsl(var(--muted-foreground))", transition: "transform 0.15s" }} />
          </div>
        </div>
      </Link>

      {/* Delete button — project_admin only, overlaid bottom-right */}
      {isAdmin && (
        <button
          onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(project.id, project.name); }}
          title="Delete project"
          style={{
            position: "absolute", bottom: 12, right: 48,
            width: 26, height: 26, borderRadius: 6,
            background: "#FEF2F2", border: "1px solid #FECACA",
            color: "#DC2626", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10,
          }}
        >
          <Trash2 style={{ width: 12, height: 12 }} />
        </button>
      )}
    </div>
  );
}

function CreateProjectForm({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", code: "", description: "" });

  const { mutate, isPending } = useCreateProject({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/v1/projects"] });
        toast({ title: t("common.success") });
        onClose();
      },
      onError: () => toast({ title: t("common.error"), variant: "destructive" }),
    },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div className="inline-form" style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 600, color: "hsl(var(--foreground))" }}>
          {t("project.create.title")}
        </div>
        <button
          onClick={onClose}
          style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "hsl(var(--muted-foreground))" }}
        >
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 180px 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 5 }}>
            {t("project.create.name")} *
          </label>
          <Input placeholder={t("project.create.namePlaceholder")} value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 5 }}>
            {t("project.code")} *
          </label>
          <Input
            placeholder="PROJ01"
            value={form.code}
            onChange={e => setForm(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") }))}
            style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "hsl(var(--muted-foreground))", marginBottom: 5 }}>
            {t("project.create.desc")}
          </label>
          <Input placeholder={t("project.create.descPlaceholder")} value={form.description} onChange={set("description")} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button variant="ghost" size="sm" onClick={onClose}>{t("common.cancel")}</Button>
        <Button
          size="sm"
          disabled={!form.name || !form.code || isPending}
          onClick={() => mutate({ data: form })}
        >
          {isPending ? "Creating..." : t("project.create.submit")}
        </Button>
      </div>
    </div>
  );
}
