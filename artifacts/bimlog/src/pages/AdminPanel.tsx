import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function apiFetch(path: string, token: string, opts?: RequestInit) {
  return fetch(`${API_BASE}/api/v1${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
  });
}

const TABS = ["Overview", "Users", "Companies", "Projects", "Email Log", "Activity Feed", "Feature Flags", "Admin Log"];

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
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "hsl(var(--muted-foreground))" }}>✕</button>
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
  useEffect(() => { apiFetch("/admin/overview?scope=mine", token).then(r => r.json()).then(setData).catch(() => {}); }, [token]);
  if (!data) return <div style={{ padding: 32, color: "hsl(var(--muted-foreground))" }}>Loading...</div>;
  return (
    <div>
      <div style={{ marginBottom: 16, padding: "8px 14px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>
        Showing data scoped to projects you administer. Platform-wide data is available in Total Control (super admin only).
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
        {Object.entries(data.stats).map(([k, v]) => (
          <StatCard key={k} label={STAT_LABELS[k] || k.replace(/([A-Z])/g, " $1").replace(/_/g, " ")} value={v} />
        ))}
      </div>
      <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Project Activity Feed (last 50)</h3>
      {data.activity.length === 0
        ? <div style={{ padding: "32px 0", color: "hsl(var(--muted-foreground))", fontSize: 13, textAlign: "center" }}>No activity yet. Actions taken in projects will appear here.</div>
        : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><Th>Project</Th><Th>User</Th><Th>Action</Th><Th>Entity</Th><Th>Details</Th><Th>When</Th></tr></thead>
              <tbody>
                {data.activity.map((a: Record<string, unknown>) => (
                  <tr key={String(a.id)}>
                    <Td><span style={{ fontWeight: 500 }}>{String(a.projectName || "")}</span></Td>
                    <Td><div>{String(a.userFullName || "")}</div><div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{String(a.userCompanyName || "")}</div></Td>
                    <Td><Badge label={String(a.actionType || "")} color="#3b82f6" /></Td>
                    <Td>{String(a.entityType || "")}{a.entityId ? ` #${a.entityId}` : ""}</Td>
                    <Td style={{ maxWidth: 400, wordBreak: "break-word", whiteSpace: "normal", overflowWrap: "anywhere" }}><span style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{String(a.details || "")}</span></Td>
                    <Td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{new Date(String(a.createdAt)).toLocaleString()}</Td>
                  </tr>
                ))}
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
  const [createForm, setCreateForm] = useState({ fullName: "", email: "", password: "", companyName: "" });
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/admin/users?scope=mine&search=${encodeURIComponent(search)}`, token)
      .then(r => r.json()).then(d => setUsers(d.data || [])).finally(() => setLoading(false));
  }, [search, token]);
  useEffect(() => { load(); }, [load]);

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
    const r = await apiFetch("/admin/users", token, { method: "POST", body: JSON.stringify(createForm) });
    const d = await r.json();
    if (d.id) { setShowCreate(false); setCreateForm({ fullName: "", email: "", password: "", companyName: "" }); setMsg("User created."); load(); }
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
              <Input type={field === "password" ? "password" : "text"} value={(createForm as Record<string, string>)[field]} onChange={e => setCreateForm(f => ({ ...f, [field]: e.target.value }))} />
            </div>
          ))}
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
    apiFetch("/admin/companies?scope=mine", token).then(r => r.json()).then(setCompanies).catch(() => {});
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
    }).catch(() => {});
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

      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: "hsl(var(--foreground))" }}>Registered Companies (project-scoped)</div>
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
  const [projects, setProjects] = useState<Record<string, unknown>[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, unknown>[]>([]);
  const [transferModal, setTransferModal] = useState<number | null>(null);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => {
    apiFetch("/admin/projects?scope=mine", token).then(r => r.json()).then(setProjects).catch(() => {});
    apiFetch("/admin/users?scope=mine", token).then(r => r.json()).then(d => setAllUsers(d.data || [])).catch(() => {});
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
                    <a href={`/projects/${p.id}`} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">View</Button></a>
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
    apiFetch(`/admin/email-log?scope=mine&${params}`, token).then(r => r.json()).then(d => { setLogs(d.data || []); setTotal(d.total || 0); }).catch(() => {});
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
    apiFetch(`/admin/activity?scope=mine&page=${page}`, token).then(r => r.json()).then(d => { setItems(d.data || []); setTotal(d.total || 0); }).catch(() => {});
  }, [token, page]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 12, color: "hsl(var(--muted-foreground))" }}>{total} total events across all projects</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><Th>Project</Th><Th>User</Th><Th>Company</Th><Th>Action</Th><Th>Entity</Th><Th>Details</Th><Th>When</Th></tr></thead>
          <tbody>
            {items.map((a: Record<string, unknown>) => (
              <tr key={String(a.id)}>
                <Td style={{ fontWeight: 500, fontSize: 12 }}>{String(a.projectName || "")}</Td>
                <Td style={{ fontSize: 12 }}>{String(a.userFullName || "")}</Td>
                <Td style={{ fontSize: 12 }}>{String(a.userCompanyName || "")}</Td>
                <Td><Badge label={String(a.actionType || "")} color="#3b82f6" /></Td>
                <Td style={{ fontSize: 12 }}>{String(a.entityType || "")}</Td>
                <Td style={{ maxWidth: 400, wordBreak: "break-word", whiteSpace: "normal", overflowWrap: "anywhere", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{String(a.details || "")}</Td>
                <Td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{new Date(String(a.createdAt)).toLocaleString()}</Td>
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

// ── Feature Flags Tab ─────────────────────────────────────────────────────────
function FeatureFlagsTab({ token }: { token: string }) {
  const [flags, setFlags] = useState<Record<string, unknown>[]>([]);
  const [msg, setMsg] = useState("");
  const load = () => apiFetch("/admin/feature-flags?scope=mine", token).then(r => r.json()).then(setFlags).catch(() => {});
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
    apiFetch(`/admin/actions-log?scope=mine&page=${page}`, token).then(r => r.json()).then(d => { setLogs(d.data || []); setTotal(d.total || 0); }).catch(() => {});
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
                    <Td style={{ maxWidth: 400, wordBreak: "break-word", whiteSpace: "normal", overflowWrap: "anywhere", fontSize: 11, color: "hsl(var(--muted-foreground))" }}>{l.details ? JSON.stringify(l.details) : "—"}</Td>
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
export function AdminPanel() {
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    apiFetch("/admin/overview?scope=mine", token)
      .then(r => { if (r.status === 403 || r.status === 401) setLocation("/dashboard"); })
      .catch(() => setLocation("/dashboard"))
      .finally(() => setChecking(false));
  }, [token, setLocation]);

  if (checking || !token) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "hsl(var(--muted-foreground))" }}>Checking access...</div>;

  return (
    <div style={{ minHeight: "100vh", background: "hsl(var(--background))" }}>
      <div style={{ borderBottom: "1px solid hsl(var(--border))", background: "hsl(var(--card))", padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 20, paddingBottom: 0 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Project Administration</h1>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              Scoped to your projects — companies, users, and data visible here belong to projects you administer.
            </p>
          </div>
          <Button variant="ghost" size="sm" style={{ marginLeft: "auto", fontSize: 12 }} onClick={() => setLocation("/dashboard")}>Back to Dashboard</Button>
        </div>
        <div style={{ display: "flex", gap: 0, marginTop: 16, overflowX: "auto" }}>
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)} style={{
              padding: "10px 18px", fontSize: 13, fontWeight: activeTab === i ? 700 : 500, border: "none",
              borderBottom: activeTab === i ? "2px solid #ef4444" : "2px solid transparent",
              background: "none", cursor: "pointer", color: activeTab === i ? "#ef4444" : "hsl(var(--muted-foreground))",
              whiteSpace: "nowrap", transition: "all 0.15s",
            }}>
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>
        {activeTab === 0 && <OverviewTab token={token} />}
        {activeTab === 1 && <UsersTab token={token} />}
        {activeTab === 2 && <CompaniesTab token={token} />}
        {activeTab === 3 && <ProjectsTab token={token} />}
        {activeTab === 4 && <EmailLogTab token={token} />}
        {activeTab === 5 && <ActivityFeedTab token={token} />}
        {activeTab === 6 && <FeatureFlagsTab token={token} />}
        {activeTab === 7 && <AdminActionsLogTab token={token} />}
      </div>
    </div>
  );
}
