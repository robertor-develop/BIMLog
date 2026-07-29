import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useListProjects, useCreateProject, useListMembers } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PrintPdfButton } from "@/components/PrintPdfButton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Users, FileText, ArrowRight, X, FolderOpen, BarChart2, AlertCircle, RefreshCw, LogOut, Trash2, CheckCircle2, Clock, Shield, Sparkles, Download } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import { StatCard } from "@/components/dashboard/StatCard";
import { OnboardingFlow, useOnboarding } from "@/components/OnboardingFlow";
import { logClientError } from "@/lib/client-log";
import { activityDetailsClampStyle, presentActivityDetails } from "@/lib/activity-presentation";

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

function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try {
      const decoded = decodeURIComponent(utf8[1]).split(/[\\/]/).pop()?.trim();
      if (decoded) return decoded;
    } catch { /* use quoted filename or fallback */ }
  }
  const quoted = disposition.match(/filename="([^"]+)"/i)?.[1] ?? disposition.match(/filename=([^;]+)/i)?.[1];
  const clean = quoted?.replace(/^"|"$/g, "").split(/[\\/]/).pop()?.trim();
  return clean || fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

// ── AI Briefing Card ──────────────────────────────────────────────────────────
function AiBriefingCard({ token }: { token?: string }) {
  const { lang } = useI18n();
  const tl = (en: string, es: string) => lang === "es" ? es : en;
  const [briefing, setBriefing] = useState<{ summary: string; criticalItems: string[]; todaysDate: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);
  const [open, setOpen] = useState(false);

  const loadBriefing = async () => {
    if (!token || shown) return;
    setLoading(true); setShown(true);
    try {
      const r = await fetch("/api/v1/dashboard/briefing", { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) { setBriefing(await r.json()); setOpen(true); }
    } finally { setLoading(false); }
  };

  if (!token) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      {!open && !loading && (
        <button
          onClick={loadBriefing}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            width: "100%", padding: "10px 16px", borderRadius: 9,
            background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)",
            border: "1px solid #BFDBFE", cursor: "pointer", textAlign: "left",
            fontSize: 12, color: "#1D4ED8", fontWeight: 600,
          }}
        >
          <Sparkles style={{ width: 18, height: 18 }} />
          {tl("Get AI Morning Briefing — smart summary of what needs your attention today", "Obtener Briefing IA — resumen inteligente de lo que necesita atención hoy")}
        </button>
      )}
      {loading && (
        <div style={{ padding: "10px 16px", borderRadius: 9, background: "#EFF6FF", border: "1px solid #BFDBFE", fontSize: 12, color: "#2563EB" }}>
          <Sparkles style={{ width: 12, height: 12, marginRight: 4 }} />{tl("Generating AI briefing…", "Generando briefing IA…")}
        </div>
      )}
      {open && briefing && (
        <div style={{ padding: 16, borderRadius: 9, background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)", border: "1px solid #BFDBFE" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1D4ED8", display: "flex", alignItems: "center", gap: 4 }}><Sparkles style={{ width: 13, height: 13 }} />{tl("AI Briefing", "Briefing IA")}</span>
              <span style={{ fontSize: 10, color: "#6B7280", marginLeft: 8 }}>{briefing.todaysDate}</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 0 }}>X</button>
          </div>
          <p style={{ fontSize: 12, color: "#374151", margin: "0 0 10px", lineHeight: 1.6 }}>{briefing.summary}</p>
          {briefing.criticalItems?.length > 0 && (
            <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
              {briefing.criticalItems.map((item, i) => (
                <li key={i} style={{ fontSize: 12, color: "#374151", marginBottom: 3 }}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export function Dashboard() {
  const { t, tt, lang } = useI18n();
  const [, setLocation] = useLocation();
  const { data: projects, isLoading, isError, error, refetch } = useListProjects();
  const logout = useAuthStore(s => s.logout);
  const token = useAuthStore(s => s.token);
  const user = useAuthStore(s => s.user);
  const [showCreate, setShowCreate] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState("");
  function handleProjectCreated(newId: number) {
    console.log("REDIRECT TARGET", `/projects/${newId}/convention`);
    setShowCreate(false);
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.location.href = `${base}/projects/${newId}/convention`;
  }
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { shouldShow: showOnboarding, markDone: doneOnboarding } = useOnboarding();
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  useEffect(() => { if (showOnboarding) setOnboardingVisible(true); }, [showOnboarding]);

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/api/v1/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error("Failed");
      return r.json() as Promise<{
        activeProjects: number; filesProcessed: number; openRfis: number;
        pendingSubmittals: number; complianceRate: number | null; filesNeedingAttention: number;
        totalClashes?: number; openClashes?: number; p1Clashes?: number;
        clashReports?: number; submittalTrackers?: number; openSubmittalItems?: number;
      }>;
    },
    enabled: !!token,
    refetchInterval: 60000,
  });

  // ── CVR Platform Health ────────────────────────────────────────────────────
  const [cvrHealth, setCvrHealth] = useState<{ healthStatus: "green" | "amber" | "red"; totalPendingReview: number; totalFlagged: number } | null>(null);
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/v1/cvr-health`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCvrHealth(data); })
      .catch((error) => logClientError("dashboard CVR health load", error));
  }, [token]);

  // ── Cross-project data ─────────────────────────────────────────────────────
  const [agg, setAgg] = useState<AggState>({ rfis: [], submittals: [], activity: [], files: [], loading: false });
  const [projectSearch, setProjectSearch] = useState("");
  const [projectStatus, setProjectStatus] = useState("all");
  const [projectSort, setProjectSort] = useState<"name_asc" | "name_desc" | "code_asc" | "status_asc">("name_asc");

  useEffect(() => {
    if (!projects || !token || projects.length === 0) return;
    setAgg(prev => ({ ...prev, loading: true }));
    Promise.all(
      (projects as any[]).map(async (p: any) => {
        const base = `${API_BASE}/api/v1/projects/${p.id}`;
        const [rfis, submittals, activity, files] = await Promise.all([
          fetchJson(`${base}/rfis`, token),
          fetchJson(`${base}/submittals`, token),
          fetchJson(`${base}/activity`, token),
          fetchJson(`${base}/files`, token),
        ]);
        return { rfis, submittals, activity, files };
      })
    ).then((results: Array<{ rfis: any[]; submittals: any[]; activity: any[]; files: any[] }>) => {
      setAgg({
        rfis:       results.flatMap((r: { rfis: any[] }) => r.rfis),
        submittals: results.flatMap((r: { submittals: any[] }) => r.submittals),
        activity:   results.flatMap((r: { activity: any[] }) => r.activity),
        files:      results.flatMap((r: { files: any[] }) => r.files),
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

  const allProjectRows = (projects ?? []) as Array<any>;
  const projectStatusOptions = useMemo(
    () => [...new Set(allProjectRows.map((project: any) => String(project.status || "").trim()).filter(Boolean))].sort(),
    [allProjectRows],
  );
  const projectRows = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();
    return allProjectRows
      .filter((project: any) => projectStatus === "all" || project.status === projectStatus)
      .filter((project: any) => !query || [
        project.code,
        project.name,
        project.clientName,
        project.clientCompany,
        project.location,
      ].some(value => String(value || "").toLowerCase().includes(query)))
      .sort((left: any, right: any) => {
        if (projectSort === "name_desc") return String(right.name || "").localeCompare(String(left.name || ""), undefined, { sensitivity: "base" });
        if (projectSort === "code_asc") return String(left.code || "").localeCompare(String(right.code || ""), undefined, { numeric: true, sensitivity: "base" });
        if (projectSort === "status_asc") return `${left.status || ""}-${left.name || ""}`.localeCompare(`${right.status || ""}-${right.name || ""}`, undefined, { sensitivity: "base" });
        return String(left.name || "").localeCompare(String(right.name || ""), undefined, { sensitivity: "base" });
      });
  }, [allProjectRows, projectSearch, projectSort, projectStatus]);
  const activeProjects = allProjectRows.filter((p: any) => p.status === "active");
  const totalFiles = allProjectRows.reduce((sum: number, p: any) => sum + (p.fileCount || 0), 0);
  const visibleProjectFiles = projectRows.reduce((sum: number, p: any) => sum + (p.fileCount || 0), 0);
  const visibleProjectMembers = projectRows.reduce((sum: number, p: any) => sum + (p.memberCount || 0), 0);

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

  async function exportCurrentViewPdf() {
    if (!token || isLoading || agg.loading) return;
    setExportingPdf(true);
    setExportError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/dashboard/export-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lang,
          projectSearch: projectSearch.trim(),
          projectStatus,
          projectSort,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || tt("Dashboard PDF export failed.", "Error al exportar PDF del tablero."));
      }
      const blob = await response.blob();
      downloadBlob(blob, filenameFromDisposition(response.headers.get("Content-Disposition"), "bimlog-headquarters-dashboard-current-view.pdf"));
    } catch (err) {
      setExportError(err instanceof Error ? err.message : tt("Dashboard PDF export failed.", "Error al exportar PDF del tablero."));
    } finally {
      setExportingPdf(false);
    }
  }

  // ── Derived aggregate stats ────────────────────────────────────────────────
  const projectMap = new Map<number, any>(allProjectRows.map((p: any) => [Number(p.id), p]));

  const openRfis        = agg.rfis.filter(r => r.status !== "closed");
  const pendingSubmittals = agg.submittals.filter(s => ["pending", "under_review"].includes(s.status));
  const pendingSubmits  = pendingSubmittals;
  // FIX 4: compliance rate only counts completed uploads (valid + rejected), not in-progress
  const completedFiles  = agg.files.filter(f => f.status === "valid" || f.status === "rejected");
  const compliantFiles  = completedFiles.filter(f => f.status === "valid");
  const totalFilesReal  = agg.files.length;
  const complianceRate  = completedFiles.length > 0
    ? Math.round((compliantFiles.length / completedFiles.length) * 100)
    : null;
  // FIX 1: count confirmed violations only (user clicked Continue Anyway past naming warning)
  const confirmedViolations = agg.files.filter(f => (f as any).userConfirmedNonCompliant === true);
  // FIX 6: files needing attention = non-compliant or CVR-flagged completed files
  const filesNeedingAttention = agg.files.filter(f =>
    (f.status === "rejected" || (f as any).contentVerificationResult === "possible_mismatch" || (f as any).contentVerificationResult === "clear_mismatch") && f.status !== "in_progress"
  );

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
  overdueRfiPids.forEach(pid => attentionRows.push({ pid, issue: tt("Has overdue RFIs", "Tiene RFI vencidos"), color: "#D97706", href: `/projects/${pid}/rfis` }));
  rejectedFilePids.forEach(pid => attentionRows.push({ pid, issue: tt("Naming violations detected", "Se detectaron incumplimientos de nomenclatura"), color: "#D97706", href: `/projects/${pid}/files` }));
  pendingSubPids.forEach(pid => {
    if (!overdueRfiPids.has(pid) && !rejectedFilePids.has(pid))
      attentionRows.push({ pid, issue: tt("Pending submittals", "Submittals pendientes"), color: "#2563EB", href: `/projects/${pid}/submittals` });
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
  // FIX 2: only count confirmed violations (user clicked Continue Anyway on naming warning)
  const violatorMap = new Map<string, { count: number; pids: Set<number> }>();
  confirmedViolations.forEach(f => {
    const co = (f as any).uploadedByCompany || "Unknown";
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
    <div className="headquarters-dashboard-page" style={{ display: "flex", height: "100vh", overflow: "hidden", minWidth: 0 }}>
      <style>{`
        @media (max-width: 720px) {
          .headquarters-dashboard-page {
            display: block !important;
            overflow-x: hidden !important;
          }
          .headquarters-dashboard-page > div:last-child {
            width: 100% !important;
            min-width: 0 !important;
          }
          .headquarters-dashboard-page .headquarters-content {
            max-width: 100% !important;
            padding: 74px 12px 20px !important;
            box-sizing: border-box;
            overflow-x: hidden;
          }
          .headquarters-dashboard-page .headquarters-heading-row,
          .headquarters-dashboard-page .dashboard-export-actions {
            align-items: stretch !important;
            flex-direction: column !important;
          }
          .headquarters-dashboard-page .dashboard-export-actions > button {
            width: 100% !important;
            justify-content: center !important;
          }
          .headquarters-dashboard-page .headquarters-two-column {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      {onboardingVisible && (
        <OnboardingFlow onDone={() => { setOnboardingVisible(false); doneOnboarding(); }} />
      )}
      <MasterSidebar />

      {/* Main scrollable area */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", overflowX: "hidden" }}>
        <div className="headquarters-content" style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

          {/* SECTION 1 — Page heading */}
          <div className="headquarters-heading-row" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 24 }}>
            <div style={{ minWidth: 0 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 4 }}>
              {tt("BIMLog Headquarters", "Sede BIMLog")}
            </h1>
            <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              {tt(
                `${projects?.length ?? 0} project${(projects?.length ?? 0) !== 1 ? "s" : ""} · ${totalFiles} files processed · Cross-project overview and administration entry point`,
                `${projects?.length ?? 0} proyecto${(projects?.length ?? 0) !== 1 ? "s" : ""} · ${totalFiles} archivos procesados · Vista general entre proyectos y entrada de administración`,
              )}
            </p>
              {exportError && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#DC2626", fontWeight: 600 }}>{exportError}</div>
              )}
            </div>
            <div className="dashboard-export-actions" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0, minWidth: 0 }}>
              <PrintPdfButton
                lang={lang}
                loading={exportingPdf}
                disabled={!token || isLoading || agg.loading}
                disabledReason={!token
                  ? tt("Sign in to print this dashboard.", "Inicie sesion para imprimir este tablero.")
                  : tt("Wait until the current dashboard view finishes loading.", "Espere a que termine de cargar la vista actual del tablero.")}
                currentViewSummary={[
                  `${tt("Project search", "Busqueda de proyecto")}: ${projectSearch.trim() || tt("None", "Ninguna")}`,
                  `${tt("Status", "Estado")}: ${projectStatus === "all" ? tt("All", "Todos") : projectStatus}`,
                  `${tt("Sort", "Orden")}: ${projectSort.replace(/_/g, " ")}`,
                  `${tt("Visible projects", "Proyectos visibles")}: ${projectRows.length}/${allProjectRows.length}`,
                ]}
                onClick={() => void exportCurrentViewPdf()}
              />
              {(!token || isLoading || agg.loading) && (
                <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", maxWidth: 260, textAlign: "right" }}>
                  {!token ? tt("Sign in is required.", "Se requiere iniciar sesion.") : tt("Available after the current dashboard data loads.", "Disponible despues de cargar los datos actuales del tablero.")}
                </div>
              )}
            </div>
          </div>

          <section
            data-current-view-filter-panel="dashboard"
            aria-label={tt("Current view filters", "Filtros de vista actual")}
            style={{ marginBottom: 20, padding: "14px 16px", border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--card))" }}
          >
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "hsl(var(--foreground))" }}>{tt("Current view filters", "Filtros de vista actual")}</div>
              <div style={{ marginTop: 2, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>
                {tt("Filter and sort the visible project register. Print PDF uses these exact controls.", "Filtra y ordena el registro visible de proyectos. Imprimir PDF usa exactamente estos controles.")}
              </div>
            </div>
            <div className="dashboard-current-view-filters" style={{ display: "grid", gridTemplateColumns: "minmax(180px, 2fr) repeat(2, minmax(140px, 1fr)) auto", gap: 10, alignItems: "end" }}>
              <label style={{ display: "grid", gap: 4, minWidth: 0, fontSize: 11, fontWeight: 700 }}>
                {tt("Search projects", "Buscar proyectos")}
                <Input
                  value={projectSearch}
                  onChange={event => setProjectSearch(event.target.value)}
                  placeholder={tt("Name, code, client or location...", "Nombre, codigo, cliente o ubicacion...")}
                />
              </label>
              <label style={{ display: "grid", gap: 4, minWidth: 0, fontSize: 11, fontWeight: 700 }}>
                {tt("Project status", "Estado del proyecto")}
                <select className="input" value={projectStatus} onChange={event => setProjectStatus(event.target.value)}>
                  <option value="all">{tt("All statuses", "Todos los estados")}</option>
                  {projectStatusOptions.map(status => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4, minWidth: 0, fontSize: 11, fontWeight: 700 }}>
                {tt("Sort projects", "Ordenar proyectos")}
                <select className="input" value={projectSort} onChange={event => setProjectSort(event.target.value as typeof projectSort)}>
                  <option value="name_asc">{tt("Name A-Z", "Nombre A-Z")}</option>
                  <option value="name_desc">{tt("Name Z-A", "Nombre Z-A")}</option>
                  <option value="code_asc">{tt("Project code", "Codigo del proyecto")}</option>
                  <option value="status_asc">{tt("Status, then name", "Estado y luego nombre")}</option>
                </select>
              </label>
              <Button type="button" variant="outline" onClick={() => { setProjectSearch(""); setProjectStatus("all"); setProjectSort("name_asc"); }}>
                {tt("Clear filters", "Limpiar filtros")}
              </Button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))" }}>
              <span>{tt("Visible projects", "Proyectos visibles")}: {projectRows.length}/{allProjectRows.length}</span>
              <span>·</span>
              <span>{tt("Status", "Estado")}: {projectStatus === "all" ? tt("All", "Todos") : projectStatus.replace(/_/g, " ")}</span>
              <span>·</span>
              <span>{tt("Sort", "Orden")}: {projectSort.replace(/_/g, " ")}</span>
              {projectSearch.trim() && <><span>·</span><span>{tt("Search", "Busqueda")}: {projectSearch.trim()}</span></>}
            </div>
          </section>

          {/* AI Briefing banner */}
          <AiBriefingCard token={token ?? undefined} />

          {/* SECTION 2 — Platform stats (5 cards) */}
          {!isLoading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
              {/* FIX 3: each card navigates to the correct section */}
              <StatCard
                label={tt("Active Projects", "Proyectos activos")}
                value={stats?.activeProjects ?? 0}
                sub={`${projects?.length ?? 0} ${tt("total", "en total")}`}
                navigate={() => setLocation("/projects")}
              />
              <StatCard
                label={tt("Files Processed", "Archivos procesados")}
                value={stats?.filesProcessed ?? 0}
                sub={tt("Across all projects", "En todos los proyectos")}
                navigate={() => setLocation(projects?.[0]?.id ? `/projects/${projects[0].id}/files` : "/projects")}
              />
              <StatCard
                label={tt("Open RFIs", "RFI abiertos")}
                value={stats?.openRfis ?? 0}
                sub={tt("Across all projects", "En todos los proyectos")}
                navigate={() => setLocation(projects?.[0]?.id ? `/projects/${projects[0].id}/rfis` : "/projects")}
              />
              <StatCard
                label={tt("Pending Submittals", "Submittals pendientes")}
                value={stats?.pendingSubmittals ?? 0}
                sub={tt("Awaiting review", "En espera de revisión")}
                navigate={() => setLocation(projects?.[0]?.id ? `/projects/${projects[0].id}/submittals` : "/projects")}
              />
              <StatCard
                label={tt("Compliance Rate", "Tasa de cumplimiento")}
                value={stats?.complianceRate === null || stats?.complianceRate === undefined ? "—" : `${stats.complianceRate}%`}
                sub={tt("Completed uploads only", "Solo cargas completadas")}
                navigate={() => setLocation(projects?.[0]?.id ? `/projects/${projects[0].id}/analytics` : "/projects")}
              />
            </div>
          )}

          {/* Clash + submittal tracking stats */}
          {stats && (stats.totalClashes ?? 0) + (stats.submittalTrackers ?? 0) > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 16 }}>
              <StatCard
                label={tt("Total Clashes", "Total de interferencias")}
                value={stats?.totalClashes ?? 0}
                sub={`${stats?.p1Clashes ?? 0} ${tt("P1 Critical", "P1 críticas")}`}
                navigate={() => setLocation(projects?.[0]?.id ? `/projects/${projects[0].id}/clash-reports` : "/projects")}
              />
              <StatCard
                label={tt("Open Clashes", "Interferencias abiertas")}
                value={stats?.openClashes ?? 0}
                sub={tt("Unresolved coordination issues", "Problemas de coordinación sin resolver")}
                navigate={() => setLocation(projects?.[0]?.id ? `/projects/${projects[0].id}/clash-reports` : "/projects")}
              />
              <StatCard
                label={tt("Submittal Tracking", "Seguimiento de submittals")}
                value={stats?.submittalTrackers ?? 0}
                sub={tt("Active tracking logs", "Registros activos de seguimiento")}
                navigate={() => setLocation(projects?.[0]?.id ? `/projects/${projects[0].id}/submittals` : "/projects")}
              />
              <StatCard
                label={tt("Open Submittals", "Submittals abiertos")}
                value={stats?.openSubmittalItems ?? 0}
                sub={tt("Items needing attention", "Elementos que requieren atención")}
                navigate={() => setLocation(projects?.[0]?.id ? `/projects/${projects[0].id}/submittals` : "/projects")}
              />
            </div>
          )}

          {/* CVR Platform Health Ring */}
          {cvrHealth && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                ...panel,
                display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap",
                borderLeft: `4px solid ${cvrHealth.healthStatus === "green" ? "#16A34A" : cvrHealth.healthStatus === "amber" ? "#D97706" : "#DC2626"}`,
              }}>
                {/* Ring */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <svg width={72} height={72} style={{ transform: "rotate(-90deg)" }}>
                    <circle cx={36} cy={36} r={28} fill="none" stroke="hsl(var(--border))" strokeWidth={6} />
                    <circle
                      cx={36} cy={36} r={28} fill="none"
                      stroke={cvrHealth.healthStatus === "green" ? "#16A34A" : cvrHealth.healthStatus === "amber" ? "#D97706" : "#DC2626"}
                      strokeWidth={6}
                      strokeDasharray={`${(cvrHealth.healthStatus === "green" ? 100 : cvrHealth.healthStatus === "amber" ? 60 : 25) / 100 * 2 * Math.PI * 28} ${2 * Math.PI * 28}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div style={{
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {cvrHealth.healthStatus === "green"
                      ? <CheckCircle2 style={{ width: 18, height: 18, color: "#16A34A" }} />
                      : cvrHealth.healthStatus === "amber"
                        ? <Clock style={{ width: 18, height: 18, color: "#D97706" }} />
                        : <AlertCircle style={{ width: 18, height: 18, color: "#DC2626" }} />}
                  </div>
                </div>

                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Shield style={{ width: 14, height: 14, color: "hsl(var(--muted-foreground))" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "hsl(var(--muted-foreground))" }}>
                      {tt("CVR Platform Health", "Salud de CVR")}
                    </span>
                    <span style={{
                      padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                      background: cvrHealth.healthStatus === "green" ? "#F0FDF4" : cvrHealth.healthStatus === "amber" ? "#FFFBEB" : "#FEF2F2",
                      color: cvrHealth.healthStatus === "green" ? "#16A34A" : cvrHealth.healthStatus === "amber" ? "#D97706" : "#DC2626",
                      border: `1px solid ${cvrHealth.healthStatus === "green" ? "#BBF7D0" : cvrHealth.healthStatus === "amber" ? "#FDE68A" : "#FECACA"}`,
                    }}>
                      {cvrHealth.healthStatus === "green" ? tt("All Clear", "Todo claro") : cvrHealth.healthStatus === "amber" ? tt("Attention", "Atención") : tt("Action Required", "Acción requerida")}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "hsl(var(--muted-foreground))", lineHeight: 1.6 }}>
                    {cvrHealth.healthStatus === "green"
                      ? tt("No content verification issues pending — all files are clear.", "No hay verificaciones de contenido pendientes; todos los archivos están correctos.")
                      : cvrHealth.healthStatus === "amber"
                        ? tt(`${cvrHealth.totalPendingReview} file${cvrHealth.totalPendingReview !== 1 ? "s" : ""} pending admin review after a content mismatch flag.`, `${cvrHealth.totalPendingReview} archivo${cvrHealth.totalPendingReview !== 1 ? "s" : ""} pendiente${cvrHealth.totalPendingReview !== 1 ? "s" : ""} de revisión administrativa por una alerta de contenido.`)
                        : tt(`${cvrHealth.totalPendingReview} file${cvrHealth.totalPendingReview !== 1 ? "s" : ""} have been pending review for over 24 hours — immediate action required.`, `${cvrHealth.totalPendingReview} archivo${cvrHealth.totalPendingReview !== 1 ? "s llevan" : " lleva"} más de 24 horas pendiente${cvrHealth.totalPendingReview !== 1 ? "s" : ""} de revisión; se requiere acción inmediata.`)}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 24, flexShrink: 0 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "hsl(var(--foreground))" }}>{cvrHealth.totalFlagged}</div>
                    <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{tt("AI Flagged", "Marcados por IA")}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: cvrHealth.totalPendingReview > 0 ? "#7C3AED" : "hsl(var(--foreground))" }}>
                      {cvrHealth.totalPendingReview}
                    </div>
                    <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{tt("Pending Review", "Revisión pendiente")}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 3 — Needs Attention + Your Pending Items */}
          {!isLoading && (projects?.length ?? 0) > 0 && (
            <div className="headquarters-two-column" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

              {/* Needs Attention */}
              <div style={panel}>
                <div style={panelTitle}>{tt("Needs Attention", "Requiere atención")}</div>
                {agg.loading ? loadingText : attentionRows.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                    <CheckCircle2 style={{ width: 13, height: 13, color: "#16A34A" }} />
                    <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>{tt("All clear — no issues detected", "Todo claro; no se detectaron problemas")}</span>
                  </div>
                ) : attentionRows.slice(0, 6).map((row, i) => {
                  const proj = projectMap.get(row.pid);
                  if (!proj) return null;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 6, border: `1px solid ${row.color}30`, background: `${row.color}08`, marginBottom: 6, cursor: "pointer" }} onClick={() => setLocation(row.href)}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", marginBottom: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{proj.name}</div>
                        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{row.issue}</div>
                      </div>
                      <Link href={row.href} style={{ fontSize: 10, fontWeight: 600, color: row.color, textDecoration: "none", padding: "3px 8px", borderRadius: 4, border: `1px solid ${row.color}40`, background: `${row.color}10`, whiteSpace: "nowrap", flexShrink: 0 }}>
                        {tt("Go to Project", "Ir al proyecto")}
                      </Link>
                    </div>
                  );
                })}
              </div>

              {/* Pending Items — FIX 6: real aggregate counts */}
              <div style={panel}>
                <div style={panelTitle}>{tt("Pending Items", "Elementos pendientes")}</div>
                {(() => {
                  const openRfisCount      = stats?.openRfis ?? 0;
                  const pendingSubsCount   = stats?.pendingSubmittals ?? 0;
                  const filesAttnCount     = agg.loading ? (stats?.filesNeedingAttention ?? 0) : filesNeedingAttention.length;
                  const allClear = stats !== undefined && openRfisCount === 0 && pendingSubsCount === 0 && filesAttnCount === 0;
                  if (allClear) {
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 6, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                        <CheckCircle2 style={{ width: 13, height: 13, color: "#16A34A" }} />
                        <span style={{ fontSize: 12, color: "#16A34A", fontWeight: 600 }}>{tt("All items up to date", "Todos los elementos están al día")}</span>
                      </div>
                    );
                  }
                  const rows: { label: string; count: number; color: string; bg: string; border: string; href: string }[] = [
                    {
                      label: tt("Open RFIs", "RFI abiertos"),
                      count: openRfisCount,
                      color: "#D97706", bg: "#FFFBEB", border: "#FDE68A",
                      href: "/pending?type=rfis",
                    },
                    {
                      label: tt("Pending Submittals", "Submittals pendientes"),
                      count: pendingSubsCount,
                      color: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE",
                      href: "/pending?type=submittals",
                    },
                    {
                      label: tt("Files Needing Attention", "Archivos que requieren atención"),
                      count: filesAttnCount,
                      color: "#DC2626", bg: "#FEF2F2", border: "#FECACA",
                      href: "/pending?type=files",
                    },
                  ];
                  return (
                    <>
                      {rows.filter(r => r.count > 0).map(r => (
                        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", marginBottom: 6, borderRadius: 6, background: r.bg, border: `1px solid ${r.border}`, cursor: "pointer" }} onClick={() => setLocation(r.href)}>
                          <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))" }}>{r.label}</div>
                          <span style={{ fontWeight: 700, fontSize: 13, color: r.color, background: "white", border: `1px solid ${r.border}`, padding: "1px 8px", borderRadius: 4 }}>{r.count}</span>
                           <span style={{ fontSize: 10, color: r.color, flexShrink: 0 }}>{tt("Go →", "Ir →")}</span>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* SECTION 4 — Your Projects */}
          <div style={{ marginBottom: 28 }}>
            {/* Header row with heading + New Project button */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "hsl(var(--foreground))", marginBottom: 4 }}>
                  {t("dashboard.title")}
                </h2>
                <p style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
                  {tt(
                    `${projectRows.length}/${allProjectRows.length} project${projectRows.length !== 1 ? "s" : ""} visible · ${visibleProjectFiles} files · ${visibleProjectMembers} team members`,
                    `${projectRows.length}/${allProjectRows.length} proyecto${projectRows.length !== 1 ? "s" : ""} visible${projectRows.length !== 1 ? "s" : ""} · ${visibleProjectFiles} archivo${visibleProjectFiles !== 1 ? "s" : ""} · ${visibleProjectMembers} miembro${visibleProjectMembers !== 1 ? "s" : ""} del equipo`,
                  )}
                </p>
              </div>
              <Button onClick={() => setShowCreate(true)} style={{ gap: 6, fontSize: 13 }}>
                <Plus style={{ width: 14, height: 14 }} />
                {t("dashboard.newProject")}
              </Button>
            </div>

            {/* Create project form */}
            {showCreate && (
              <CreateProjectForm onClose={() => setShowCreate(false)} onCreated={handleProjectCreated} />
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
                    {projectRows.map((project: any) => (
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
                    <div className="empty-desc">{t("dashboard.emptyDesc")}</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* SECTION 5 — Recent Activity + Top Naming Violators */}
          {!isLoading && (projects?.length ?? 0) > 0 && (
            <div className="headquarters-two-column" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

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
                      const detail = presentActivityDetails(entry.details, { actionType: entry.actionType, entityType: entry.entityType });
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
                            <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", maxWidth: 500 }}>
                              {proj ? <span style={{ fontWeight: 500 }}>{proj.name}</span> : null}
                              {detail.summary ? <span style={activityDetailsClampStyle}> {proj ? "— " : ""}{detail.summary}</span> : null}
                              {detail.meta.length > 0 ? <span style={{ display: "block", marginTop: 2 }}>{detail.meta.join(" • ")}</span> : null}
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
                      {topViolators.map(([co, data]) => {
                        const pid = [...data.pids][0];
                        return (
                          <tr key={co} style={{ cursor: "pointer" }} onClick={() => pid && setLocation(`/projects/${pid}/files`)}>
                            <td style={{ fontSize: 11, padding: "5px 8px", color: "#1D4ED8", fontWeight: 600, borderBottom: "1px solid hsl(var(--border)/0.5)", textDecoration: "underline" }}>{co}</td>
                            <td style={{ fontSize: 11, padding: "5px 8px", borderBottom: "1px solid hsl(var(--border)/0.5)" }}>
                              <span style={{ fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", padding: "1px 6px", borderRadius: 4 }}>{data.count}</span>
                            </td>
                            <td style={{ fontSize: 11, padding: "5px 8px", color: "hsl(var(--muted-foreground))", borderBottom: "1px solid hsl(var(--border)/0.5)" }}>{data.pids.size}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

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
  const { data: members } = useListMembers(project.id);
  const adminMember = (members as any[] | undefined)?.find((m: any) => m.role === "project_admin");
  const adminInitials = adminMember?.userFullName
    ? adminMember.userFullName.split(/\s+/).map((s: string) => s.charAt(0).toUpperCase()).slice(0, 2).join("")
    : "?";

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
              lineHeight: 1.5, marginBottom: 10,
              display: "-webkit-box", WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical", overflow: "hidden"
            }}>
              {project.description || t("dashboard.noDescription")}
            </div>

            {/* Admin info — always visible */}
            {adminMember && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
                padding: "6px 8px", background: "#F8FAFC",
                border: "1px solid #E2E8F0", borderRadius: 6,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: "#1D4ED8", color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, flexShrink: 0,
                }}>
                  {adminInitials}
                </div>
                <div style={{ minWidth: 0, flex: 1, fontSize: 11, lineHeight: 1.3 }}>
                  <div style={{ fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {adminMember.userFullName}
                  </div>
                  {adminMember.userCompanyName && (
                    <div style={{ color: "#6B7280", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {adminMember.userCompanyName}
                    </div>
                  )}
                </div>
              </div>
            )}
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
function CreateProjectForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", code: "", description: "" });

  const { mutate, isPending } = useCreateProject({
    mutation: {
      onSuccess: (data: any) => {
        console.log("CREATE PROJECT SUCCESS PAYLOAD", data);
        queryClient.invalidateQueries({ queryKey: ["/api/v1/projects"] });
        onCreated(data.id);
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
