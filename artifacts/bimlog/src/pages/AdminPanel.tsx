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
  @media (max-width: 720px) {
    .hq-admin-shell { width: min(100% - 24px, 390px); padding: 14px 0 24px; }
    .hq-admin-hero { grid-template-columns: 1fr; padding: 18px; border-radius: 18px; }
    .hq-admin-toolbar { justify-content: stretch; }
    .hq-admin-toolbar button { width: 100%; }
    .hq-admin-scope-grid { grid-template-columns: 1fr; }
    .hq-admin-tabs { margin: 14px 0; border-radius: 16px; }
    .hq-admin-tab { padding: 9px 12px; font-size: 12px; }
    .hq-admin-content { padding: 14px; border-radius: 18px; }
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
  { value: "new", label: "New" },
  { value: "triaged", label: "Triaged" },
  { value: "accepted", label: "Accepted" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "fixed", label: "Fixed" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "deferred", label: "Deferred" },
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

function FeedbackTab({ token }: { token: string }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [operations, setOperations] = useState<Record<string, any> | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const loadFeedback = useCallback(() => {
    setLoading(true);
    setError("");
    apiFetch("/feedback/admin", token)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Failed to load feedback");
        setItems(Array.isArray(data.feedback) ? data.feedback : []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load feedback");
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  useEffect(() => { apiFetch("/feedback/admin/operations-status", token).then(response => response.ok ? response.json() : null).then(value => setOperations(value)).catch(() => setOperations(null)); }, [token]);

  useEffect(() => {
    if (!items.length || selectedId !== null || typeof window === "undefined") return;
    const requested = new URLSearchParams(window.location.search).get("feedback");
    const match = requested ? items.find(item => String(item.stableId) === requested) : undefined;
    if (match) void openDetail(match.id);
  }, [items, selectedId]);

  async function updateStatus(id: unknown, status: string) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId)) return;
    setError(""); setSuccess(""); setPendingAction(`status:${numericId}`);
    try {
      const item = items.find(candidate => Number(candidate.id) === numericId);
      const needsReason = ["blocked", "verified", "rejected", "deferred"].includes(status);
      const reason = needsReason ? window.prompt("Decision reason (required)", String(item?.dispositionReason || "")) : "";
      if (needsReason && !reason?.trim()) return;
      const response = await apiFetch(`/feedback/admin/${numericId}`, token, {
        method: "PATCH",
        body: JSON.stringify({ status, reason, observedVersion: Number(item?.version) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Failed to update feedback");
      setItems((current) => current.map((candidate) => Number(candidate.id) === numericId ? { ...candidate, ...data.feedback } : candidate));
      setSuccess(`Feedback ${String(item?.stableId || numericId)} is now ${status.replace(/_/g, " ")}.`);
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

  async function claimFeedback(item: Record<string, unknown>) {
    const numericId = Number(item.id); if (!Number.isInteger(numericId)) return;
    setError(""); setSuccess(""); setPendingAction(`claim:${numericId}`);
    try { const response = await apiFetch(`/feedback/admin/${numericId}`, token, { method: "PATCH", body: JSON.stringify({ observedVersion: Number(item.version), claimToMe: true }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Failed to claim feedback"); setItems(current => current.map(candidate => Number(candidate.id) === numericId ? { ...candidate, ...data.feedback } : candidate)); setSuccess(`You now own ${String(item.stableId || numericId)}. Status and customer follow-up remain visible here.`); await openDetail(numericId); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to claim feedback"); }
    finally { setPendingAction(null); }
  }

  async function sendCustomerUpdate(item: Record<string, unknown>) {
    const message = window.prompt("Customer-visible update"); if (!message?.trim()) return;
    const responseType = String(item.status) === "fixed" || String(item.status) === "verified" ? "fix" : "response";
    try { const response = await apiFetch(`/feedback/admin/${Number(item.id)}/events`, token, { method: "POST", headers: { "Idempotency-Key": `admin-ui:${Number(item.id)}:${Date.now()}` }, body: JSON.stringify({ responseType, visibility: "customer", message: message.trim() }) }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "Failed to send customer update"); await openDetail(item.id); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to send customer update"); }
  }

  async function downloadPackage(item: Record<string, unknown>) {
    const reason = window.prompt("Export reason (required)", "Internal feedback review"); if (!reason?.trim()) return;
    try { const response = await fetch(`${API_BASE}/api/v1/feedback/admin/${Number(item.id)}/package.zip`, { headers: { Authorization: `Bearer ${token}`, "X-Export-Reason": reason.trim() } }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Package is not ready"); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${String(item.stableId || "feedback")}.zip`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to download package"); }
  }

  async function downloadEvidence(asset: Record<string, unknown>) {
    if (!selectedId) return; const reason = window.prompt("Export reason (required)", "Review verified customer evidence"); if (!reason?.trim()) return;
    try { const response = await fetch(`${API_BASE}/api/v1/feedback/admin/${selectedId}/assets/${Number(asset.id)}/download`, { headers: { Authorization: `Bearer ${token}`, "X-Export-Reason": reason.trim() } }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Evidence is unavailable"); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = String(asset.name || "feedback-evidence"); anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
    catch (err) { setError(err instanceof Error ? err.message : "Evidence is unavailable"); }
  }

  async function downloadPackageSnapshot(item: Record<string, unknown>, format: "pdf" | "json" | "docx" | "xlsx") {
    const reason = window.prompt("Export reason (required)", "Internal feedback follow-up"); if (!reason?.trim()) return;
    try { const response = await fetch(`${API_BASE}/api/v1/feedback/admin/${Number(item.id)}/package-snapshot.${format}`, { headers: { Authorization: `Bearer ${token}`, "X-Export-Reason": reason.trim() } }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Automatic snapshot is not ready"); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${String(item.stableId || "feedback")}-snapshot.${format}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
    catch (err) { setError(err instanceof Error ? err.message : "Automatic snapshot is not ready"); }
  }

  async function downloadFollowUpRegister(format: "csv" | "xlsx" = "xlsx") {
    const reason = window.prompt("Export reason (required)", "Customer feedback follow-up review"); if (!reason?.trim()) return;
    try { const response = await fetch(`${API_BASE}/api/v1/feedback/admin/follow-up.${format}`, { headers: { Authorization: `Bearer ${token}`, "X-Export-Reason": reason.trim() } }); if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Follow-up register is unavailable"); } const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `bimlog-feedback-follow-up.${format}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0); }
    catch (err) { setError(err instanceof Error ? err.message : "Follow-up register is unavailable"); }
  }

  const visibleItems = statusFilter === "all" ? items : items.filter((item) => String(item.status || "open") === statusFilter);
  const openCount = items.filter((item) => String(item.status || "new") === "new").length;
  const reviewCount = items.filter((item) => ["triaged", "accepted"].includes(String(item.status || "new"))).length;
  const plannedCount = items.filter((item) => ["in_progress", "blocked", "fixed"].includes(String(item.status || "new"))).length;
  const closedCount = items.filter((item) => ["verified", "rejected", "deferred"].includes(String(item.status || "new"))).length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Feedback</h2>
          <p style={{ margin: "4px 0 0", color: "hsl(var(--muted-foreground))", fontSize: 12 }}>
            BIMLog user feedback, bug reports, workflow requests, and improvement ideas.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Button variant="outline" size="sm" onClick={() => void downloadFollowUpRegister("xlsx")}>Download master Excel follow-up</Button><Button variant="outline" size="sm" onClick={() => void downloadFollowUpRegister("csv")}>Download CSV</Button><Button variant="outline" size="sm" onClick={loadFeedback}>Refresh</Button></div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <StatCard label="New" value={openCount} />
        <StatCard label="Triaged / accepted" value={reviewCount} />
        <StatCard label="Active work" value={plannedCount} />
        <StatCard label="Closed" value={closedCount} />
      </div>

      {operations && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10, marginBottom: 16 }}>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 9, padding: 11, background: "hsl(var(--card))" }}><strong style={{ fontSize: 12 }}>Temporary evidence custody</strong><div style={{ fontSize: 11, marginTop: 4 }}>{String(operations.storage?.backend || "unknown")} · {operations.storage?.healthy ? "healthy" : "unavailable"}</div></div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 9, padding: 11, background: "hsl(var(--card))" }}><strong style={{ fontSize: 12 }}>Controlled scanner</strong><div style={{ fontSize: 11, marginTop: 4 }}>{operations.scanner?.configured ? "Active; quarantined files will be processed" : "Not active; files remain safely quarantined"}</div></div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 9, padding: 11, background: "hsl(var(--card))" }}><strong style={{ fontSize: 12 }}>Telegram Word / Excel</strong><div style={{ fontSize: 11, marginTop: 4 }}>{operations.telegramDocuments?.configured ? "Active for linked super-admin chats" : "Not configured"}</div></div>
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 9, padding: 11, background: "hsl(var(--card))" }}><strong style={{ fontSize: 12 }}>Permanent computer receiver</strong><div style={{ fontSize: 11, marginTop: 4 }}>{operations.permanentComputerReceiver?.connected ? "Connected" : `Not connected · target ${String(operations.permanentComputerReceiver?.root || "F:\\BIMLog\\Feedback")}`}</div></div>
      </div>}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700 }}>
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            style={{ marginLeft: 8, border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "7px 10px", background: "hsl(var(--background))" }}
          >
            <option value="all">All statuses</option>
            {FEEDBACK_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {error && <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 12 }}>{error}</div>}
      {success && <div role="status" style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 8, background: "#ecfdf5", border: "1px solid #86efac", color: "#166534", fontSize: 12 }}>{success}</div>}
      {loading ? (
        <div style={{ padding: 32, color: "hsl(var(--muted-foreground))", textAlign: "center" }}>Loading feedback...</div>
      ) : visibleItems.length === 0 ? (
        <div style={{ padding: 32, color: "hsl(var(--muted-foreground))", textAlign: "center", border: "1px solid hsl(var(--border))", borderRadius: 10 }}>
          No feedback matches this view.
        </div>
      ) : (
        <div style={{ border: "1px solid hsl(var(--border))", borderRadius: 10, overflow: "hidden" }}>
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
                <Th>Created</Th>
                <Th>User</Th>
                <Th>Project</Th>
                <Th>Type</Th>
                <Th>Priority</Th>
                <Th>Module</Th>
                <Th>Message</Th>
                <Th>Evidence package</Th>
                <Th>Status / owner</Th>
                <Th>Follow-up</Th>
                <Th>Page</Th>
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
                    {(() => { const evidence = (item.evidence || {}) as Record<string, unknown>; const total = Number(evidence.total || 0), quarantined = Number(evidence.quarantined || 0), clean = Number(evidence.clean || 0), rejected = Number(evidence.rejected || 0); return <><div style={{ fontSize: 12, fontWeight: 800 }}>{total} file{total === 1 ? "" : "s"}</div><div style={{ fontSize: 11, color: quarantined ? "#b45309" : rejected ? "#b91c1c" : "#15803d" }}>{clean} clean · {quarantined} awaiting scan · {rejected} rejected</div><div style={{ fontSize: 11 }}>Package: {String(item.packageState || "metadata-only")}</div><div style={{ fontSize: 11 }}>Telegram docs: {String(item.telegramDeliveryState || "not-sent").replace(/_/g, " ")}</div></>; })()}
                  </Td>
                  <Td style={{ minWidth: 170, position: "sticky", right: 170, zIndex: 4, background: "hsl(var(--card))", boxShadow: "-1px 0 0 hsl(var(--border))" }}>
                    <select
                      value={String(item.status || "new")}
                      onChange={(event) => updateStatus(item.id, event.target.value)}
                      disabled={pendingAction === `status:${Number(item.id)}`}
                      style={{ border: "1px solid hsl(var(--border))", borderRadius: 6, padding: "6px 8px", fontSize: 12, background: "hsl(var(--background))" }}
                    >
                      {FEEDBACK_STATUS_OPTIONS.filter((option) => option.value === String(item.status || "new") || (FEEDBACK_STATUS_TRANSITIONS[String(item.status || "new")] || []).includes(option.value)).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <div style={{ marginTop: 6, fontSize: 11 }}>{pendingAction === `status:${Number(item.id)}` ? "Saving…" : item.ownerUserId ? `Owned by reviewer #${String(item.ownerUserId)}` : "Unassigned"}</div>
                  </Td>
                  <Td style={{ minWidth: 170, position: "sticky", right: 0, zIndex: 4, background: "hsl(var(--card))" }}><div style={{ display: "grid", gap: 6 }}><Button variant="outline" size="sm" onClick={() => void openDetail(item.id)}>Open complete review</Button>{!item.ownerUserId && <Button variant="outline" size="sm" disabled={pendingAction === `claim:${Number(item.id)}`} onClick={() => void claimFeedback(item)}>{pendingAction === `claim:${Number(item.id)}` ? "Claiming…" : "Claim as my item"}</Button>}<Button variant="outline" size="sm" disabled={item.packageState !== "ready"} title={item.packageState !== "ready" ? "Evidence remains locked until controlled scanning is complete" : "Download PDF, Word, Excel, JSON, and verified evidence together"} onClick={() => void downloadPackage(item)}>Download complete ZIP</Button><Button variant="outline" size="sm" disabled={!item.packageSnapshot} onClick={() => void downloadPackageSnapshot(item,"pdf")}>Download PDF report</Button><Button variant="outline" size="sm" disabled={!((item.packageSnapshot as Record<string, unknown> | null)?.docxSha256)} onClick={() => void downloadPackageSnapshot(item,"docx")}>Download Word report</Button><Button variant="outline" size="sm" disabled={!((item.packageSnapshot as Record<string, unknown> | null)?.workbookSha256)} onClick={() => void downloadPackageSnapshot(item,"xlsx")}>Download item Excel</Button><Button variant="outline" size="sm" disabled={!item.packageSnapshot} onClick={() => void downloadPackageSnapshot(item,"json")}>Download JSON record</Button><Button variant="outline" size="sm" onClick={() => void sendCustomerUpdate(item)}>Message customer</Button></div></Td>
                  <Td style={{ width: 130 }}>
                    <a href={String(item.pageUrl || "#")} target="_blank" rel="noreferrer" style={{ color: "#1d4ed8", fontSize: 11 }}>
                      Open reported page ↗
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      {selectedId !== null && <section role="dialog" aria-modal="true" aria-label="Selected feedback package" style={{ position: "fixed", top: 72, right: 16, bottom: 16, zIndex: 1500, width: "min(620px, calc(100vw - 32px))", overflowY: "auto", padding: 18, border: "2px solid #2563eb", borderRadius: 12, background: "hsl(var(--card))", boxShadow: "0 24px 70px rgba(15,23,42,.3)" }}>
        <div style={{ position: "sticky", top: -18, zIndex: 2, margin: "-18px -18px 12px", padding: 18, display: "flex", justifyContent: "space-between", gap: 12, background: "hsl(var(--card))", borderBottom: "1px solid hsl(var(--border))" }}><div><h3 style={{ margin: 0 }}>Complete feedback review</h3><div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>Evidence inventory, scan status, package history, and customer follow-up</div></div><Button variant="outline" size="sm" onClick={() => { setSelectedId(null); setDetail(null); }}>Close</Button></div>
        {detailLoading ? <p role="status">Loading complete package…</p> : detail ? <>
          <p><strong>{String(((detail.feedback || {}) as Record<string, unknown>).stableId || selectedId)}</strong> · Package: {String(detail.packageState || "unknown")} · Automatic snapshot: {detail.packageSnapshot ? String((detail.packageSnapshot as Record<string,unknown>).state || "ready") : "preparing"}</p>
          <h4>Evidence</h4>
          {Array.isArray(detail.assets) && detail.assets.length ? <ul>{(detail.assets as Record<string, unknown>[]).map(asset => <li key={String(asset.id)} style={{ marginBottom: 10 }}><strong>{String(asset.name)}</strong> — {String(asset.kind)} — {String(asset.scanState)} via {String(asset.scannerAdapter)} — {Number(asset.byteSize || 0).toLocaleString()} bytes<br/><span style={{ fontSize: 11, color: String(asset.scanState) === "clean" ? "#166534" : "#92400e" }}>{String(asset.scanState) === "clean" ? "Verified file is available in PDF/Word/ZIP and by secure download." : "File is recorded but its bytes stay locked until controlled scanning completes."}</span>{String(asset.scanState) === "clean" && <><br/><Button variant="outline" size="sm" onClick={() => void downloadEvidence(asset)}>Download verified file</Button></>}</li>)}</ul> : <p>No files attached.</p>}
          <h4>Activity</h4>
          {Array.isArray(detail.history) && detail.history.length ? <ol>{(detail.history as Record<string, unknown>[]).map(event => <li key={String(event.id)}><strong>{String(event.eventType).replace(/_/g, " ")}</strong> · {event.createdAt ? new Date(String(event.createdAt)).toLocaleString() : ""}{event.reason ? ` — ${String(event.reason)}` : ""}{String(event.eventType) === "feedback_telegram_delivery" ? ` — ${String(((event.afterState || {}) as Record<string,unknown>).artifactKind || "document")}: ${String(((event.afterState || {}) as Record<string,unknown>).state || "unknown")}` : ""}</li>)}</ol> : <p>No activity recorded.</p>}
        </> : <p role="alert">Package details could not be loaded.</p>}
      </section>}
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
