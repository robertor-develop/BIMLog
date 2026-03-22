import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Users, FileText, ArrowRight, X, FolderOpen, BarChart2, AlertCircle, RefreshCw, LogOut, Trash2, CheckCircle2 } from "lucide-react";
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

// ── Cross-project aggregate types ─────────────────────────────────────────────
interface XRfi {
  id: number; projectId: number; subject: string; number: string;
  status: string; dueDate?: string | null;
  submittedToEmail?: string | null; assignedToId?: number | null;
  createdAt: string;
}
interface XSubmittal {
  id: number; projectId: number; title: string; number: string;
  status: string; dueDate?: string | null;
  submittedToEmail?: string | null; assignedToId?: number | null;
  createdAt: string;
}
interface XActivity {
  id: number; projectId: number;
  userFullName: string; userCompanyName: string;
  actionType: string; entityType: string;
  details?: string | null;
  fileNameBefore?: string | null; fileNameAfter?: string | null;
  createdAt: string;
}
interface XFile {
  id: number; projectId: number; fileName: string;
  status: string; uploadedByCompany?: string;
}

interface AggState {
  rfis: XRfi[]; submittals: XSubmittal[];
  activity: XActivity[]; files: XFile[];
  loading: boolean;
}

async function fetchJson(url: string, token: string) {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    return r.ok ? r.json() : [];
  } catch { return []; }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ACTION_COLORS: Record<string, { bg: string; color: string }> = {
  upload:   { bg: "#EFF6FF", color: "#2563EB" },
  validate: { bg: "#F0FDF4", color: "#16A34A" },
  reject:   { bg: "#FEF2F2", color: "#DC2626" },
  create:   { bg: "#F5F3FF", color: "#7C3AED" },
  update:   { bg: "#FFFBEB", color: "#D97706" },
  delete:   { bg: "#FEF2F2", color: "#DC2626" },
  approve:  { bg: "#F0FDF4", color: "#16A34A" },
};
function actionStyle(type: string) {
  const key = Object.keys(ACTION_COLORS).find(k => type.toLowerCase().includes(k)) ?? "create";
  return ACTION_COLORS[key];
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export function Dashboard() {
  const { t } = useI18n();
  const { data: projects, isLoading, isError, error, refetch } = useListProjects();
  const logout = useAuthStore(s => s.logout);
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Cross-project data ─────────────────────────────────────────────────────
  const [agg, setAgg] = useState<AggState>({ rfis: [], submittals: [], activity: [], files: [], loading: false });

  useEffect(() => {
    if (!projects || !token || projects.length === 0) return;
    setAgg(prev => ({ ...prev, loading: true }));
    Promise.all(
      projects.map(async p => {
        const base = `${API_BASE}/api/v1/projects/${p.id}`;
        const [rfis, submittals, activity, files] = await Promise.all([
          fetchJson(`${base}/rfis`, token),
          fetchJson(`${base}/submittals`, token),
          fetchJson(`${base}/activity`, token),
          fetchJson(`${base}/files`, token),
        ]);
        return { rfis, submittals, activity, files };
      })
    ).then(results => {
      setAgg({
        rfis:       results.flatMap(r => r.rfis),
        submittals: results.flatMap(r => r.submittals),
        activity:   results.flatMap(r => r.activity),
        files:      results.flatMap(r => r.files),
        loading:    false,
      });
    }).catch(() => setAgg(prev => ({ ...prev, loading: false })));
  }, [projects?.length, token]);

  // ── Existing helpers ───────────────────────────────────────────────────────
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

  // ── Derived aggregate stats ────────────────────────────────────────────────
  const projectMap = new Map((projects ?? []).map(p => [p.id, p]));

  const openRfis       = agg.rfis.filter(r => r.status !== "closed");
  const pendingSubmits = agg.submittals.filter(s => s.status === "pending");
  const validFiles     = agg.files.filter(f => f.status === "valid").length;
  const totalFilesReal = agg.files.length;
  const complianceRate = totalFilesReal > 0 ? Math.round((validFiles / totalFilesReal) * 100) : 0;

  // ── Needs Attention ────────────────────────────────────────────────────────
  const now = Date.now();
  const overdueRfiPids = new Set(
    agg.rfis
      .filter(r => r.status !== "closed" && r.dueDate && new Date(r.dueDate).getTime() < now)
      .map(r => r.projectId)
  );
  const rejectedFilePids = new Set(
    agg.files.filter(f => f.status === "rejected").map(f => f.projectId)
  );
  const pendingSubPids = new Set(
    agg.submittals.filter(s => s.status === "pending").map(s => s.projectId)
  );
  // Collect unique attention items
  const attentionRows: { pid: number; issue: string; color: string; href: string }[] = [];
  overdueRfiPids.forEach(pid => attentionRows.push({ pid, issue: "Has overdue RFIs", color: "#D97706", href: `/projects/${pid}/rfis` }));
  rejectedFilePids.forEach(pid => attentionRows.push({ pid, issue: "Naming violations detected", color: "#D97706", href: `/projects/${pid}/files` }));
  pendingSubPids.forEach(pid => {
    if (!overdueRfiPids.has(pid) && !rejectedFilePids.has(pid))
      attentionRows.push({ pid, issue: "Pending submittals", color: "#2563EB", href: `/projects/${pid}/submittals` });
  });

  // ── Your Pending Items ─────────────────────────────────────────────────────
  const userEmail = (user as any)?.email ?? "";
  const myRfis = agg.rfis.filter(r =>
    ["open", "in_review"].includes(r.status) &&
    r.submittedToEmail && userEmail && r.submittedToEmail === userEmail
  );
  const mySubmittals = agg.submittals.filter(s =>
    s.status === "pending" &&
    s.submittedToEmail && userEmail && s.submittedToEmail === userEmail
  );

  // ── Recent Activity ────────────────────────────────────────────────────────
  const recentActivity = [...agg.activity]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 15);

  // ── Top Naming Violators ───────────────────────────────────────────────────
  const rejected = agg.files.filter(f => f.status === "rejected");
  const violatorMap = new Map<string, { count: number; pids: Set<number> }>();
  rejected.forEach(f => {
    const co = f.uploadedByCompany || "Unknown";
    if (!violatorMap.has(co)) violatorMap.set(co, { count: 0, pids: new Set() });
    const v = violatorMap.get(co)!;
    v.count++;
    v.pids.add(f.projectId);
  });
  const topViolators = [...violatorMap.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 5);

  // ── Shared card style ──────────────────────────────────────────────────────
  const panel: React.CSSProperties = {
    background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
    borderRadius: 10, padding: "16px 18px",
  };
  const panelTitle: React.CSSProperties = {
    fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700,
    color: "hsl(var(--foreground))", marginBottom: 12,
  };
  const loadingText = <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <MasterSidebar />

      {/* Main scrollable area */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

          {/* SECTION 1 — Page heading */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 4 }}>
              Command Center
            </h1>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              {projects?.length ?? 0} project{(projects?.length ?? 0) !== 1 ? "s" : ""} · {totalFiles} files processed
            </p>
          </div>

          {/* SECTION 2 — Platform stats (5 cards) */}
          {!isLoading && (projects?.length ?? 0) > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
              <div className="kpi-card">
                <div className="kpi-label">Active Projects</div>
                <div className="kpi-value">{activeProjects.length}</div>
                <div className="kpi-sub">{projects?.length ?? 0} total</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Files Processed</div>
                <div className="kpi-value">{agg.loading ? "…" : (totalFilesReal || totalFiles)}</div>
                <div className="kpi-sub">Across all projects</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Open RFIs</div>
                <div className="kpi-value">{agg.loading ? "…" : openRfis.length}</div>
                <div className="kpi-sub">Across all projects</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Pending Submittals</div>
                <div className="kpi-value">{agg.loading ? "…" : pendingSubmits.length}</div>
                <div className="kpi-sub">Awaiting review</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Compliance Rate</div>
                <div className="kpi-value">{agg.loading ? "…" : `${complianceRate}%`}</div>
                <div className="kpi-sub">Valid / total files</div>
              </div>
            </div>
          )}

          {/* SECTION 3 — Needs Attention + Your Pending Items */}
          {!isLoading && (projects?.length ?? 0) > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

              {/* Needs Attention */}
              <div style={panel}>
                <div style={panelTitle}>Needs Attention</div>
                {agg.loading ? loadingText : attentionRows.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                    <CheckCircle2 style={{ width: 13, height: 13, color: "#16A34A" }} />
                    <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>All clear — no issues detected</span>
                  </div>
                ) : attentionRows.slice(0, 6).map((row, i) => {
                  const proj = projectMap.get(row.pid);
                  if (!proj) return null;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, border: `1px solid ${row.color}30`, background: `${row.color}08`, marginBottom: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</div>
                        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{row.issue}</div>
                      </div>
                      <Link href={row.href} style={{ fontSize: 10, fontWeight: 600, color: row.color, textDecoration: "none", padding: "3px 8px", borderRadius: 4, border: `1px solid ${row.color}40`, background: `${row.color}10`, whiteSpace: "nowrap", flexShrink: 0 }}>
                        Go to Project
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Your Pending Items */}
              <div style={panel}>
                <div style={panelTitle}>Your Pending Items</div>
                {agg.loading ? loadingText : (myRfis.length === 0 && mySubmittals.length === 0) ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                    <CheckCircle2 style={{ width: 13, height: 13, color: "#16A34A" }} />
                    <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>Nothing waiting on you</span>
                  </div>
                ) : (
                  <>
                    {myRfis.slice(0, 4).map(rfi => {
                      const proj = projectMap.get(rfi.projectId);
                      const days = rfi.dueDate ? Math.ceil((new Date(rfi.dueDate).getTime() - now) / 86400000) : null;
                      return (
                        <div key={rfi.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 10px", marginBottom: 5, borderRadius: 6, background: "#FFFBEB", border: "1px solid #FDE68A" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rfi.number} — {rfi.subject}</div>
                            <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{proj?.name} · RFI{days !== null ? ` · ${days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}` : ""}</div>
                          </div>
                          <Link href={`/projects/${rfi.projectId}/rfis`} style={{ fontSize: 10, color: "#D97706", textDecoration: "none", flexShrink: 0 }}>Open →</Link>
                        </div>
                      );
                    })}
                    {mySubmittals.slice(0, 4).map(sub => {
                      const proj = projectMap.get(sub.projectId);
                      const days = sub.dueDate ? Math.ceil((new Date(sub.dueDate).getTime() - now) / 86400000) : null;
                      return (
                        <div key={sub.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 10px", marginBottom: 5, borderRadius: 6, background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "hsl(var(--foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.number} — {sub.title}</div>
                            <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{proj?.name} · {sub.status.replace(/_/g, " ")}{days !== null ? ` · ${days < 0 ? `${Math.abs(days)}d overdue` : `${days}d left`}` : ""}</div>
                          </div>
                          <Link href={`/projects/${sub.projectId}/submittals`} style={{ fontSize: 10, color: "#2563EB", textDecoration: "none", flexShrink: 0 }}>Open →</Link>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          )}

          {/* SECTION 4 — Recent Activity + Top Naming Violators */}
          {!isLoading && (projects?.length ?? 0) > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>

              {/* Recent Activity */}
              <div style={panel}>
                <div style={{ ...panelTitle, display: "flex", alignItems: "baseline", gap: 8 }}>
                  Recent Activity
                  <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", fontWeight: 400 }}>across all projects</span>
                </div>
                {agg.loading ? loadingText : recentActivity.length === 0 ? (
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>No activity yet.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {recentActivity.map(entry => {
                      const proj = projectMap.get(entry.projectId);
                      const s = actionStyle(entry.actionType);
                      return (
                        <div key={entry.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 8px", borderRadius: 6, background: "hsl(var(--secondary)/0.5)" }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 3, background: s.bg, color: s.color, flexShrink: 0, textTransform: "uppercase", marginTop: 1 }}>
                            {entry.actionType.replace(/_/g, " ")}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, color: "hsl(var(--foreground))", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {entry.userFullName}
                              {entry.userCompanyName ? <span style={{ color: "hsl(var(--muted-foreground))", fontWeight: 400 }}> · {entry.userCompanyName}</span> : null}
                            </div>
                            <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {proj ? <span style={{ fontWeight: 500 }}>{proj.name}</span> : null}
                              {entry.details ? ` — ${entry.details}` : ""}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", flexShrink: 0 }}>{timeAgo(entry.createdAt)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Top Naming Violators */}
              <div style={panel}>
                <div style={panelTitle}>Top Naming Violators</div>
                {agg.loading ? loadingText : topViolators.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                    <CheckCircle2 style={{ width: 13, height: 13, color: "#16A34A" }} />
                    <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>All companies compliant</span>
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Company", "Rejections", "Projects"].map(h => (
                          <th key={h} style={{ textAlign: "left", fontSize: 10, fontWeight: 700, color: "hsl(var(--muted-foreground))", padding: "3px 8px", borderBottom: "1px solid hsl(var(--border))" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {topViolators.map(([co, data]) => (
                        <tr key={co}>
                          <td style={{ fontSize: 11, padding: "5px 8px", color: "hsl(var(--foreground))", fontWeight: 500, borderBottom: "1px solid hsl(var(--border)/0.5)" }}>{co}</td>
                          <td style={{ fontSize: 11, padding: "5px 8px", borderBottom: "1px solid hsl(var(--border)/0.5)" }}>
                            <span style={{ fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", padding: "1px 6px", borderRadius: 4 }}>{data.count}</span>
                          </td>
                          <td style={{ fontSize: 11, padding: "5px 8px", color: "hsl(var(--muted-foreground))", borderBottom: "1px solid hsl(var(--border)/0.5)" }}>{data.pids.size}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* SECTION 5 — Your Projects (exact existing content) */}
          <div>
            {/* Header row with heading + New Project button */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 4 }}>
                  {t("dashboard.title")}
                </h2>
                <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                  {projects?.length ?? 0} project{(projects?.length ?? 0) !== 1 ? "s" : ""} · {totalFiles} files · {totalMembers} team members
                </p>
              </div>
              <Button onClick={() => setShowCreate(true)} style={{ gap: 6, fontSize: 13 }}>
                <Plus style={{ width: 14, height: 14 }} />
                {t("dashboard.newProject")}
              </Button>
            </div>

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
    </div>
  );
}

// ── ProjectCard (unchanged) ────────────────────────────────────────────────────
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

// ── CreateProjectForm (unchanged) ──────────────────────────────────────────────
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
