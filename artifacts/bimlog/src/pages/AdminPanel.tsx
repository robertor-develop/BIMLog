import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logClientError } from "@/lib/client-log";
import { activityDetailsClampStyle, presentActivityDetails } from "@/lib/activity-presentation";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function apiFetch(path: string, token: string, opts?: RequestInit) {
  return fetch(`${API_BASE}/api/v1${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
  });
}

const TABS = ["Overview", "Users", "Companies", "Projects", "Email Log", "Activity Feed", "Feature Flags", "Admin Log", "AI Usage", "Feedback"];

const ADMIN_PANEL_SHELL_CSS = `
  .hq-admin-page {
    min-height: 100vh;
    overflow-x: hidden;
    background:
      radial-gradient(circle at top left, rgba(239, 68, 68, 0.08), transparent 34rem),
      linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.38) 100%);
  }
  .hq-admin-shell { width: min(1400px, calc(100% - 48px)); margin: 0 auto; padding: 28px 0 36px; }
  .hq-admin-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: start;
    padding: 24px;
    border: 1px solid hsl(var(--border));
    border-radius: 22px;
    background: linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%);
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
  }
  .hq-admin-kicker {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #ef4444;
  }
  .hq-admin-title {
    margin: 0;
    font-size: clamp(26px, 4vw, 38px);
    line-height: 1.05;
    font-weight: 900;
    letter-spacing: -0.04em;
    color: hsl(var(--foreground));
  }
  .hq-admin-subtitle {
    max-width: 820px;
    margin: 10px 0 0;
    font-size: 14px;
    line-height: 1.65;
    color: hsl(var(--muted-foreground));
  }
  .hq-admin-scope-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 18px;
  }
  .hq-admin-scope-card {
    min-width: 0;
    padding: 14px 16px;
    border: 1px solid hsl(var(--border));
    border-radius: 16px;
    background: hsl(var(--background) / 0.78);
  }
  .hq-admin-scope-card strong { display: block; margin-bottom: 4px; font-size: 12px; color: hsl(var(--foreground)); }
  .hq-admin-scope-card span { display: block; font-size: 12px; line-height: 1.45; color: hsl(var(--muted-foreground)); }
  .hq-admin-toolbar { display: flex; justify-content: flex-end; align-items: flex-start; }
  .hq-admin-tabs {
    display: flex;
    gap: 8px;
    margin: 18px 0;
    padding: 8px;
    overflow-x: auto;
    border: 1px solid hsl(var(--border));
    border-radius: 18px;
    background: hsl(var(--card) / 0.86);
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
  }
  .hq-admin-tab {
    flex: 0 0 auto;
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 9px 14px;
    background: transparent;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
    transition: all 0.15s ease;
  }
  .hq-admin-tab[data-active="true"] {
    border-color: rgba(239, 68, 68, 0.22);
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }
  .hq-admin-content {
    min-width: 0;
    padding: 22px;
    border: 1px solid hsl(var(--border));
    border-radius: 22px;
    background: hsl(var(--card));
    box-shadow: 0 18px 46px rgba(15, 23, 42, 0.06);
  }
  .hq-admin-content div:has(> table) {
    max-width: 100%;
    overflow-x: auto !important;
  }
  .hq-admin-content table { min-width: 760px; }
  .feedback-command-bar {
    position: sticky;
    top: 0;
    z-index: 12;
    margin: -8px -8px 16px;
    padding: 12px 8px;
    background: hsl(var(--card) / 0.96);
    border-bottom: 1px solid hsl(var(--border));
    backdrop-filter: blur(10px);
  }
  .feedback-review-cards { display: none; }
  @media (max-width: 720px) {
    .hq-admin-shell { width: min(100% - 24px, 390px); padding: 14px 0 24px; }
    .hq-admin-hero { grid-template-columns: 1fr; padding: 18px; border-radius: 18px; }
    .hq-admin-toolbar { justify-content: stretch; }
    .hq-admin-toolbar button { width: 100%; }
    .hq-admin-scope-grid { grid-template-columns: 1fr; }
    .hq-admin-tabs { margin: 14px 0; border-radius: 16px; }
    .hq-admin-tab { padding: 9px 12px; font-size: 12px; }
    .hq-admin-content { padding: 14px; border-radius: 18px; }
    .feedback-command-bar { top: 0; margin: -4px -4px 14px; padding: 10px 4px; }
    .feedback-review-table { display: none; }
    .feedback-review-cards { display: grid; gap: 12px; }
  }
`;

const FLAG_LABELS: Record<string, string> = {
  ai_presubmission_check: "AI Pre-Submission Check",
  ai_name_suggestion: "AI Name Suggestion",
  audit_certificate: "Audit Certificate",
  email_notifications: "Email Notifications",
  rapid_approval_detection: "Rapid Approval Detection",
  procurement_before_approval_warning: "Procurement Before Approval Warning",
  meeting_minutes: "Meeting Minutes",
  transmittal_manager: "Transmittal Manager",
  cvr_mismatch_workflow: "CVR Mismatch Workflow",
  automated_accountability_emails: "Automated Accountability Emails",
  weekly_compliance_report: "Weekly Compliance Report",
};

const STAT_LABELS: Record<string, string> = {
  totalUsers: "Users",
  totalCompanies: "Companies",
  totalProjects: "Projects",
  totalFiles: "Files",
  totalRfis: "RFIs",
  totalSubmittals: "Submittals",
  activeProjects: "Active Projects",
  filesLast24h: "Files (24h)",
  rfisLast7d: "RFIs (7d)",
};
const STAT_LABELS_ES: Record<string, string> = {
  totalUsers: "Usuarios",
  totalCompanies: "Compañías",
  totalProjects: "Proyectos",
  totalFiles: "Archivos",
  totalRfis: "RFIs",
  totalSubmittals: "Submittals",
  activeProjects: "Proyectos Activos",
  filesLast24h: "Archivos (24h)",
  rfisLast7d: "RFIs (7d)",
};

function isSpanishUi() {
  return typeof window !== "undefined" && localStorage.getItem("bimlog-lang") === "es";
}

const statusColor: Record<string, string> = {
  active: "#22c55e", archived: "#f59e0b", inactive: "#94a3b8",
  sent: "#22c55e", failed: "#ef4444", skipped: "#f59e0b", pending: "#94a3b8",
  approved: "#22c55e", rejected: "#ef4444", under_review: "#3b82f6",
};

function Badge({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{ display: "inline-block", padding: "1px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: color ? `${color}22` : "hsl(var(--secondary))", color: color || "hsl(var(--foreground))", border: `1px solid ${color ? `${color}44` : "hsl(var(--border))"}` }}>
      {label}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: 24, minWidth: 400, maxWidth: 560, width: "90vw", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "hsl(var(--muted-foreground))" }}>X</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "16px 20px", width: 160, minWidth: 140, flexShrink: 0, boxSizing: "border-box" }}>
      <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginBottom: 6, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "hsl(var(--foreground))", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid hsl(var(--border))", whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 12px", fontSize: 13, borderBottom: "1px solid hsl(var(--border))", verticalAlign: "middle", ...style }}>{children}</td>;
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ token }: { token: string }) {
  const [data, setData] = useState<{ stats: Record<string, number>; activity: Record<string, unknown>[] } | null>(null);
  useEffect(() => { apiFetch("/admin/overview?scope=mine", token).then(r => r.json()).then(setData).catch((error) => logClientError("admin overview load", error)); }, [token]);
  const es = isSpanishUi();
  if (!data) return <div style={{ padding: 32, color: "hsl(var(--muted-foreground))" }}>{es ? "Cargando..." : "Loading..."}</div>;
  return (
    <div>
      <div style={{ marginBottom: 16, padding: "8px 14px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>
        {es ? "Mostrando datos limitados a los proyectos que administras. Los datos de toda la plataforma están disponibles en Control Total (solo superadmin)." : "Showing data scoped to projects you administer. Platform-wide data is available in Total Control (super admin only)."}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        {Object.entries(data.stats).map(([k, v]) => (
          <StatCard key={k} label={(es ? STAT_LABELS_ES[k] : STAT_LABELS[k]) || k.replace(/([A-Z])/g, " $1").replace(/_/g, " ")} value={v} />
        ))}
      </div>
      <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>{es ? "Actividad de Proyectos (últimos 50)" : "Project Activity Feed (last 50)"}</h3>
      {data.activity.length === 0
        ? <div style={{ padding: "32px 0", color: "hsl(var(--muted-foreground))", fontSize: 13, textAlign: "center" }}>{es ? "Sin actividad todavía. Las acciones tomadas en proyectos aparecerán aquí." : "No activity yet. Actions taken in projects will appear here."}</div>
        : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>{es ? "Proyecto" : "Project"}</Th><Th>{es ? "Usuario" : "User"}</Th><Th>{es ? "Acción" : "Action"}</Th><Th>{es ? "Entidad" : "Entity"}</Th><Th>{es ? "Detalle" : "Details"}</Th><Th>{es ? "Fecha" : "When"}</Th></tr></thead>
              <tbody>
                {data.activity.map((a: Record<string, unknown>) => {
                  const detail = presentActivityDetails(a.details, { actionType: String(a.actionType || ""), entityType: String(a.entityType || "") });
                  return (
                    <tr key={String(a.id)}>
                      <Td><span style={{ fontWeight: 500 }}>{String(a.projectName || "")}</span></Td>
                      <Td><div>{String(a.userFullName || "")}</div><div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{String(a.userCompanyName || "")}</div></Td>
                      <Td><Badge label={String(a.actionType || "")} color="#3b82f6" /></Td>
                      <Td>{String(a.entityType || "")}{a.entityId ? ` #${a.entityId}` : ""}</Td>
                      <Td style={{ maxWidth: 400 }}><span style={{ ...activityDetailsClampStyle, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{detail.summary || "—"}</span>{detail.meta.length > 0 && <span style={{ display: "block", marginTop: 3, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{detail.meta.join(" • ")}</span>}</Td>
                      <Td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{new Date(String(a.createdAt)).toLocaleString()}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UsersTab({ token }: { token: string }) {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [resetModal, setResetModal] = useState<number | null>(null);
  const [newPw, setNewPw] = useState("");
  const [createForm, setCreateForm] = useState({ fullName: "", email: "", password: "", companyName: "", projectId: "" });
  const [showPw, setShowPw] = useState(false);
  const [projectsList, setProjectsList] = useState<{ id: number; code: string; name: string }[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/admin/users?scope=mine&search=${encodeURIComponent(search)}`, token)
      .then(r => r.json()).then(d => setUsers(d.data || [])).finally(() => setLoading(false));
  }, [search, token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch("/admin/projects-list?scope=mine", token).then(r => r.json()).then(setProjectsList).catch((error) => logClientError("admin users project list load", error));
  }, [token]);

  const deleteUser = async (id: number, name: string) => {
    if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
    await apiFetch(`/admin/users/${id}`, token, { method: "DELETE" });
    setMsg("User deleted."); load();
  };

  const doResetPw = async () => {
    if (!resetModal) return;
    const r = await apiFetch(`/admin/users/${resetModal}/reset-password`, token, { method: "POST", body: JSON.stringify({ password: newPw }) });
    const d = await r.json();
    if (d.success) { setResetModal(null); setNewPw(""); setMsg("Password reset."); }
    else setMsg(d.error || "Failed");
  };
  const doCreate = async () => {
    const body: Record<string, unknown> = { ...createForm };
    if (createForm.projectId) body.projectId = parseInt(createForm.projectId);
    else delete body.projectId;
    const r = await apiFetch("/admin/users", token, { method: "POST", body: JSON.stringify(body) });
    const d = await r.json();
    if (d.id) { setShowCreate(false); setCreateForm({ fullName: "", email: "", password: "", companyName: "", projectId: "" }); setMsg("User created."); load(); }
    else setMsg(d.error || "Failed");
  };

  return (
    <div>
      {msg && <div style={{ background: "#22c55e22", border: "1px solid #22c55e44", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#16a34a" }}>{msg}</div>}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
        <Button size="sm" onClick={load}>Search</Button>
        <Button size="sm" style={{ marginLeft: "auto" }} onClick={() => setShowCreate(true)}>+ Create User</Button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>Name</Th><Th>Email</Th><Th>Company</Th><Th>Projects</Th><Th>Role</Th><Th>Joined</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {users.map((u: Record<string, unknown>) => (
              <tr key={String(u.id)}>
                <Td><span style={{ fontWeight: 500 }}>{String(u.fullName || "")}</span></Td>
                <Td style={{ fontSize: 12 }}>{String(u.email || "")}</Td>
                <Td style={{ fontSize: 12 }}>{String(u.companyName || "")}</Td>
                <Td>{String(u.projectCount || 0)}</Td>
                <Td>
                  <Badge label={String(u.role || "user")} />
                </Td>
                <Td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{new Date(String(u.createdAt)).toLocaleDateString()}</Td>
                <Td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button size="sm" variant="outline" onClick={() => { setResetModal(u.id as number); setNewPw(""); }}>Reset PW</Button>
                    <Button size="sm" variant="outline" style={{ color: "#ef4444", borderColor: "#ef444444" }} onClick={() => deleteUser(u.id as number, String(u.fullName))}>Delete</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <div style={{ padding: 16, color: "hsl(var(--muted-foreground))", textAlign: "center" }}>Loading...</div>}
      {resetModal && (
        <Modal title="Reset Password" onClose={() => setResetModal(null)}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>New Password (min 8 chars)</label>
            <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
          </div>
          <Button onClick={doResetPw} disabled={newPw.length < 8}>Set Password</Button>
        </Modal>
      )}
      {showCreate && (
        <Modal title="Create User" onClose={() => setShowCreate(false)}>
          {["fullName", "email", "password", "companyName"].map(field => (
            <div key={field} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{field.replace(/([A-Z])/g, " $1")}</label>
              {field === "password" ? (
                <div style={{ position: "relative" }}>
                  <Input type={showPw ? "text" : "password"} value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} style={{ paddingRight: 38 }} />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "hsl(var(--muted-foreground))" }}>
                    {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </div>
              ) : (
                <Input type="text" value={(createForm as Record<string, string>)[field]} onChange={e => setCreateForm(f => ({ ...f, [field]: e.target.value }))} />
              )}
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Assign to Project</label>
            <select value={createForm.projectId} onChange={e => setCreateForm(f => ({ ...f, projectId: e.target.value }))} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontSize: 13 }}>
              <option value="">Select project...</option>
              {projectsList.map(p => <option key={p.id} value={String(p.id)}>{p.code} — {p.name}</option>)}
            </select>
            <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 4 }}>Required for project-scoped admin. Links user as project member.</div>
          </div>
          <Button onClick={doCreate}>Create</Button>
        </Modal>
      )}
    </div>
  );
}

// ── Companies Tab ─────────────────────────────────────────────────────────────
function CompaniesTab({ token }: { token: string }) {
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [conventionSummary, setConventionSummary] = useState<Array<{ projectId: number; projectName: string; codes: string[]; assignedCodes: string[]; unassignedCodes: string[] }>>([]);
  const [editModal, setEditModal] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState("");

  const load = () => {
    apiFetch("/admin/companies?scope=mine", token).then(r => r.json()).then(setCompanies).catch((error) => logClientError("admin companies load", error));
    apiFetch("/admin/projects?scope=mine", token).then(r => r.json()).then((projects: any[]) => {
      setConventionSummary(projects
        .filter(p => p.conventionCompanyCodes?.length > 0)
        .map(p => ({
          projectId: p.id,
          projectName: `${p.code} — ${p.name}`,
          codes: p.conventionCompanyCodes || [],
          assignedCodes: (p.conventionCompanyCodes || []).filter((c: string) => !(p.unassignedConventionCompanies || []).includes(c)),
          unassignedCodes: p.unassignedConventionCompanies || [],
        })));
    }).catch((error) => logClientError("admin company users load", error));
  };
  useEffect(() => { load(); }, [token]);

  const doDelete = async (id: number, name: string, userCount: number) => {
    if (!confirm(`Delete company "${name}"? This will affect ${userCount} user(s).`)) return;
    await apiFetch(`/admin/companies/${id}`, token, { method: "DELETE" });
    setMsg("Company deleted."); load();
  };
  const doSave = async () => {
    if (!editModal) return;
    await apiFetch(`/admin/companies/${editModal.id}`, token, { method: "PATCH", body: JSON.stringify({ name: editModal.name, website: editModal.website, address: editModal.address, phone: editModal.phone }) });
    setEditModal(null); setMsg("Company updated."); load();
  };

  return (
    <div>
      {msg && <div style={{ background: "#22c55e22", border: "1px solid #22c55e44", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#16a34a" }}>{msg}</div>}

      {conventionSummary.length > 0 && (
        <div style={{ marginBottom: 20, padding: 14, border: "1px solid hsl(var(--border))", borderRadius: 10, background: "hsl(var(--card))" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: "hsl(var(--foreground))" }}>Convention Companies vs Participating Companies</div>
          <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 12 }}>
            Convention companies are originator codes in the naming convention. Participating companies have users assigned as project members.
          </div>
          {conventionSummary.map(ps => (
            <div key={ps.projectId} style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))" }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{ps.projectName}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ps.codes.map(code => {
                  const assigned = ps.assignedCodes.includes(code);
                  return (
                    <span key={code} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 8px", borderRadius: 16, fontSize: 11, fontWeight: 700,
                      background: assigned ? "#f0fdf4" : "#fef2f2",
                      color: assigned ? "#15803d" : "#dc2626",
                      border: `1px solid ${assigned ? "#bbf7d0" : "#fecaca"}`,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: assigned ? "#16a34a" : "#dc2626" }} />
                      {code}
                      <span style={{ fontSize: 9, opacity: 0.8 }}>{assigned ? "assigned" : "no users"}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: "hsl(var(--foreground))" }}>Participating Companies</div>
      <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginBottom: 10 }}>Companies with users assigned as members on your projects. Counts reflect only users and files within your project scope.</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>Company</Th><Th>Users</Th><Th>Projects</Th><Th>Created</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {companies.map((c: Record<string, unknown>) => (
              <tr key={String(c.id)}>
                <Td><span style={{ fontWeight: 600 }}>{String(c.name || "")}</span></Td>
                <Td>{String(c.userCount || 0)}</Td>
                <Td>{String(c.projectCount || 0)}</Td>
                <Td style={{ fontSize: 11 }}>{new Date(String(c.createdAt)).toLocaleDateString()}</Td>
                <Td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <Button size="sm" variant="outline" onClick={() => setEditModal({ ...c })}>Edit</Button>
                    <Button size="sm" variant="outline" style={{ color: "#ef4444", borderColor: "#ef444444" }} onClick={() => doDelete(c.id as number, String(c.name), c.userCount as number)}>Delete</Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editModal && (
        <Modal title="Edit Company" onClose={() => setEditModal(null)}>
          {["name", "website", "address", "phone"].map(field => (
            <div key={field} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
              <Input value={String((editModal as Record<string, unknown>)[field] || "")} onChange={e => setEditModal(m => ({ ...m!, [field]: e.target.value }))} />
            </div>
          ))}
          <Button onClick={doSave}>Save</Button>
        </Modal>
      )}
    </div>
  );
}

// ── Projects Tab ──────────────────────────────────────────────────────────────
function ProjectsTab({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const [projects, setProjects] = useState<Record<string, unknown>[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, unknown>[]>([]);
  const [transferModal, setTransferModal] = useState<number | null>(null);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => {
    apiFetch("/admin/projects?scope=mine", token).then(r => r.json()).then(setProjects).catch((error) => logClientError("admin projects load", error));
    apiFetch("/admin/users?scope=mine", token).then(r => r.json()).then(d => setAllUsers(d.data || [])).catch((error) => logClientError("admin project users load", error));
  };
  useEffect(() => { load(); }, [token]);

  const doDelete = async (id: number, name: string) => {
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    await apiFetch(`/admin/projects/${id}`, token, { method: "DELETE" });
    setMsg("Project deleted."); load();
  };
  const doArchive = async (id: number, status: string) => {
    const newStatus = status === "archived" ? "active" : "archived";
    await apiFetch(`/admin/projects/${id}`, token, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
    setMsg(`Project ${newStatus}.`); load();
  };
  const doTransfer = async () => {
    if (!transferModal || !newOwnerId) return;
    const r = await apiFetch(`/admin/projects/${transferModal}/transfer`, token, { method: "POST", body: JSON.stringify({ newOwnerId: parseInt(newOwnerId) }) });
    const d = await r.json();
    if (d.id) { setTransferModal(null); setNewOwnerId(""); setMsg("Ownership transferred."); load(); }
    else setMsg(d.error || "Failed");
  };

  return (
    <div>
      {msg && <div style={{ background: "#22c55e22", border: "1px solid #22c55e44", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#16a34a" }}>{msg}</div>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>Project</Th><Th>Code</Th><Th>Company</Th><Th>Convention Cos.</Th><Th>Status</Th><Th>Members</Th><Th>Files</Th><Th>Created</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {projects.map((p: Record<string, unknown>) => {
              const convCodes = (p.conventionCompanyCodes || []) as string[];
              const unassigned = (p.unassignedConventionCompanies || []) as string[];
              return (
              <tr key={String(p.id)}>
                <Td><span style={{ fontWeight: 600 }}>{String(p.name || "")}</span></Td>
                <Td style={{ fontSize: 12, fontFamily: "monospace" }}>{String(p.code || "")}</Td>
                <Td style={{ fontSize: 12 }}>{String(p.companyName || "")}</Td>
                <Td>
                  {convCodes.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {convCodes.map(c => (
                        <span key={c} style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 8, background: unassigned.includes(c) ? "#fef2f2" : "#f0fdf4", color: unassigned.includes(c) ? "#dc2626" : "#15803d", border: `1px solid ${unassigned.includes(c) ? "#fecaca" : "#bbf7d0"}` }}>{c}</span>
                      ))}
                    </div>
                  ) : <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>--</span>}
                </Td>
                <Td><Badge label={String(p.status || "")} color={statusColor[String(p.status)] || undefined} /></Td>
                <Td>{String(p.memberCount || 0)}</Td>
                <Td>{String(p.fileCount || 0)}</Td>
                <Td style={{ fontSize: 11 }}>{new Date(String(p.createdAt)).toLocaleDateString()}</Td>
                <Td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <Button size="sm" variant="outline" onClick={() => setLocation(`/projects/${p.id}/analytics`)}>View</Button>
                    <Button size="sm" variant="outline" onClick={() => doArchive(p.id as number, String(p.status))}>{p.status === "archived" ? "Restore" : "Archive"}</Button>
                    <Button size="sm" variant="outline" onClick={() => { setTransferModal(p.id as number); setNewOwnerId(""); }}>Transfer</Button>
                    <Button size="sm" variant="outline" style={{ color: "#ef4444", borderColor: "#ef444444" }} onClick={() => doDelete(p.id as number, String(p.name))}>Delete</Button>
                  </div>
                </Td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {transferModal && (
        <Modal title="Transfer Ownership" onClose={() => setTransferModal(null)}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>New Owner</label>
            <select value={newOwnerId} onChange={e => setNewOwnerId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontSize: 13 }}>
              <option value="">Select user...</option>
              {allUsers.map((u: Record<string, unknown>) => <option key={String(u.id)} value={String(u.id)}>{String(u.fullName)} ({String(u.email)})</option>)}
            </select>
          </div>
          <Button onClick={doTransfer} disabled={!newOwnerId}>Transfer</Button>
        </Modal>
      )}
    </div>
  );
}

// ── Email Log Tab ─────────────────────────────────────────────────────────────
function EmailLogTab({ token }: { token: string }) {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: "", triggerType: "", from: "", to: "" });

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    apiFetch(`/admin/email-log?scope=mine&${params}`, token).then(r => r.json()).then(d => { setLogs(d.data || []); setTotal(d.total || 0); }).catch((error) => logClientError("admin email log load", error));
  }, [token, page, filters]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--background))", color: "hsl(var(--foreground))", fontSize: 12 }}>
          <option value="">All Status</option>
          <option value="sent">Sent</option><option value="failed">Failed</option><option value="skipped">Skipped</option>
        </select>
        <Input placeholder="Trigger type..." value={filters.triggerType} onChange={e => setFilters(f => ({ ...f, triggerType: e.target.value }))} style={{ width: 160 }} />
        <Input type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} style={{ width: 140 }} />
        <Input type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} style={{ width: 140 }} />
        <Button size="sm" onClick={load}>Filter</Button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "hsl(var(--muted-foreground))", alignSelf: "center" }}>{total} records</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>To</Th><Th>Subject</Th><Th>Trigger</Th><Th>Status</Th><Th>Error</Th><Th>Sent At</Th></tr></thead>
          <tbody>
            {logs.map((l: Record<string, unknown>) => (
              <tr key={String(l.id)}>
                <Td style={{ fontSize: 12 }}>{String(l.toEmail || "")}</Td>
                <Td style={{ maxWidth: 240, fontSize: 12 }}>{String(l.subject || "")}</Td>
                <Td><Badge label={String(l.triggerType || "—")} /></Td>
                <Td><Badge label={String(l.status || "")} color={statusColor[String(l.status)] || undefined} /></Td>
                <Td style={{ fontSize: 11, color: "#ef4444" }}>{String(l.errorMessage || "")}</Td>
                <Td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{new Date(String(l.sentAt)).toLocaleString()}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 50 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
          <span style={{ fontSize: 12, alignSelf: "center" }}>Page {page} of {Math.ceil(total / 50)}</span>
          <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ── Activity Feed Tab ─────────────────────────────────────────────────────────
function ActivityFeedTab({ token }: { token: string }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const load = useCallback(() => {
    apiFetch(`/admin/activity?scope=mine&page=${page}`, token).then(r => r.json()).then(d => { setItems(d.data || []); setTotal(d.total || 0); }).catch((error) => logClientError("admin activity load", error));
  }, [token, page]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{total} total events across all projects</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>Project</Th><Th>User</Th><Th>Company</Th><Th>Action</Th><Th>Entity</Th><Th>Details</Th><Th>When</Th></tr></thead>
          <tbody>
            {items.map((a: Record<string, unknown>) => {
              const detail = presentActivityDetails(a.details, { actionType: String(a.actionType || ""), entityType: String(a.entityType || "") });
              return (
                <tr key={String(a.id)}>
                  <Td style={{ fontWeight: 500, fontSize: 12 }}>{String(a.projectName || "")}</Td>
                  <Td style={{ fontSize: 12 }}>{String(a.userFullName || "")}</Td>
                  <Td style={{ fontSize: 12 }}>{String(a.userCompanyName || "")}</Td>
                  <Td><Badge label={String(a.actionType || "")} color="#3b82f6" /></Td>
                  <Td style={{ fontSize: 12 }}>{String(a.entityType || "")}</Td>
                  <Td style={{ maxWidth: 400, fontSize: 11, color: "hsl(var(--muted-foreground))" }}><span style={activityDetailsClampStyle}>{detail.summary || "—"}</span>{detail.meta.length > 0 && <span style={{ display: "block", marginTop: 3 }}>{detail.meta.join(" • ")}</span>}</Td>
                  <Td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{new Date(String(a.createdAt)).toLocaleString()}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {total > 50 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
          <span style={{ fontSize: 12, alignSelf: "center" }}>Page {page} of {Math.ceil(total / 50)}</span>
          <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ── Feature Flags Tab ─────────────────────────────────────────────────────────
function FeatureFlagsTab({ token }: { token: string }) {
  const [flags, setFlags] = useState<Record<string, unknown>[]>([]);
  const [msg, setMsg] = useState("");
  const load = () => apiFetch("/admin/feature-flags?scope=mine", token).then(r => r.json()).then(setFlags).catch((error) => logClientError("admin feature flags load", error));
  useEffect(() => { load(); }, [token]);
  const toggle = async (id: number, enabled: boolean) => {
    await apiFetch(`/admin/feature-flags/${id}`, token, { method: "PATCH", body: JSON.stringify({ enabled: !enabled }) });
    setMsg(`Flag updated.`); load();
  };
  return (
    <div>
      {msg && <div style={{ background: "#22c55e22", border: "1px solid #22c55e44", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#16a34a" }}>{msg}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {flags.map((f: Record<string, unknown>) => (
          <div key={String(f.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: "16px 20px" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{FLAG_LABELS[String(f.flagName)] || String(f.flagName)}</div>
              <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 2 }}>Applies to: {String(f.appliesTo)} · Last updated: {new Date(String(f.updatedAt)).toLocaleString()}</div>
            </div>
            <button
              onClick={() => toggle(f.id as number, f.enabled as boolean)}
              style={{
                width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
                background: f.enabled ? "#22c55e" : "#94a3b8",
                transition: "background 0.2s", position: "relative",
              }}
            >
              <span style={{ position: "absolute", top: 3, left: f.enabled ? "calc(100% - 22px)" : 3, width: 20, height: 20, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Admin Actions Log Tab ─────────────────────────────────────────────────────
function AdminActionsLogTab({ token }: { token: string }) {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const load = useCallback(() => {
    apiFetch(`/admin/actions-log?scope=mine&page=${page}`, token).then(r => r.json()).then(d => { setLogs(d.data || []); setTotal(d.total || 0); }).catch((error) => logClientError("admin actions log load", error));
  }, [token, page]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{total} admin actions (immutable log)</div>
      {logs.length === 0
        ? <div style={{ padding: "32px 0", color: "hsl(var(--muted-foreground))", fontSize: 13, textAlign: "center" }}>No admin actions recorded yet.</div>
        : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>Admin</Th><Th>Action</Th><Th>Target Type</Th><Th>Target ID</Th><Th>Details</Th><Th>When</Th></tr></thead>
              <tbody>
                {logs.map((l: Record<string, unknown>) => (
                  <tr key={String(l.id)}>
                    <Td style={{ fontSize: 12 }}>{String(l.adminEmail || "")}</Td>
                    <Td><Badge label={String(l.action || "")} color="#f59e0b" /></Td>
                    <Td style={{ fontSize: 12 }}>{String(l.targetType || "—")}</Td>
                    <Td style={{ fontSize: 12, fontFamily: "monospace" }}>{String(l.targetId || "—")}</Td>
                    <Td style={{ maxWidth: 400, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{(() => { const detail = presentActivityDetails(l.details, { actionType: String(l.action || ""), entityType: String(l.targetType || "") }); return <><span style={activityDetailsClampStyle}>{detail.summary || "—"}</span>{detail.meta.length > 0 && <span style={{ display: "block", marginTop: 3 }}>{detail.meta.join(" • ")}</span>}</>; })()}</Td>
                    <Td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{new Date(String(l.createdAt)).toLocaleString()}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
      {total > 50 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
          <span style={{ fontSize: 12, alignSelf: "center" }}>Page {page} of {Math.ceil(total / 50)}</span>
          <Button size="sm" variant="outline" onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}>Next</Button>
        </div>
      )}
    </div>
  );
}

// ── Main AdminPanel ───────────────────────────────────────────────────────────
type AiUsageData = {
  month: string;
  summary: Record<string, number | string | null>;
  users: Record<string, unknown>[];
  features: Record<string, unknown>[];
  projects: Record<string, unknown>[];
  recent: Record<string, unknown>[];
};

function billingModeLabel(mode: unknown) {
  const value = String(mode || "");
  if (value === "platform_internal") return "BIMLog internal";
  if (value === "included_platform") return "Included credits";
  if (value === "user_key") return "User key";
  return value || "Unknown";
}

function numberValue(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function AiUsageTab({ token }: { token: string }) {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<AiUsageData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch(`/admin/ai-usage?month=${encodeURIComponent(month)}`, token)
      .then(async r => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || "Unable to load AI usage.");
        setData(body);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Unable to load AI usage."))
      .finally(() => setLoading(false));
  }, [month, token]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary ?? {};
  const users = data?.users ?? [];
  const features = data?.features ?? [];
  const projects = data?.projects ?? [];
  const recent = data?.recent ?? [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>AI Usage</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
            Super-admin view of AI calls, credit units, billing mode, users, projects, and recent activity.
          </p>
        </div>
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} style={{ width: 160, marginLeft: "auto" }} />
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? "Loading..." : "Refresh"}</Button>
      </div>

      {error && (
        <div style={{ background: "#ef444422", border: "1px solid #ef444444", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#b91c1c", fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <StatCard label="AI Calls" value={numberValue(summary.total_calls)} />
        <StatCard label="Credit Units" value={numberValue(summary.total_units)} />
        <StatCard label="Included Calls" value={numberValue(summary.included_calls)} />
        <StatCard label="Internal Calls" value={numberValue(summary.internal_calls)} />
        <StatCard label="User-Key Calls" value={numberValue(summary.user_key_calls)} />
        <StatCard label="Active Users" value={numberValue(summary.active_users)} />
        <StatCard label="Projects" value={numberValue(summary.active_projects)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)", gap: 20, alignItems: "start" }}>
        <section style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800 }}>Usage by User</h3>
          {users.length === 0 ? (
            <div style={{ padding: "24px 0", color: "hsl(var(--muted-foreground))", fontSize: 13, textAlign: "center" }}>No AI usage for this month.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><Th>User</Th><Th>Company</Th><Th>Calls</Th><Th>Units</Th><Th>Included</Th><Th>Internal</Th><Th>User Key</Th><Th>Last Used</Th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={String(u.user_id)}>
                      <Td>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{String(u.full_name || "Unnamed")}</div>
                        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{String(u.email || "")}</div>
                      </Td>
                      <Td style={{ fontSize: 12 }}>{String(u.company_name || "-")}</Td>
                      <Td style={{ fontSize: 12 }}>{numberValue(u.total_calls)}</Td>
                      <Td style={{ fontSize: 12, fontWeight: 700 }}>{numberValue(u.total_units)}</Td>
                      <Td style={{ fontSize: 12 }}>{numberValue(u.included_calls)}</Td>
                      <Td style={{ fontSize: 12 }}>{numberValue(u.internal_calls)}</Td>
                      <Td style={{ fontSize: 12 }}>{numberValue(u.user_key_calls)}</Td>
                      <Td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{u.last_used_at ? new Date(String(u.last_used_at)).toLocaleString() : "-"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800 }}>Usage by Feature</h3>
          {features.length === 0 ? (
            <div style={{ padding: "24px 0", color: "hsl(var(--muted-foreground))", fontSize: 13, textAlign: "center" }}>No feature usage yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><Th>Feature</Th><Th>Mode</Th><Th>Calls</Th><Th>Units</Th></tr></thead>
                <tbody>
                  {features.map((f, i) => (
                    <tr key={`${String(f.feature)}-${String(f.billing_mode)}-${i}`}>
                      <Td style={{ fontSize: 12, fontWeight: 700 }}>{String(f.feature || "-")}</Td>
                      <Td><Badge label={billingModeLabel(f.billing_mode)} color={String(f.billing_mode) === "user_key" ? "#22c55e" : "#3b82f6"} /></Td>
                      <Td style={{ fontSize: 12 }}>{numberValue(f.total_calls)}</Td>
                      <Td style={{ fontSize: 12, fontWeight: 700 }}>{numberValue(f.total_units)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800 }}>Usage by Project</h3>
          {projects.length === 0 ? (
            <div style={{ padding: "24px 0", color: "hsl(var(--muted-foreground))", fontSize: 13, textAlign: "center" }}>No project usage yet.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><Th>Project</Th><Th>Calls</Th><Th>Units</Th></tr></thead>
                <tbody>
                  {projects.map((p, i) => (
                    <tr key={`${String(p.project_id || "none")}-${i}`}>
                      <Td>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{String(p.project_name || "No project")}</div>
                        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{String(p.project_code || "")}</div>
                      </Td>
                      <Td style={{ fontSize: 12 }}>{numberValue(p.total_calls)}</Td>
                      <Td style={{ fontSize: 12, fontWeight: 700 }}>{numberValue(p.total_units)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 10, padding: 16 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 800 }}>Recent AI Calls</h3>
          {recent.length === 0 ? (
            <div style={{ padding: "24px 0", color: "hsl(var(--muted-foreground))", fontSize: 13, textAlign: "center" }}>No recent AI calls.</div>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><Th>When</Th><Th>User</Th><Th>Feature</Th><Th>Mode</Th><Th>Units</Th><Th>Project</Th></tr></thead>
                <tbody>
                  {recent.map(r => (
                    <tr key={String(r.id)}>
                      <Td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{new Date(String(r.created_at)).toLocaleString()}</Td>
                      <Td>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{String(r.full_name || "Unnamed")}</div>
                        <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{String(r.email || "")}</div>
                      </Td>
                      <Td style={{ fontSize: 12 }}>{String(r.feature || "-")}</Td>
                      <Td><Badge label={billingModeLabel(r.billing_mode)} color={String(r.billing_mode) === "user_key" ? "#22c55e" : "#3b82f6"} /></Td>
                      <Td style={{ fontSize: 12, fontWeight: 700 }}>{numberValue(r.estimated_units)}</Td>
                      <Td style={{ fontSize: 12 }}>{String(r.project_name || r.project_code || "-")}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const FEEDBACK_STATUS_OPTIONS = [
  { value: "new", label: "New", labelEs: "Nuevo" },
  { value: "triaged", label: "Triaged", labelEs: "Clasificado" },
  { value: "accepted", label: "Accepted", labelEs: "Aceptado" },
  { value: "in_progress", label: "In progress", labelEs: "En progreso" },
  { value: "blocked", label: "Blocked", labelEs: "Bloqueado" },
  { value: "fixed", label: "Fixed", labelEs: "Corregido" },
  { value: "verified", label: "Verified", labelEs: "Verificado" },
  { value: "rejected", label: "Rejected", labelEs: "Rechazado" },
  { value: "deferred", label: "Deferred", labelEs: "Aplazado" },
];

const FEEDBACK_STATUS_TRANSITIONS: Record<string, string[]> = {
  new: ["triaged", "rejected"],
  triaged: ["accepted", "deferred", "rejected"],
  accepted: ["in_progress", "blocked", "deferred"],
  in_progress: ["blocked", "fixed"],
  blocked: ["in_progress", "deferred"],
  fixed: ["verified", "in_progress"],
  verified: ["triaged"],
  rejected: ["triaged"],
  deferred: ["triaged"],
};

const feedbackActivityLabel = (value: unknown) => ({
  created: "Feedback submitted",
  submission_acknowledged: "Submission acknowledged",
  internal_reviewer_notifications_created: "Review team notified",
  assets_added: "Evidence attached",
  evidence_scan_clean: "Evidence verified safe",
  evidence_scan_rejected: "Evidence rejected by controlled scanning",
  triage_updated: "Review status updated",
  customer_response: "Customer response sent",
  customer_decision: "Decision shared with customer",
  customer_fix: "Resolution shared with customer",
  customer_answer: "Answer shared with customer",
  reopened: "Feedback reopened",
}[String(value)] || String(value).replace(/_/g, " "));

type FeedbackTranslate = (english: string, spanish: string) => string;

function TelegramDeliveryStatus({ value, t, compact = false }: { value: unknown; t: FeedbackTranslate; compact?: boolean }) {
  const delivery = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const outcomes = Array.isArray(delivery.outcomes) ? delivery.outcomes.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)) : [];
  const rawOverallState = String(delivery.overallState || "not-requested");
  const representedArtifacts = new Set(outcomes.map(outcome => String(outcome.artifactKind)));
  const allRequiredSent = representedArtifacts.has("docx") && representedArtifacts.has("xlsx") && outcomes.every(outcome => String(outcome.state) === "sent");
  const overallState = rawOverallState === "sent" && !allRequiredSent ? "incomplete" : rawOverallState;
  const overall = ({
    sent: { label: t("Delivered", "Entregado"), explanation: t("Every required Word and Excel delivery was acknowledged.", "Se confirmó la entrega de cada Word y Excel requerido."), color: "#166534" },
    failed: { label: t("Action required — failed", "Acción requerida — falló"), explanation: t("At least one document failed. Inspect the matrix, correct package or provider authority, then use the governed retry process.", "Falló al menos un documento. Revisa la matriz, corrige la autoridad del paquete o proveedor y usa el proceso gobernado de reintento."), color: "#b91c1c" },
    partial: { label: t("Action required — partial", "Acción requerida — parcial"), explanation: t("Only some required documents reached their recipients. Missing or failed rows are not sent.", "Solo algunos documentos llegaron a sus destinatarios. Las filas faltantes o fallidas no están enviadas."), color: "#b45309" },
    pending: { label: t("Pending delivery", "Entrega pendiente"), explanation: t("Delivery has not settled. Refresh shortly; investigate any row that remains pending.", "La entrega no ha finalizado. Actualiza pronto e investiga cualquier fila que siga pendiente."), color: "#1d4ed8" },
    skipped: { label: t("Not sent — configuration needed", "No enviado — requiere configuración"), explanation: t("The provider or an opted-in superadmin recipient is missing. Configure both before expecting delivery.", "Falta el proveedor o un superadministrador destinatario habilitado. Configura ambos antes de esperar la entrega."), color: "#92400e" },
    "not-requested": { label: t("Not sent — no current request", "No enviado — sin solicitud actual"), explanation: t("No delivery matrix exists for the current package snapshot.", "No existe una matriz de entrega para la captura actual del paquete."), color: "#64748b" },
    incomplete: { label: t("Not sent — inconsistent result", "No enviado — resultado inconsistente"), explanation: t("The overall result claimed success without every required acknowledgement. Treat it as incomplete and investigate.", "El resultado general indicó éxito sin todas las confirmaciones requeridas. Trátalo como incompleto e investiga."), color: "#b91c1c" },
  } as Record<string, { label: string; explanation: string; color: string }>)[overallState] || { label: t("Not sent — unknown state", "No enviado — estado desconocido"), explanation: t("Delivery state is unavailable. Refresh, then investigate the delivery worker if it remains unknown.", "El estado de entrega no está disponible. Actualiza e investiga el trabajador si continúa desconocido."), color: "#64748b" };
  const outcomeCopy = (outcome: Record<string, unknown>) => {
    const state = String(outcome.state || "missing");
    if (state === "sent") return { label: t("Sent", "Enviado"), action: t("Provider acknowledgement recorded.", "Confirmación del proveedor registrada."), color: "#166534" };
    if (state === "failed") return { label: t("Failed", "Falló"), action: t("Correct package/provider authority and use governed retry.", "Corrige la autoridad del paquete/proveedor y usa el reintento gobernado."), color: "#b91c1c" };
    if (state === "skipped") return { label: t("Not sent", "No enviado"), action: t("Configure the provider and an opted-in superadmin recipient.", "Configura el proveedor y un superadministrador destinatario habilitado."), color: "#92400e" };
    if (state === "sending") return { label: t("Pending", "Pendiente"), action: t("Refresh to confirm settlement.", "Actualiza para confirmar el resultado."), color: "#1d4ed8" };
    return { label: t("Missing", "Faltante"), action: t("No settled record exists; refresh, then investigate the worker.", "No existe un registro final; actualiza e investiga el trabajador."), color: "#b45309" };
  };
  return <div style={{ display: "grid", gap: compact ? 3 : 8 }}>
    <div><strong style={{ fontSize: compact ? 11 : 12, color: overall.color }}>{overall.label}</strong><div style={{ marginTop: 2, fontSize: 10, lineHeight: 1.4, color: "hsl(var(--muted-foreground))" }}>{overall.explanation}</div></div>
    {!compact && outcomes.length > 0 && <div role="list" aria-label={t("Telegram document delivery matrix", "Matriz de entrega de documentos por Telegram")} style={{ display: "grid", gap: 7 }}>{outcomes.map((outcome, index) => { const copy = outcomeCopy(outcome); const recipient = Number(outcome.recipientUserId); return <div role="listitem" key={`${String(outcome.recipientUserId || "none")}:${String(outcome.artifactKind || "document")}:${index}`} style={{ padding: 9, border: "1px solid hsl(var(--border))", borderRadius: 8, background: "hsl(var(--background))" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontSize: 11 }}><strong>{String(outcome.artifactKind) === "docx" ? "Word" : String(outcome.artifactKind) === "xlsx" ? "Excel" : t("Required document", "Documento requerido")} · {Number.isSafeInteger(recipient) && recipient > 0 ? `${t("reviewer", "revisor")} #${recipient}` : t("no eligible reviewer", "sin revisor elegible")}</strong><span style={{ fontWeight: 800, color: copy.color }}>{copy.label}</span></div><div style={{ marginTop: 3, fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{copy.action}</div></div>; })}</div>}
    {!compact && outcomes.length === 0 && <div role="status" style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{t("No recipient/document outcomes were recorded.", "No se registraron resultados por destinatario/documento.")}</div>}
  </div>;
}

function safeScanFailureReason(value: unknown, t: FeedbackTranslate) {
  const fallback = t("The governed scanner failed closed. Evidence remains quarantined and requires a governed retry.", "El escáner gobernado falló de forma segura. La evidencia sigue en cuarentena y requiere un reintento gobernado.");
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 320) : fallback;
}

function FeedbackTab({ token }: { token: string }) {
  const isSpanish = typeof window !== "undefined" && localStorage.getItem("bimlog-lang") === "es";
  const t = (english: string, spanish: string) => isSpanish ? spanish : english;
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [operations, setOperations] = useState<Record<string, any> | null>(null);
  const [operationsLoading, setOperationsLoading] = useState(true);
  const [operationsError, setOperationsError] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const reportDownloadRef = useRef<string | null>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const loadFeedback = useCallback((announce = false) => {
    setLoading(true);
    setError("");
    if (announce) setSuccess("");
    apiFetch("/feedback/admin", token)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Failed to load feedback");
        setItems(Array.isArray(data.feedback) ? data.feedback : []);
        if (announce) setSuccess(isSpanish ? "La cola de comentarios está actualizada." : "Feedback queue is up to date.");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load feedback");
      })
      .finally(() => setLoading(false));
  }, [isSpanish, token]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  useEffect(() => {
    setOperationsLoading(true); setOperationsError(false);
    apiFetch("/feedback/admin/operations-status", token)
      .then(async response => { if (!response.ok) throw new Error("operations unavailable"); return response.json(); })
      .then(value => setOperations(value))
      .catch(() => { setOperations(null); setOperationsError(true); })
      .finally(() => setOperationsLoading(false));
  }, [token]);

  useEffect(() => {
    if (!items.length || selectedId !== null || typeof window === "undefined") return;
    const requested = new URLSearchParams(window.location.search).get("feedback");
    const match = requested ? items.find(item => String(item.stableId) === requested) : undefined;
    if (match) void openDetail(match.id);
  }, [items, selectedId]);

  useEffect(() => {
    if (!detail || selectedId === null || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const requestedAsset = params.get("downloadAsset");
    if (!requestedAsset) { reportDownloadRef.current = null; return; }
    const assetId = Number(requestedAsset);
    if (!Number.isInteger(assetId) || assetId < 1) return;
    const key = `${selectedId}:${assetId}`;
    if (reportDownloadRef.current === key) return;
    const assets = Array.isArray(detail.assets) ? detail.assets as Record<string, unknown>[] : [];
    const asset = assets.find(candidate => Number(candidate.id) === assetId);
    reportDownloadRef.current = key;
    const clearDownloadRequest = () => { const url = new URL(window.location.href); url.searchParams.delete("downloadAsset"); window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`); };
    if (!asset || String(asset.scanState) !== "clean") { setError("The linked evidence is unavailable or is not verified safe."); clearDownloadRequest(); return; }
    void downloadEvidence(asset, "Opened from a generated BIMLog feedback report").finally(clearDownloadRequest);
  }, [detail, selectedId]);

  async function updateStatus(id: unknown, status: string) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId)) return;
    setError(""); setSuccess(""); setPendingAction(`status:${numericId}`);
    try {
      const item = items.find(candidate => Number(candidate.id) === numericId);
      const needsReason = ["blocked", "verified", "rejected", "deferred"].includes(status);
      const reason = needsReason ? window.prompt(t("Decision reason (required)", "Motivo de la decisión (obligatorio)"), String(item?.dispositionReason || "")) : "";
      if (needsReason && !reason?.trim()) return;
      const response = await apiFetch(`/feedback/admin/${numericId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status, reason, observedVersion: Number(item?.version) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to update feedback");
      setItems((current) => current.map((candidate) => Number(candidate.id) === numericId ? { ...candidate, ...data.feedback } : candidate));
      setSuccess(t(`Feedback ${String(item?.stableId || numericId)} is now ${status.replace(/_/g, " ")}.`, `El comentario ${String(item?.stableId || numericId)} ahora está ${status.replace(/_/g, " ")}.`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update feedback");
    } finally { setPendingAction(null); }
  }

  async function openDetail(id: unknown) {
    const numericId = Number(id); if (!Number.isInteger(numericId)) return;
    setSelectedId(numericId); setDetail(null); setDetailLoading(true); setError("");
    try { const response = await apiFetch(`/feedback/admin/${numericId}/detail`, token); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Failed to load feedback package"); setDetail(data); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to load feedback package"); }
    finally { setDetailLoading(false); }
  }

  function closeDetail() {
    setSelectedId(null); setDetail(null);
    if (typeof window !== "undefined") { const url = new URL(window.location.href); url.searchParams.delete("feedback"); url.searchParams.delete("asset"); url.searchParams.delete("downloadAsset"); window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`); }
  }

  async function claimFeedback(item: Record<string, unknown>) {
    const numericId = Number(item.id); if (!Number.isInteger(numericId)) return;
    setError(""); setSuccess(""); setPendingAction(`claim:${numericId}`);
    try { const response = await apiFetch(`/feedback/admin/${numericId}`, token, { method: "PATCH", body: JSON.stringify({ observedVersion: Number(item.version), claimToMe: true }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Failed to claim feedback"); setItems(current => current.map(candidate => Number(candidate.id) === numericId ? { ...candidate, ...data.feedback } : candidate)); setSuccess(t(`You now own ${String(item.stableId || numericId)}. Status and customer follow-up remain visible here.`, `Ahora eres responsable de ${String(item.stableId || numericId)}. El estado y seguimiento siguen visibles aquí.`)); await openDetail(numericId); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to claim feedback"); }
    finally { setPendingAction(null); }
  }

  async function sendCustomerUpdate(item: Record<string, unknown>) {
    const message = window.prompt(t("Customer-visible update", "Actualización visible para el cliente")); if (!message?.trim()) return;
    const responseType = String(item.status) === "fixed" || String(item.status) === "verified" ? "fix" : "response";
    const action = `message:${Number(item.id)}`; setError(""); setSuccess(""); setPendingAction(action);
    try { const response = await apiFetch(`/feedback/admin/${Number(item.id)}/events`, token, { method: "POST", headers: { "Idempotency-Key": `admin-ui:${Number(item.id)}:${Date.now()}` }, body: JSON.stringify({ responseType, visibility: "customer", message: message.trim() }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Failed to send customer update"); setSuccess(t(`Customer update sent for ${String(item.stableId || item.id)}.`, `Actualización enviada al cliente para ${String(item.stableId || item.id)}.`)); await openDetail(item.id); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to send customer update"); }
    finally { setPendingAction(null); }
  }

  async function downloadPackage(item: Record<string, unknown>) {
    const reason = window.prompt(t("Export reason (required)", "Motivo de exportación (obligatorio)"), t("Internal feedback review", "Revisión interna de comentarios")); if (!reason?.trim()) return;
    const action = `package:${Number(item.id)}`; setError(""); setSuccess(""); setPendingAction(action);
    try { const response = await fetch(`${API_BASE}/api/v1/feedback/admin/${Number(item.id)}/package.zip`, { headers: { Authorization: `Bearer ${token}`, "X-Export-Reason": reason.trim() } }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Package is not ready"); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${String(item.stableId || "feedback")}.zip`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); setSuccess(t(`Complete package downloaded for ${String(item.stableId || item.id)}.`, `Paquete completo descargado para ${String(item.stableId || item.id)}.`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to download package"); }
    finally { setPendingAction(null); }
  }

  async function downloadEvidence(asset: Record<string, unknown>, reasonOverride?: string) {
    if (!selectedId) return; const reason = reasonOverride || window.prompt(t("Export reason (required)", "Motivo de exportación (obligatorio)"), t("Review verified customer evidence", "Revisar evidencia verificada del cliente")); if (!reason?.trim()) return;
    const action = `evidence:${Number(asset.id)}`; setError(""); setSuccess(""); setPendingAction(action);
    try { const response = await fetch(`${API_BASE}/api/v1/feedback/admin/${selectedId}/assets/${Number(asset.id)}/download`, { headers: { Authorization: `Bearer ${token}`, "X-Export-Reason": reason.trim() } }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Evidence is unavailable"); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = String(asset.name || "feedback-evidence"); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); setSuccess(t(`Downloaded verified file ${String(asset.name || asset.id)} from private BIMLog custody.`, `Archivo verificado ${String(asset.name || asset.id)} descargado de la custodia privada de BIMLog.`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Evidence is unavailable"); }
    finally { setPendingAction(null); }
  }

  async function downloadPackageSnapshot(item: Record<string, unknown>, format: "pdf" | "json" | "docx" | "xlsx") {
    const reason = window.prompt(t("Export reason (required)", "Motivo de exportación (obligatorio)"), t("Internal feedback follow-up", "Seguimiento interno de comentarios")); if (!reason?.trim()) return;
    const action = `snapshot:${format}:${Number(item.id)}`; setError(""); setSuccess(""); setPendingAction(action);
    try { const response = await fetch(`${API_BASE}/api/v1/feedback/admin/${Number(item.id)}/package-snapshot.${format}`, { headers: { Authorization: `Bearer ${token}`, "X-Export-Reason": reason.trim() } }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Automatic snapshot is not ready"); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${String(item.stableId || "feedback")}-snapshot.${format}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); setSuccess(t(`${format.toUpperCase()} report downloaded for ${String(item.stableId || item.id)}.`, `Informe ${format.toUpperCase()} descargado para ${String(item.stableId || item.id)}.`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Automatic snapshot is not ready"); }
    finally { setPendingAction(null); }
  }

  async function downloadFollowUpRegister(format: "csv" | "xlsx" = "xlsx") {
    const reason = window.prompt(t("Export reason (required)", "Motivo de exportación (obligatorio)"), t("Customer feedback follow-up review", "Revisión de seguimiento de comentarios")); if (!reason?.trim()) return;
    const action = `register:${format}`; setError(""); setSuccess(""); setPendingAction(action);
    try { const response = await fetch(`${API_BASE}/api/v1/feedback/admin/follow-up.${format}`, { headers: { Authorization: `Bearer ${token}`, "X-Export-Reason": reason.trim() } }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Follow-up register is unavailable"); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `bimlog-feedback-follow-up.${format}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); setSuccess(t(`${format.toUpperCase()} follow-up register downloaded.`, `Registro de seguimiento ${format.toUpperCase()} descargado.`)); }
    catch (err) { setError(err instanceof Error ? err.message : "Follow-up register is unavailable"); }
    finally { setPendingAction(null); }
  }

  const visibleItems = statusFilter === "all" ? items : items.filter((item) => String(item.status || "open") === statusFilter);
  const openCount = items.filter((item) => String(item.status || "new") === "new").length;
  const reviewCount = items.filter((item) => ["triaged", "accepted"].includes(String(item.status || "new"))).length;
  const plannedCount = items.filter((item) => ["in_progress", "blocked", "fixed"].includes(String(item.status || "new"))).length;
  const closedCount = items.filter((item) => ["verified", "rejected", "deferred"].includes(String(item.status || "new"))).length;
  const selectedQueueItem = selectedId === null ? undefined : items.find(item => Number(item.id) === selectedId);
  const statusLabel = (value: unknown) => {
    const option = FEEDBACK_STATUS_OPTIONS.find(candidate => candidate.value === String(value));
    return option ? (isSpanish ? option.labelEs : option.label) : String(value || "new").replace(/_/g, " ");
  };
  const packageExplanation = (item: Record<string, unknown>) => {
    const state = String(item.packageState || "metadata-only");
    if (state === "ready") return t("Ready: the governed ZIP includes current reports and verified-safe evidence.", "Listo: el ZIP gobernado incluye informes actuales y evidencia verificada.");
    if (state === "quarantined") return t("Locked: evidence is quarantined until controlled scanning completes.", "Bloqueado: la evidencia está en cuarentena hasta completar el escaneo controlado.");
    return t("Metadata only: reports are available, but no verified evidence bytes are packaged.", "Solo metadatos: los informes están disponibles, pero no se empaqueta evidencia verificada.");
  };

  return (
    <div aria-busy={loading || Boolean(pendingAction)}>
      <div className="feedback-command-bar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{t("Feedback reviewer", "Revisión de comentarios")} <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", whiteSpace: "nowrap" }}>v1.60.35.10-F</span></h2>
          <p style={{ margin: "4px 0 0", color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
            {t("Claim an owner, move only to a valid next status, review safe evidence, and close the customer loop.", "Asigna un responsable, avanza solo al siguiente estado válido, revisa evidencia segura y responde al cliente.")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="outline" size="sm" disabled={Boolean(pendingAction)} title={t("Exports the governed follow-up register for all feedback", "Exporta el registro gobernado de seguimiento")} onClick={() => void downloadFollowUpRegister("xlsx")}>{pendingAction === "register:xlsx" ? t("Preparing Excel…", "Preparando Excel…") : t("Download master Excel follow-up", "Descargar seguimiento maestro en Excel")}</Button><Button variant="outline" size="sm" disabled={Boolean(pendingAction)} onClick={() => void downloadFollowUpRegister("csv")}>{pendingAction === "register:csv" ? t("Preparing CSV…", "Preparando CSV…") : t("Download CSV", "Descargar CSV")}</Button><Button variant="outline" size="sm" disabled={loading} onClick={() => loadFeedback(true)}>{loading ? t("Refreshing…", "Actualizando…") : t("Refresh", "Actualizar")}</Button></div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <StatCard label={t("New", "Nuevos")} value={openCount} />
        <StatCard label={t("Triaged / accepted", "Clasificados / aceptados")} value={reviewCount} />
        <StatCard label={t("Active work", "Trabajo activo")} value={plannedCount} />
        <StatCard label={t("Closed", "Cerrados")} value={closedCount} />
      </div>

      {operationsLoading && <div role="status" style={{ marginBottom: 12, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{t("Checking evidence custody, scanner, alerts, and receiver…", "Comprobando custodia, escáner, alertas y receptor…")}</div>}
      {operationsError && <div role="alert" style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 12 }}>{t("Operational health is unavailable. The review queue still works, but verify custody and delivery before exporting.", "La salud operativa no está disponible. La cola funciona, pero verifica custodia y entrega antes de exportar.")}</div>}
      {operations && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10, marginBottom: 16 }}>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 9, padding: 11, background: "hsl(var(--card))" }}><strong style={{ fontSize: 12 }}>{t("Evidence custody", "Custodia de evidencia")}</strong><div style={{ fontSize: 11, marginTop: 4 }}>{String(operations.storage?.location || operations.storage?.backend || t("unknown", "desconocida"))} · {operations.storage?.healthy ? t("healthy", "disponible") : t("unavailable", "no disponible")}</div><div style={{ fontSize: 10, marginTop: 4, color: "hsl(var(--muted-foreground))" }}>Metadata: PostgreSQL · Access: private through BIMLog</div></div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 9, padding: 11, background: "hsl(var(--card))" }}><strong style={{ fontSize: 12 }}>{t("Controlled scanner", "Escáner controlado")}</strong><div style={{ fontSize: 11, marginTop: 4 }}>{operations.scanner?.configured ? t("Active; quarantined files will be processed", "Activo; procesará archivos en cuarentena") : t("Not active; files remain safely quarantined and cannot be opened", "Inactivo; los archivos permanecen en cuarentena y no pueden abrirse")}</div></div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 9, padding: 11, background: "hsl(var(--card))" }}><strong style={{ fontSize: 12 }}>{t("Internal document alert", "Alerta interna de documentos")}</strong><div style={{ fontSize: 11, marginTop: 4 }}>{operations.telegramDocuments?.configured ? t("Active for linked super-admin chats", "Activa para chats de superadministradores vinculados") : t("Not configured; intake remains available in this queue", "No configurada; la entrada permanece visible en esta cola")}</div></div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 9, padding: 11, background: "hsl(var(--card))" }}><strong style={{ fontSize: 12 }}>{t("Permanent computer receiver", "Receptor permanente")}</strong><div style={{ fontSize: 11, marginTop: 4 }}>{operations.permanentComputerReceiver?.connected ? t("Connected", "Conectado") : `${t("Not connected", "No conectado")} · target ${String(operations.permanentComputerReceiver?.root || "F:\\BIMLog\\Feedback")}`}</div></div>
      </div>}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>
          {t("Status", "Estado")}
          <select
            aria-label={t("Filter feedback by status", "Filtrar comentarios por estado")}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{ marginLeft: 8, border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "7px 10px", background: "hsl(var(--background))" }}
          >
            <option value="all">{t("All statuses", "Todos los estados")}</option>
            {FEEDBACK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{isSpanish ? option.labelEs : option.label}</option>)}
          </select>
        </label>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {error && <div role="alert" style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 12 }}>{error}</div>}
        {success && <div role="status" style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #86efac", color: "#166534", fontSize: 12 }}>{success}</div>}
      </div>
      {loading ? (
        <div style={{ padding: 32, color: "hsl(var(--muted-foreground))", textAlign: "center" }}>Loading feedback...</div>
      ) : visibleItems.length === 0 ? (
        <div style={{ padding: 32, color: "hsl(var(--muted-foreground))", textAlign: "center", border: "1px solid hsl(var(--border))", borderRadius: 10 }}>
          {t("No feedback matches this view.", "Ningún comentario coincide con esta vista.")}
        </div>
      ) : (
        <><div className="feedback-review-table" style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden" }}>
          <div
            ref={topScrollRef}
            aria-label="Feedback table horizontal scroll"
            onScroll={(event) => { if (tableScrollRef.current) tableScrollRef.current.scrollLeft = event.currentTarget.scrollLeft; }}
            style={{ overflowX: "auto", overflowY: "hidden", height: 16, borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--muted) / 0.4)" }}
          ><div style={{ width: 1830, height: 1 }} /></div>
          <div
            ref={tableScrollRef}
            onScroll={(event) => { if (topScrollRef.current) topScrollRef.current.scrollLeft = event.currentTarget.scrollLeft; }}
            style={{ overflow: "auto", maxHeight: "min(68vh, 760px)" }}
          >
          <table style={{ width: 1830, minWidth: "100%", borderCollapse: "separate", borderSpacing: 0, background: "hsl(var(--card))" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 8, background: "hsl(var(--card))", boxShadow: "0 1px 0 hsl(var(--border))" }}>
              <tr>
                <Th>{t("Created", "Creado")}</Th>
                <Th>{t("User", "Usuario")}</Th>
                <Th>{t("Project", "Proyecto")}</Th>
                <Th>{t("Type", "Tipo")}</Th>
                <Th>{t("Priority", "Prioridad")}</Th>
                <Th>{t("Module", "Módulo")}</Th>
                <Th>{t("Message", "Mensaje")}</Th>
                <Th>{t("Evidence package", "Paquete de evidencia")}</Th>
                <Th>{t("Status / owner", "Estado / responsable")}</Th>
                <Th>{t("Follow-up", "Seguimiento")}</Th>
                <Th>{t("Page", "Página")}</Th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={String(item.id)}>
                  <Td style={{ fontSize: 11, whiteSpace: "nowrap", position: "sticky", left: 0, zIndex: 4, background: "hsl(var(--card))" }}><strong>{String(item.stableId || "-")}</strong><br/>{item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : "-"}</Td>
                  <Td>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{String(item.userFullName || "Unnamed")}</div>
                    <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{String(item.userEmail || "")}</div>
                  </Td>
                  <Td>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{String(item.projectName || "-")}</div>
                    <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{String(item.projectCode || "")}</div>
                  </Td>
                  <Td><Badge label={String(item.feedbackType || "-")} color="#3b82f6" /></Td>
                  <Td><Badge label={String(item.priority || "normal")} color={String(item.priority) === "urgent" ? "#ef4444" : "#f59e0b"} /></Td>
                  <Td style={{ fontSize: 12 }}>{String(item.module || "-")}</Td>
                  <Td style={{ minWidth: 280, maxWidth: 460, whiteSpace: "normal", overflowWrap: "anywhere" }}>{String(item.message || "")}</Td>
                  <Td style={{ minWidth: 170 }}>
                    {(() => { const evidence = (item.evidence || {}) as Record<string, unknown>; const total = Number(evidence.total || 0), quarantined = Number(evidence.quarantined || 0), clean = Number(evidence.clean || 0), rejected = Number(evidence.rejected || 0); return <><div style={{ fontSize: 12, fontWeight: 800 }}>{total} {t(total === 1 ? "file" : "files", total === 1 ? "archivo" : "archivos")}</div><div style={{ fontSize: 11, color: quarantined ? "#b45309" : rejected ? "#b91c1c" : "#15803d" }}>{clean} {t("clean", "seguros")} · {quarantined} {t("awaiting scan", "esperando escaneo")} · {rejected} {t("rejected", "rechazados")}</div><div style={{ fontSize: 11 }}>{t("Package", "Paquete")}: {String(item.packageState || "metadata-only").replace(/-/g, " ")}</div><div style={{ marginTop: 4, fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{packageExplanation(item)}</div><div style={{ marginTop: 7, paddingTop: 7, borderTop: "1px solid hsl(var(--border))" }}><div style={{ marginBottom: 3, fontSize: 10, fontWeight: 800 }}>{t("Internal document delivery", "Entrega interna de documentos")}</div><TelegramDeliveryStatus value={item.telegramDelivery} t={t} compact /></div><div style={{ marginTop: 5, fontSize: 10 }}>{t("Reviewer intake alert", "Alerta de entrada al revisor")}: {String(item.reviewerAlertState || "pending").replace(/_/g, " ")}</div></>; })()}
                  </Td>
                  <Td style={{ minWidth: 170, position: "sticky", right: 170, zIndex: 4, background: "hsl(var(--card))", boxShadow: "-1px 0 0 hsl(var(--border))" }}>
                    <select
                      aria-label={`${t("Next status for", "Siguiente estado para")} ${String(item.stableId || item.id)}`}
                      value={String(item.status || "new")}
                      onChange={(event) => updateStatus(item.id, event.target.value)}
                      disabled={pendingAction === `status:${Number(item.id)}`}
                      style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "6px 8px", fontSize: 12, background: "hsl(var(--background))" }}
                    >
                      {FEEDBACK_STATUS_OPTIONS.filter((option) => option.value === String(item.status || "new") || (FEEDBACK_STATUS_TRANSITIONS[String(item.status || "new")] || []).includes(option.value)).map((option) => <option key={option.value} value={option.value}>{isSpanish ? option.labelEs : option.label}</option>)}
                    </select>
                    <div style={{ marginTop: 6, fontSize: 11 }}>{pendingAction === `status:${Number(item.id)}` ? t("Saving…", "Guardando…") : item.ownerUserId ? `${t("Owned by reviewer", "Responsable") } #${String(item.ownerUserId)}` : t("Unassigned — claim before acting", "Sin asignar — asume responsabilidad antes de actuar")}</div>
                  </Td>
                  <Td style={{ minWidth: 170, position: "sticky", right: 0, zIndex: 4, background: "hsl(var(--card))" }}><div style={{ display: "grid", gap: 6 }}><Button variant="outline" size="sm" onClick={() => void openDetail(item.id)}>{t("Review details", "Revisar detalles")}</Button>{!item.ownerUserId && <Button variant="outline" size="sm" title={t("Assigns you as accountable reviewer; it does not change status", "Te asigna como responsable; no cambia el estado")} disabled={Boolean(pendingAction)} onClick={() => void claimFeedback(item)}>{pendingAction === `claim:${Number(item.id)}` ? t("Claiming…", "Asignando…") : t("Assign to me", "Asignarme")}</Button>}<Button variant="outline" size="sm" disabled={item.packageState !== "ready" || Boolean(pendingAction)} title={packageExplanation(item)} onClick={() => void downloadPackage(item)}>{pendingAction === `package:${Number(item.id)}` ? t("Preparing ZIP…", "Preparando ZIP…") : t("Download complete ZIP", "Descargar ZIP completo")}</Button><Button variant="outline" size="sm" disabled={Boolean(pendingAction)} title={t("Generated now from current authority", "Generado ahora desde la autoridad actual")} onClick={() => void downloadPackageSnapshot(item,"pdf")}>{pendingAction === `snapshot:pdf:${Number(item.id)}` ? t("Preparing PDF…", "Preparando PDF…") : t("Current PDF report", "Informe PDF actual")}</Button><Button variant="outline" size="sm" disabled={Boolean(pendingAction)} onClick={() => void downloadPackageSnapshot(item,"docx")}>{pendingAction === `snapshot:docx:${Number(item.id)}` ? t("Preparing Word…", "Preparando Word…") : t("Current Word report", "Informe Word actual")}</Button><Button variant="outline" size="sm" disabled={Boolean(pendingAction)} onClick={() => void downloadPackageSnapshot(item,"xlsx")}>{pendingAction === `snapshot:xlsx:${Number(item.id)}` ? t("Preparing Excel…", "Preparando Excel…") : t("Current item Excel", "Excel actual del elemento")}</Button><Button variant="outline" size="sm" disabled={Boolean(pendingAction)} onClick={() => void downloadPackageSnapshot(item,"json")}>{pendingAction === `snapshot:json:${Number(item.id)}` ? t("Preparing JSON…", "Preparando JSON…") : t("Current JSON record", "Registro JSON actual")}</Button><Button variant="outline" size="sm" title={t("Adds a customer-visible timeline response; internal notes remain private", "Agrega una respuesta visible para el cliente; las notas internas siguen privadas")} disabled={Boolean(pendingAction)} onClick={() => void sendCustomerUpdate(item)}>{pendingAction === `message:${Number(item.id)}` ? t("Sending…", "Enviando…") : t("Message customer", "Responder al cliente")}</Button></div></Td>
                  <Td style={{ width: 130 }}>
                    <a href={String(item.pageUrl || "#")} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontSize: 11 }}>
                      {t("Open reported page ↗", "Abrir página reportada ↗")}
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
        <div className="feedback-review-cards" aria-label={t("Feedback review cards", "Tarjetas de revisión de comentarios")}>
          {visibleItems.map(item => {
            const evidence = (item.evidence || {}) as Record<string, unknown>;
            const total = Number(evidence.total || 0), quarantined = Number(evidence.quarantined || 0), clean = Number(evidence.clean || 0), rejected = Number(evidence.rejected || 0);
            return <article key={String(item.id)} style={{ padding: 14, border: "1px solid hsl(var(--border))", borderRadius: 12, background: "hsl(var(--card))" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}><div><strong>{String(item.stableId || "-")}</strong><div style={{ marginTop: 3, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : "-"}</div></div><Badge label={statusLabel(item.status)} color="#3b82f6" /></div>
              <p style={{ fontSize: 13, lineHeight: 1.5, overflowWrap: "anywhere" }}>{String(item.message || "")}</p>
              <div style={{ display: "grid", gap: 5, padding: 10, borderRadius: 8, background: "hsl(var(--muted) / .5)", fontSize: 11 }}><strong>{total} {t(total === 1 ? "file" : "files", total === 1 ? "archivo" : "archivos")}: {clean} {t("clean", "seguros")} · {quarantined} {t("awaiting scan", "esperando escaneo")} · {rejected} {t("rejected", "rechazados")}</strong><span>{packageExplanation(item)}</span><span>{item.ownerUserId ? `${t("Owned by reviewer", "Responsable")} #${String(item.ownerUserId)}` : t("Unassigned — claim before acting", "Sin asignar — asume responsabilidad antes de actuar")}</span><div style={{ marginTop: 4, paddingTop: 7, borderTop: "1px solid hsl(var(--border))" }}><TelegramDeliveryStatus value={item.telegramDelivery} t={t} compact /></div></div>
              <label style={{ display: "grid", gap: 4, marginTop: 10, fontSize: 11, fontWeight: 700 }}>{t("Status — only valid next steps are shown", "Estado — solo se muestran pasos siguientes válidos")}<select aria-label={`${t("Next status for", "Siguiente estado para")} ${String(item.stableId || item.id)}`} value={String(item.status || "new")} disabled={pendingAction === `status:${Number(item.id)}`} onChange={event => updateStatus(item.id, event.target.value)} style={{ width: "100%", padding: "8px 9px", border: "1px solid hsl(var(--border))", borderRadius: 7, background: "hsl(var(--background))" }}>{FEEDBACK_STATUS_OPTIONS.filter(option => option.value === String(item.status || "new") || (FEEDBACK_STATUS_TRANSITIONS[String(item.status || "new")] || []).includes(option.value)).map(option => <option key={option.value} value={option.value}>{isSpanish ? option.labelEs : option.label}</option>)}</select></label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7, marginTop: 10 }}><Button variant="outline" size="sm" onClick={() => void openDetail(item.id)}>{t("Review details", "Ver detalles")}</Button>{!item.ownerUserId && <Button variant="outline" size="sm" disabled={Boolean(pendingAction)} onClick={() => void claimFeedback(item)}>{pendingAction === `claim:${Number(item.id)}` ? t("Claiming…", "Asignando…") : t("Assign to me", "Asignarme")}</Button>}<Button variant="outline" size="sm" disabled={item.packageState !== "ready" || Boolean(pendingAction)} title={packageExplanation(item)} onClick={() => void downloadPackage(item)}>{t("Complete ZIP", "ZIP completo")}</Button><Button variant="outline" size="sm" disabled={Boolean(pendingAction)} onClick={() => void sendCustomerUpdate(item)}>{pendingAction === `message:${Number(item.id)}` ? t("Sending…", "Enviando…") : t("Message customer", "Responder al cliente")}</Button></div>
            </article>;
          })}
        </div></>
      )}
      {selectedId !== null && <><button type="button" aria-label="Close feedback details" onClick={closeDetail} style={{ position: "fixed", inset: 0, zIndex: 1499, border: 0, background: "rgba(15,23,42,.42)" }} /><section role="dialog" aria-modal="true" aria-label="Feedback details" style={{ position: "fixed", top: 16, right: 16, bottom: 16, zIndex: 1500, width: "min(720px, calc(100vw - 32px))", overflowY: "auto", padding: 22, border: "1px solid hsl(var(--border))", borderRadius: 14, background: "hsl(var(--card))", boxShadow: "0 28px 80px rgba(15,23,42,.38)" }}>
        <div style={{ position: "sticky", top: -22, zIndex: 2, margin: "-22px -22px 16px", padding: "18px 22px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, background: "hsl(var(--card))", borderBottom: "1px solid hsl(var(--border))" }}><div><h3 style={{ margin: 0 }}>{t("Feedback details", "Detalles del comentario")}</h3><div style={{ fontSize: 12, marginTop: 4, color: "hsl(var(--muted-foreground))" }}>{t("What was submitted, what is safe to open, and what your team has done", "Qué se envió, qué es seguro abrir y qué hizo tu equipo")}</div></div><Button variant="outline" size="sm" onClick={closeDetail}>{t("Close", "Cerrar")}</Button></div>
        {detailLoading ? <p role="status">{t("Loading complete package…", "Cargando paquete completo…")}</p> : detail ? <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10, marginBottom: 20 }}><div style={{ padding: 12, borderRadius: 10, background: "hsl(var(--muted) / .55)" }}><div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>Feedback ID</div><strong>{String(((detail.feedback || {}) as Record<string, unknown>).stableId || selectedId)}</strong></div><div style={{ padding: 12, borderRadius: 10, background: "hsl(var(--muted) / .55)" }}><div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>Evidence package</div><strong>{String(detail.packageState || "unknown").replace(/-/g, " ")}</strong></div><div style={{ padding: 12, borderRadius: 10, background: "hsl(var(--muted) / .55)" }}><div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>Current report</div><strong>Generated when downloaded</strong></div></div>
          <h4 style={{ marginBottom: 8 }}>{t("Internal Word / Excel delivery", "Entrega interna de Word / Excel")}</h4>
          <div style={{ marginBottom: 18, padding: 12, border: "1px solid hsl(var(--border))", borderRadius: 10 }}><TelegramDeliveryStatus value={selectedQueueItem?.telegramDelivery} t={t} /></div>
          <h4 style={{ marginBottom: 8 }}>{t("Evidence", "Evidencia")}</h4>
          {Array.isArray(detail.assets) && detail.assets.length ? <div style={{ display: "grid", gap: 10 }}>{(detail.assets as Record<string, unknown>[]).map(asset => <div key={String(asset.id)} style={{ padding: 12, border: "1px solid hsl(var(--border))", borderRadius: 10 }}><div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><strong style={{ overflowWrap: "anywhere" }}>{String(asset.name)}</strong><span style={{ fontSize: 11, fontWeight: 700, color: String(asset.scanState) === "clean" ? "#166534" : "#92400e" }}>{String(asset.scanState) === "clean" ? t("Verified safe", "Seguro y verificado") : String(asset.scanState) === "rejected" ? t("Rejected", "Rechazado") : t("Awaiting controlled scan", "Esperando escaneo controlado")}</span></div><div style={{ marginTop: 4, fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{String(asset.kind)} · {String(asset.mediaType)} · {Number(asset.byteSize || 0).toLocaleString()} bytes</div><div style={{ marginTop: 6, fontSize: 11 }}>{String(asset.scanState) === "clean" ? t("Included in the current PDF, Word, Excel preview sheet, ZIP, and secure download.", "Incluido en los informes actuales, el ZIP y la descarga segura.") : t("The record is visible, but its bytes remain locked until controlled scanning completes.", "El registro es visible, pero sus bytes permanecen bloqueados hasta completar el escaneo controlado.")}</div>{String(asset.scanState) === "clean" && <div style={{ marginTop: 8 }}><Button variant="outline" size="sm" disabled={Boolean(pendingAction)} onClick={() => void downloadEvidence(asset)}>{pendingAction === `evidence:${Number(asset.id)}` ? t("Downloading…", "Descargando…") : t("Download verified file", "Descargar archivo verificado")}</Button></div>}</div>)}</div> : <p>{t("No files attached.", "No hay archivos adjuntos.")}</p>}
          {Array.isArray(detail.scanFailures) && detail.scanFailures.length > 0 && <section aria-labelledby="feedback-scan-failures-title" style={{ marginTop: 18 }}><h4 id="feedback-scan-failures-title" style={{ marginBottom: 4, color: "#b91c1c" }}>{t("Evidence scans requiring action", "Escaneos de evidencia que requieren acción")}</h4><p style={{ margin: "0 0 9px", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{t("These files remain quarantined. Only the bounded reviewer-safe failure reason is shown.", "Estos archivos siguen en cuarentena. Solo se muestra el motivo seguro y limitado para revisores.")}</p><div role="list" style={{ display: "grid", gap: 8 }}>{(detail.scanFailures as Record<string, unknown>[]).map(failure => { const assetId = Number(failure.assetId); const asset = Array.isArray(detail.assets) ? (detail.assets as Record<string, unknown>[]).find(candidate => Number(candidate.id) === assetId) : undefined; const when = new Date(String(failure.createdAt || "")); return <div role="listitem" key={String(failure.eventId || `${assetId}:${failure.createdAt}`)} style={{ padding: 11, border: "1px solid #fecaca", borderRadius: 9, background: "#fef2f2" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 12, overflowWrap: "anywhere" }}>{asset ? String(asset.name) : `${t("Evidence asset", "Activo de evidencia")} #${Number.isSafeInteger(assetId) ? assetId : "?"}`}</strong><span style={{ fontSize: 11, fontWeight: 800, color: "#b91c1c" }}>{failure.retryable === true ? t("Retry required", "Reintento requerido") : t("Manual review required", "Revisión manual requerida")}</span></div><div style={{ marginTop: 3, fontSize: 10, color: "#7f1d1d" }}>{t("Asset", "Activo")} #{Number.isSafeInteger(assetId) ? assetId : "?"} · {Number.isNaN(when.getTime()) ? t("time unavailable", "hora no disponible") : when.toLocaleString()}</div><p style={{ margin: "7px 0 0", fontSize: 11, lineHeight: 1.45 }}>{safeScanFailureReason(failure.reason, t)}</p><div style={{ marginTop: 5, fontSize: 10, fontWeight: 700 }}>{t("Keep quarantined; correct scanner or source authority, then rerun the governed scan worker.", "Mantén en cuarentena; corrige la autoridad del escáner o fuente y vuelve a ejecutar el trabajador gobernado.")}</div></div>; })}</div></section>}
          <h4>{t("Activity", "Actividad")}</h4>
          {Array.isArray(detail.history) && detail.history.length ? <ol style={{ display: "grid", gap: 8, paddingLeft: 22 }}>{(detail.history as Record<string, unknown>[]).map(event => <li key={String(event.id)}><strong>{feedbackActivityLabel(event.eventType)}</strong><div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{event.createdAt ? new Date(String(event.createdAt)).toLocaleString() : ""}{event.reason ? ` · ${String(event.reason)}` : ""}{String(event.eventType) === "feedback_telegram_delivery" ? ` · ${String(((event.afterState || {}) as Record<string,unknown>).artifactKind || "document")}: ${String(((event.afterState || {}) as Record<string,unknown>).state || "unknown")}` : ""}</div></li>)}</ol> : <p>No activity recorded.</p>}
        </> : <p role="alert">Package details could not be loaded.</p>}
      </section></>}
    </div>
  );
}

export function AdminPanel() {
  const [, setLocation] = useLocation();
  const { token, user } = useAuthStore();
  const isSuperAdmin = Boolean((user as { isSuperAdmin?: boolean } | null)?.isSuperAdmin);
  const [activeTab, setActiveTab] = useState(0);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    apiFetch("/admin/overview?scope=mine", token)
      .then(r => { if (r.status === 403 || r.status === 401) setLocation("/dashboard"); })
      .catch(() => setLocation("/dashboard"))
      .finally(() => setChecking(false));
  }, [token, setLocation]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const requested = new URLSearchParams(window.location.search).get("tab") === "feedback" || window.location.pathname.endsWith("/admin/feedback");
    if (requested && isSuperAdmin) setActiveTab(9);
    else if (requested && !isSuperAdmin) setActiveTab(0);
  }, [isSuperAdmin]);

  if (checking || !token) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "hsl(var(--muted-foreground))" }}>Checking access...</div>;
  const isSpanish = typeof window !== "undefined" && localStorage.getItem("bimlog-lang") === "es";
  const copy = isSpanish
    ? {
      kicker: "Sede BIMLog",
      title: "Administración de Proyectos",
      subtitle: "Espacio de administración de proyectos para compañías, usuarios, proyectos, eventos de correo, banderas, auditoría, uso de IA y comentarios vinculados a los proyectos que administras.",
      scopeTitle: "Alcance: mis proyectos administrados",
      scopeBody: "Todas las solicitudes conservan scope=mine; esta página no es una consola de toda la plataforma.",
      authorityTitle: "Autoridad: administración de proyecto gobernada",
      authorityBody: "Las acciones de usuarios, compañías, proyectos y banderas conservan sus permisos de ruta y confirmaciones existentes.",
      auditTitle: "Auditoría: detalle legible",
      auditBody: "La actividad y los registros administrativos muestran resúmenes legibles en lugar de bloques JSON sin procesar.",
      back: "Volver a la Sede",
      tabs: {
        Overview: "Resumen",
        Users: "Usuarios",
        Companies: "Compañías",
        Projects: "Proyectos",
        "Email Log": "Correos",
        "Activity Feed": "Actividad",
        "Feature Flags": "Banderas",
        "Admin Log": "Registro Admin",
        "AI Usage": "Uso de IA",
        Feedback: "Comentarios",
      } as Record<string, string>,
    }
    : {
      kicker: "BIMLog Headquarters",
      title: "Project Administration",
      subtitle: "Project-admin workspace for the companies, users, projects, email events, feature flags, audit activity, AI usage and feedback tied to projects you administer.",
      scopeTitle: "Scope: my administered projects",
      scopeBody: "All requests retain scope=mine; this page is not a platform-wide console.",
      authorityTitle: "Authority: governed project admin",
      authorityBody: "User, company, project and flag actions keep their existing route guards and confirmation behavior.",
      auditTitle: "Audit detail: readable",
      auditBody: "Activity and admin logs present summarized details instead of raw JSON blocks.",
      back: "Back to Headquarters",
      tabs: {} as Record<string, string>,
    };

  return (
    <div className="hq-admin-page" data-testid="project-administration-page">
      <style>{ADMIN_PANEL_SHELL_CSS}</style>
      <div className="hq-admin-shell">
        <section className="hq-admin-hero" aria-labelledby="project-administration-title">
          <div>
            <p className="hq-admin-kicker">{copy.kicker}</p>
            <h1 id="project-administration-title" className="hq-admin-title">{copy.title}</h1>
            <p className="hq-admin-subtitle">
              {copy.subtitle}
            </p>
            <div className="hq-admin-scope-grid" aria-label="Project Administration scope and controls">
              <div className="hq-admin-scope-card">
                <strong>{copy.scopeTitle}</strong>
                <span>{copy.scopeBody}</span>
              </div>
              <div className="hq-admin-scope-card">
                <strong>{copy.authorityTitle}</strong>
                <span>{copy.authorityBody}</span>
              </div>
              <div className="hq-admin-scope-card">
                <strong>{copy.auditTitle}</strong>
                <span>{copy.auditBody}</span>
              </div>
            </div>
          </div>
          <div className="hq-admin-toolbar">
            <Button variant="outline" size="sm" style={{ fontSize: 12 }} onClick={() => setLocation("/dashboard")}>{copy.back}</Button>
          </div>
        </section>

        <nav className="hq-admin-tabs" aria-label="Project Administration sections">
          {TABS.map((tab, i) => ({ tab, i })).filter(({ tab }) => tab !== "Feedback" || isSuperAdmin).map(({ tab, i }) => (
            <button key={tab} className="hq-admin-tab" data-active={activeTab === i} onClick={() => { setActiveTab(i); if (typeof window !== "undefined") { const url = new URL(window.location.href); if (i === 9) url.searchParams.set("tab", "feedback"); else url.searchParams.delete("tab"); window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`); } }}>
              {copy.tabs[tab] || tab}
            </button>
          ))}
        </nav>

        <main className="hq-admin-content">
          {activeTab === 0 && <OverviewTab token={token} />}
          {activeTab === 1 && <UsersTab token={token} />}
          {activeTab === 2 && <CompaniesTab token={token} />}
          {activeTab === 3 && <ProjectsTab token={token} />}
          {activeTab === 4 && <EmailLogTab token={token} />}
          {activeTab === 5 && <ActivityFeedTab token={token} />}
          {activeTab === 6 && <FeatureFlagsTab token={token} />}
          {activeTab === 7 && <AdminActionsLogTab token={token} />}
          {activeTab === 8 && <AiUsageTab token={token} />}
          {activeTab === 9 && isSuperAdmin && <FeedbackTab token={token} />}
        </main>
      </div>
    </div>
  );
}
