import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { getMe } from "@workspace/api-client-react";
import { User, Building2, Folder, Circle, FileText, Zap, MessageSquare, ClipboardList, TrendingUp, Brain, Loader2, Lock, AlertTriangle, Users, MapPin } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function apiFetch(path: string, token: string, opts?: RequestInit) {
  return fetch(`${API_BASE}/api/v1${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
  });
}

function Pill({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 9999,
      fontSize: 11, fontWeight: 700,
      background: color ? `${color}22` : "#F3F4F6",
      color: color ?? "#374151",
      border: `1px solid ${color ? `${color}44` : "#E5E7EB"}`,
    }}>{label}</span>
  );
}

function TCModal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 28, maxWidth: wide ? 760 : 540, width: "92vw", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 style={{ fontWeight: 800, fontSize: 16, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#9CA3AF", lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  active: "#16A34A", archived: "#D97706", inactive: "#9CA3AF",
  approved: "#16A34A", rejected: "#DC2626", pending: "#D97706", under_review: "#2563EB",
  sent: "#16A34A", failed: "#DC2626", skipped: "#D97706",
};

function TCTh({ children }: { children: React.ReactNode }) {
  return <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9CA3AF", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>{children}</th>;
}
function TCTd({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "10px 14px", fontSize: 13, borderBottom: "1px solid #F3F4F6", verticalAlign: "middle", ...style }}>{children}</td>;
}

function TCInput({ value, onChange, placeholder, type, style }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string; type?: string; style?: React.CSSProperties }) {
  return <input value={value} onChange={onChange} placeholder={placeholder} type={type || "text"} style={{ width: "100%", padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13, boxSizing: "border-box", ...style }} />;
}

function TCButton({ children, onClick, disabled, variant, style }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "outline" | "danger" | "primary"; style?: React.CSSProperties }) {
  const base: React.CSSProperties = { padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", border: "1px solid #D1D5DB", background: "white", color: "#374151", transition: "all 0.1s", opacity: disabled ? 0.5 : 1, ...style };
  if (variant === "danger") { base.color = "#DC2626"; base.borderColor = "#FECACA"; base.background = "#FEF2F2"; }
  if (variant === "primary") { base.color = "white"; base.background = "#1D4ED8"; base.borderColor = "#1D4ED8"; }
  return <button onClick={onClick} disabled={disabled} style={base}>{children}</button>;
}

interface PlatformStats { totalUsers: number; totalCompanies: number; totalProjects: number; totalFiles: number; totalRfis: number; totalSubmittals: number; activeProjects: number; filesLast24h: number; rfisLast7d: number; }
interface Company { id: number; name: string; status: string; plan?: string; projectCount: number; userCount: number; fileCount: number; createdAt: string; website?: string; address?: string; phone?: string; }
interface Project { id: number; code: string; name: string; status: string; companyName?: string; memberCount: number; fileCount: number; rfiCount?: number; submittalCount?: number; createdAt: string; conventionCompanyCodes?: string[]; participatingCompanies?: string[]; unassignedConventionCompanies?: string[]; }

const TABS = ["Overview", "Users", "Companies", "Projects", "Email Log", "Activity Feed"];

function HealthBar({ stats }: { stats: PlatformStats }) {
  const items = [
    { key: "totalUsers", label: "Users", value: stats.totalUsers, color: "#2563EB", icon: <User size={16} /> },
    { key: "totalCompanies", label: "Companies", value: stats.totalCompanies, color: "#7C3AED", icon: <Building2 size={16} /> },
    { key: "totalProjects", label: "All Projects", value: stats.totalProjects, color: "#0891B2", icon: <Folder size={16} /> },
    { key: "activeProjects", label: "Active Projects", value: stats.activeProjects, color: "#16A34A", icon: <Circle size={16} fill="#16A34A" /> },
    { key: "totalFiles", label: "Files", value: stats.totalFiles, color: "#D97706", icon: <FileText size={16} /> },
    { key: "filesLast24h", label: "Files 24h", value: stats.filesLast24h, color: "#EA580C", icon: <Zap size={16} /> },
    { key: "totalRfis", label: "RFIs", value: stats.totalRfis, color: "#DC2626", icon: <MessageSquare size={16} /> },
    { key: "totalSubmittals", label: "Submittals", value: stats.totalSubmittals, color: "#9333EA", icon: <ClipboardList size={16} /> },
    { key: "rfisLast7d", label: "RFIs (7d)", value: stats.rfisLast7d, color: "#DB2777", icon: <TrendingUp size={16} /> },
  ];
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {items.map(i => (
        <div key={i.key} style={{ flex: "1 0 120px", minWidth: 110, padding: "14px 16px", border: "1.5px solid #E5E7EB", borderRadius: 12, background: "white", textAlign: "left", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>{i.icon}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: i.color, lineHeight: 1 }}>{i.value.toLocaleString()}</div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", marginTop: 4 }}>{i.label}</div>
        </div>
      ))}
    </div>
  );
}

function CompanyPanel({ companies, onSelect }: { companies: Company[]; onSelect: (c: Company) => void }) {
  const [sortKey, setSortKey] = useState<keyof Company>("projectCount");
  const sorted = [...companies].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number") return bv - av;
    return String(av).localeCompare(String(bv));
  });
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Building2 size={14} /> Company Performance ({companies.length})</div>
        <select value={String(sortKey)} onChange={e => setSortKey(e.target.value as keyof Company)} style={{ fontSize: 12, padding: "4px 10px", border: "1px solid #E5E7EB", borderRadius: 6, cursor: "pointer" }}>
          <option value="projectCount">Sort: Projects</option>
          <option value="fileCount">Sort: Files</option>
          <option value="userCount">Sort: Users</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>{["Company", "Projects", "Users", "Files", "Joined"].map(h => <TCTh key={h}>{h}</TCTh>)}</tr></thead>
          <tbody>
            {sorted.map(c => (
              <tr key={c.id} onClick={() => onSelect(c)} style={{ cursor: "pointer" }} onMouseEnter={e => (e.currentTarget.style.background = "#EFF6FF")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                <TCTd style={{ fontWeight: 600 }}>{c.name}</TCTd>
                <TCTd style={{ fontWeight: 700, color: "#2563EB" }}>{c.projectCount}</TCTd>
                <TCTd>{c.userCount}</TCTd>
                <TCTd>{c.fileCount.toLocaleString()}</TCTd>
                <TCTd style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(c.createdAt).toLocaleDateString()}</TCTd>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getProjectHealth(p: Project): { color: string; label: string } {
  if (p.status === "archived") return { color: "#D97706", label: "Archived" };
  if (p.status !== "active") return { color: "#9CA3AF", label: "Inactive" };
  const rfi = p.rfiCount ?? 0;
  const sub = p.submittalCount ?? 0;
  if (rfi > 10 || sub > 20) return { color: "#DC2626", label: "High Load" };
  if (rfi > 5 || sub > 10) return { color: "#F59E0B", label: "Watch" };
  return { color: "#16A34A", label: "Healthy" };
}

function ProjectsGrid({ projects, onSelect }: { projects: Project[]; onSelect: (p: Project) => void }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? projects : projects.filter(p => getProjectHealth(p).label.toLowerCase() === filter);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><Folder size={14} /> Active Projects ({projects.length})</div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "healthy", "watch", "high load", "archived"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid #E5E7EB", background: filter === f ? "#1D4ED8" : "white", color: filter === f ? "white" : "#374151", cursor: "pointer" }}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {filtered.map(p => {
          const health = getProjectHealth(p);
          return (
            <button key={p.id} onClick={() => onSelect(p)} style={{ border: `2px solid ${health.color}44`, borderLeft: `4px solid ${health.color}`, borderRadius: 10, padding: "14px", background: `${health.color}08`, cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 800, color: health.color, background: `${health.color}18`, padding: "1px 7px", borderRadius: 4 }}>{p.code}</span>
                <Pill label={health.label} color={health.color} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#111", marginBottom: 6, lineHeight: 1.3 }}>{p.name}</div>
              {p.companyName && <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Building2 size={11} /> {p.companyName}</div>}
              <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#6B7280" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users size={11} /> {p.memberCount}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><FileText size={11} /> {p.fileCount.toLocaleString()}</span>
              </div>
              {(p.unassignedConventionCompanies?.length ?? 0) > 0 && (
                <div style={{ marginTop: 6, fontSize: 10, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 4, padding: "2px 6px", display: "inline-block" }}>
                  {p.unassignedConventionCompanies!.length} convention {p.unassignedConventionCompanies!.length === 1 ? "company" : "companies"} — no users assigned
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BrainBrief({ token }: { token: string }) {
  const [brief, setBrief] = useState<{ summary: string; criticalItems: string[]; todaysDate: string; highlights?: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);
  const load = async () => {
    if (shown) return;
    setLoading(true); setShown(true);
    try { const r = await apiFetch("/dashboard/briefing?platform=1", token); if (r.ok) setBrief(await r.json()); } finally { setLoading(false); }
  };
  return (
    <div style={{ border: "1.5px solid #BFDBFE", borderRadius: 14, background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)", overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #DBEAFE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#1D4ED8", display: "flex", alignItems: "center", gap: 6 }}><Brain size={15} /> Brain Daily Brief</div>
          <div style={{ fontSize: 12, color: "#3B82F6", marginTop: 2 }}>AI-powered platform intelligence snapshot</div>
        </div>
        {!shown && <button onClick={load} style={{ padding: "8px 16px", background: "#2563EB", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>Generate Brief</button>}
      </div>
      <div style={{ padding: "16px 20px" }}>
        {loading && <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#2563EB", fontSize: 13 }}><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating AI brief...</div>}
        {!loading && !brief && !shown && <div style={{ color: "#9CA3AF", fontSize: 13 }}>Click "Generate Brief" for an AI summary of platform activity.</div>}
        {!loading && brief && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: "#6B7280" }}>Generated: {brief.todaysDate}</span>
              <button onClick={() => { setBrief(null); setShown(false); }} style={{ fontSize: 11, color: "#3B82F6", background: "none", border: "none", cursor: "pointer" }}>Regenerate</button>
            </div>
            <p style={{ fontSize: 13, color: "#1E3A5F", lineHeight: 1.7, marginBottom: 14 }}>{brief.summary}</p>
            {brief.criticalItems?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1D4ED8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Critical Items</div>
                <ul style={{ margin: 0, padding: "0 0 0 16px" }}>{brief.criticalItems.map((item, i) => <li key={i} style={{ fontSize: 13, color: "#374151", marginBottom: 5, lineHeight: 1.5 }}>{item}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AssignUserModal({ projectId, companyCode, token, onClose, onDone }: { projectId: number; companyCode: string; token: string; onClose: () => void; onDone: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState(companyCode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim() || !companyName.trim()) { setError("All fields are required"); return; }
    setSubmitting(true);
    setError("");
    try {
      const r = await apiFetch(`/projects/${projectId}/assign-company-user`, token, {
        method: "POST",
        body: JSON.stringify({ companyCode, newUserData: { fullName: fullName.trim(), email: email.trim().toLowerCase(), companyName: companyName.trim() } }),
      });
      if (r?.ok) { onDone(); }
      else {
        const data = await r?.json().catch(() => null);
        setError(data?.error || "Failed to assign user");
      }
    } catch { setError("Network error"); }
    setSubmitting(false);
  };

  return (
    <TCModal title={`Assign User — ${companyCode}`} onClose={onClose}>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>
        Create a new user for convention company <strong>{companyCode}</strong> in this project.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TCInput value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" />
        <TCInput value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" />
        <TCInput value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company Name" />
      </div>
      {error && <div style={{ color: "#DC2626", fontSize: 12, marginTop: 8 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <TCButton onClick={onClose}>Cancel</TCButton>
        <TCButton variant="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? "Assigning..." : "Assign User"}
        </TCButton>
      </div>
    </TCModal>
  );
}

function TCOverviewTab({ token, stats, companies, projects, onRefresh }: { token: string; stats: PlatformStats; companies: Company[]; projects: Project[]; onRefresh: () => void }) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [assignCode, setAssignCode] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  return (
    <div>
      <div style={{ marginBottom: 16, padding: "8px 14px", borderRadius: 8, background: "#111827", border: "1px solid #374151", fontSize: 12, color: "#93C5FD", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
        <MapPin size={12} />
        Platform-wide totals — all projects, companies, and users across the entire platform.
      </div>
      <HealthBar stats={stats} />
      <div style={{ marginTop: 28 }}>
        <CompanyPanel companies={companies} onSelect={setSelectedCompany} />
      </div>
      <div style={{ marginTop: 20 }}>
        <ProjectsGrid projects={projects} onSelect={setSelectedProject} />
      </div>
      <div style={{ marginTop: 20 }}>
        <BrainBrief token={token} />
      </div>
      {selectedCompany && (
        <TCModal title={`${selectedCompany.name} — Details`} onClose={() => setSelectedCompany(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Projects", String(selectedCompany.projectCount)], ["Users", String(selectedCompany.userCount)], ["Files", selectedCompany.fileCount.toLocaleString()], ["Joined", new Date(selectedCompany.createdAt).toLocaleDateString()]].map(([k, v]) => (
              <div key={k} style={{ padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{v}</div>
              </div>
            ))}
          </div>
        </TCModal>
      )}
      {selectedProject && (
        <TCModal title={`${selectedProject.code} — ${selectedProject.name}`} onClose={() => setSelectedProject(null)} wide>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            {[["Company", selectedProject.companyName || "-"], ["Status", selectedProject.status], ["Members", String(selectedProject.memberCount)], ["Files", selectedProject.fileCount.toLocaleString()], ["RFIs", String(selectedProject.rfiCount ?? "-")], ["Submittals", String(selectedProject.submittalCount ?? "-")], ["Created", new Date(selectedProject.createdAt).toLocaleDateString()]].map(([k, v]) => (
              <div key={k} style={{ padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{v}</div>
              </div>
            ))}
          </div>
          {(selectedProject.conventionCompanyCodes?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 20, padding: 14, border: "1px solid #E5E7EB", borderRadius: 8, background: "#F9FAFB" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6B7280", marginBottom: 10 }}>Company / User Assignment</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                <div style={{ padding: "8px 12px", background: "#EFF6FF", borderRadius: 6, border: "1px solid #BFDBFE" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#3B82F6" }}>Convention Companies</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#1D4ED8" }}>{selectedProject.conventionCompanyCodes!.length}</div>
                </div>
                <div style={{ padding: "8px 12px", background: "#F0FDF4", borderRadius: 6, border: "1px solid #BBF7D0" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#16A34A" }}>Participating (with users)</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#15803D" }}>{selectedProject.participatingCompanies?.length ?? 0}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selectedProject.conventionCompanyCodes!.map(code => {
                  const isUnassigned = selectedProject.unassignedConventionCompanies?.includes(code);
                  return (
                    <span key={code} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                      background: isUnassigned ? "#FEF2F2" : "#F0FDF4",
                      color: isUnassigned ? "#DC2626" : "#15803D",
                      border: `1px solid ${isUnassigned ? "#FECACA" : "#BBF7D0"}`,
                      cursor: isUnassigned ? "pointer" : "default",
                    }}
                      onClick={() => { if (isUnassigned) setAssignCode(code); }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: isUnassigned ? "#DC2626" : "#16A34A" }} />
                      {code}
                      <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.8 }}>
                        {isUnassigned ? "Assign User" : "assigned"}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <TCButton variant="primary" onClick={() => { setSelectedProject(null); setLocation(`/projects/${selectedProject.id}/analytics`); }}>Open Project</TCButton>
          </div>
          {assignCode && (
            <AssignUserModal
              projectId={selectedProject.id}
              companyCode={assignCode}
              token={token}
              onClose={() => setAssignCode(null)}
              onDone={() => { setAssignCode(null); onRefresh(); setSelectedProject(null); }}
            />
          )}
        </TCModal>
      )}
    </div>
  );
}

function TCUsersTab({ token }: { token: string }) {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [resetModal, setResetModal] = useState<number | null>(null);
  const [newPw, setNewPw] = useState("");
  const [createForm, setCreateForm] = useState({ fullName: "", email: "", password: "", companyName: "", projectId: "" });
  const [projectsList, setProjectsList] = useState<{ id: number; code: string; name: string }[]>([]);
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    apiFetch(`/admin/users?search=${encodeURIComponent(search)}`, token)
      .then(r => r.json()).then(d => setUsers(d.data || [])).finally(() => setLoading(false));
  }, [search, token]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiFetch("/admin/projects-list", token).then(r => r.json()).then(setProjectsList).catch(() => {});
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
    if (d.success) { setResetModal(null); setNewPw(""); setMsg("Password reset."); } else setMsg(d.error || "Failed");
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
      {msg && <div style={{ background: "#16A34A22", border: "1px solid #16A34A44", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#16A34A" }}>{msg}</div>}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <TCInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." style={{ maxWidth: 320 }} />
        <TCButton onClick={load}>Search</TCButton>
        <TCButton variant="primary" onClick={() => setShowCreate(true)} style={{ marginLeft: "auto" }}>+ Create User</TCButton>
      </div>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TCTh>Name</TCTh><TCTh>Email</TCTh><TCTh>Company</TCTh><TCTh>Projects</TCTh><TCTh>Joined</TCTh><TCTh>Actions</TCTh></tr></thead>
          <tbody>
            {users.map((u: Record<string, unknown>) => (
              <tr key={String(u.id)}>
                <TCTd style={{ fontWeight: 600 }}>{String(u.fullName || "")}</TCTd>
                <TCTd style={{ fontSize: 12 }}>{String(u.email || "")}</TCTd>
                <TCTd style={{ fontSize: 12 }}>{String(u.companyName || "")}</TCTd>
                <TCTd>{String(u.projectCount || 0)}</TCTd>
                <TCTd style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(String(u.createdAt)).toLocaleDateString()}</TCTd>
                <TCTd>
                  <div style={{ display: "flex", gap: 6 }}>
                    <TCButton onClick={() => { setResetModal(u.id as number); setNewPw(""); }}>Reset PW</TCButton>
                    <TCButton variant="danger" onClick={() => deleteUser(u.id as number, String(u.fullName))}>Delete</TCButton>
                  </div>
                </TCTd>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading && <div style={{ padding: 16, color: "#9CA3AF", textAlign: "center" }}>Loading...</div>}
      {resetModal && (
        <TCModal title="Reset Password" onClose={() => setResetModal(null)}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>New Password (min 8 chars)</label>
            <TCInput type="password" value={newPw} onChange={e => setNewPw(e.target.value)} />
          </div>
          <TCButton variant="primary" onClick={doResetPw} disabled={newPw.length < 8}>Set Password</TCButton>
        </TCModal>
      )}
      {showCreate && (
        <TCModal title="Create User" onClose={() => setShowCreate(false)}>
          {["fullName", "email", "password", "companyName"].map(field => (
            <div key={field} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{field.replace(/([A-Z])/g, " $1")}</label>
              <TCInput type={field === "password" ? "password" : "text"} value={(createForm as Record<string, string>)[field]} onChange={e => setCreateForm(f => ({ ...f, [field]: e.target.value }))} />
            </div>
          ))}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Assign to Project (optional)</label>
            <select value={createForm.projectId} onChange={e => setCreateForm(f => ({ ...f, projectId: e.target.value }))} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13, boxSizing: "border-box" }}>
              <option value="">Platform-wide (no project)</option>
              {projectsList.map(p => <option key={p.id} value={String(p.id)}>{p.code} — {p.name}</option>)}
            </select>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>Super admin: optional. If selected, user is linked as project member.</div>
          </div>
          <TCButton variant="primary" onClick={doCreate}>Create</TCButton>
        </TCModal>
      )}
    </div>
  );
}

function TCCompaniesTab({ token }: { token: string }) {
  const [companies, setCompanies] = useState<Record<string, unknown>[]>([]);
  const [editModal, setEditModal] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState("");

  const load = () => {
    apiFetch("/admin/companies", token).then(r => r.json()).then(d => setCompanies(Array.isArray(d) ? d : [])).catch(() => {});
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
      {msg && <div style={{ background: "#16A34A22", border: "1px solid #16A34A44", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#16A34A" }}>{msg}</div>}
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4, color: "#111" }}>All Platform Companies</div>
      <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 10 }}>Every registered company across the platform. Users, projects, and files are platform-wide totals.</div>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TCTh>Company</TCTh><TCTh>Users</TCTh><TCTh>Projects</TCTh><TCTh>Files</TCTh><TCTh>Created</TCTh><TCTh>Actions</TCTh></tr></thead>
          <tbody>
            {companies.map((c: Record<string, unknown>) => (
              <tr key={String(c.id)}>
                <TCTd style={{ fontWeight: 600 }}>{String(c.name || "")}</TCTd>
                <TCTd>{String(c.userCount || 0)}</TCTd>
                <TCTd>{String(c.projectCount || 0)}</TCTd>
                <TCTd>{String(c.fileCount || 0)}</TCTd>
                <TCTd style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(String(c.createdAt)).toLocaleDateString()}</TCTd>
                <TCTd>
                  <div style={{ display: "flex", gap: 6 }}>
                    <TCButton onClick={() => setEditModal({ ...c })}>Edit</TCButton>
                    <TCButton variant="danger" onClick={() => doDelete(c.id as number, String(c.name), c.userCount as number)}>Delete</TCButton>
                  </div>
                </TCTd>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editModal && (
        <TCModal title="Edit Company" onClose={() => setEditModal(null)}>
          {["name", "website", "address", "phone"].map(field => (
            <div key={field} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{field.charAt(0).toUpperCase() + field.slice(1)}</label>
              <TCInput value={String((editModal as Record<string, unknown>)[field] || "")} onChange={e => setEditModal(m => ({ ...m!, [field]: e.target.value }))} />
            </div>
          ))}
          <TCButton variant="primary" onClick={doSave}>Save</TCButton>
        </TCModal>
      )}
    </div>
  );
}

function TCProjectsTab({ token }: { token: string }) {
  const [, setLocation] = useLocation();
  const [projects, setProjects] = useState<Record<string, unknown>[]>([]);
  const [allUsers, setAllUsers] = useState<Record<string, unknown>[]>([]);
  const [transferModal, setTransferModal] = useState<number | null>(null);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [msg, setMsg] = useState("");

  const load = () => {
    apiFetch("/admin/projects", token).then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch("/admin/users", token).then(r => r.json()).then(d => setAllUsers(d.data || [])).catch(() => {});
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
      {msg && <div style={{ background: "#16A34A22", border: "1px solid #16A34A44", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#16A34A" }}>{msg}</div>}
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TCTh>Project</TCTh><TCTh>Code</TCTh><TCTh>Company</TCTh><TCTh>Convention Cos.</TCTh><TCTh>Status</TCTh><TCTh>Members</TCTh><TCTh>Files</TCTh><TCTh>Created</TCTh><TCTh>Actions</TCTh></tr></thead>
          <tbody>
            {projects.map((p: Record<string, unknown>) => {
              const convCodes = (p.conventionCompanyCodes || []) as string[];
              const unassigned = (p.unassignedConventionCompanies || []) as string[];
              return (
              <tr key={String(p.id)}>
                <TCTd style={{ fontWeight: 600 }}>{String(p.name || "")}</TCTd>
                <TCTd style={{ fontSize: 12, fontFamily: "monospace" }}>{String(p.code || "")}</TCTd>
                <TCTd style={{ fontSize: 12 }}>{String(p.companyName || "")}</TCTd>
                <TCTd>
                  {convCodes.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {convCodes.map(c => (
                        <span key={c} style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 8, background: unassigned.includes(c) ? "#fef2f2" : "#f0fdf4", color: unassigned.includes(c) ? "#dc2626" : "#15803d", border: `1px solid ${unassigned.includes(c) ? "#fecaca" : "#bbf7d0"}` }}>{c}</span>
                      ))}
                    </div>
                  ) : <span style={{ fontSize: 11, color: "#9CA3AF" }}>--</span>}
                </TCTd>
                <TCTd><Pill label={String(p.status || "")} color={STATUS_COLOR[String(p.status)] || undefined} /></TCTd>
                <TCTd>{String(p.memberCount || 0)}</TCTd>
                <TCTd>{String(p.fileCount || 0)}</TCTd>
                <TCTd style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(String(p.createdAt)).toLocaleDateString()}</TCTd>
                <TCTd>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    <TCButton onClick={() => setLocation(`/projects/${p.id}/analytics`)}>View</TCButton>
                    <TCButton onClick={() => doArchive(p.id as number, String(p.status))}>{p.status === "archived" ? "Restore" : "Archive"}</TCButton>
                    <TCButton onClick={() => { setTransferModal(p.id as number); setNewOwnerId(""); }}>Transfer</TCButton>
                    <TCButton variant="danger" onClick={() => doDelete(p.id as number, String(p.name))}>Delete</TCButton>
                  </div>
                </TCTd>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {transferModal && (
        <TCModal title="Transfer Ownership" onClose={() => setTransferModal(null)}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>New Owner</label>
            <select value={newOwnerId} onChange={e => setNewOwnerId(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13, boxSizing: "border-box" }}>
              <option value="">Select user...</option>
              {allUsers.map((u: Record<string, unknown>) => <option key={String(u.id)} value={String(u.id)}>{String(u.fullName)} ({String(u.email)})</option>)}
            </select>
          </div>
          <TCButton variant="primary" onClick={doTransfer} disabled={!newOwnerId}>Transfer</TCButton>
        </TCModal>
      )}
    </div>
  );
}

function TCEmailLogTab({ token }: { token: string }) {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: "", triggerType: "", from: "", to: "" });

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    apiFetch(`/admin/email-log?${params}`, token).then(r => r.json()).then(d => { setLogs(d.data || []); setTotal(d.total || 0); }).catch(() => {});
  }, [token, page, filters]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }}>
          <option value="">All Status</option>
          <option value="sent">Sent</option><option value="failed">Failed</option><option value="skipped">Skipped</option>
        </select>
        <TCInput value={filters.triggerType} onChange={e => setFilters(f => ({ ...f, triggerType: e.target.value }))} placeholder="Trigger type..." style={{ width: 160 }} />
        <TCInput type="date" value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} style={{ width: 140 }} />
        <TCInput type="date" value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} style={{ width: 140 }} />
        <TCButton onClick={load}>Filter</TCButton>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>{total} records</span>
      </div>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TCTh>To</TCTh><TCTh>Subject</TCTh><TCTh>Trigger</TCTh><TCTh>Status</TCTh><TCTh>Error</TCTh><TCTh>Sent At</TCTh></tr></thead>
          <tbody>
            {logs.map((l: Record<string, unknown>) => (
              <tr key={String(l.id)}>
                <TCTd style={{ fontSize: 12 }}>{String(l.toEmail || "")}</TCTd>
                <TCTd style={{ maxWidth: 240, fontSize: 12 }}>{String(l.subject || "")}</TCTd>
                <TCTd><Pill label={String(l.triggerType || "-")} /></TCTd>
                <TCTd><Pill label={String(l.status || "")} color={STATUS_COLOR[String(l.status)] || undefined} /></TCTd>
                <TCTd style={{ fontSize: 11, color: "#DC2626" }}>{String(l.errorMessage || "")}</TCTd>
                <TCTd style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(String(l.sentAt)).toLocaleString()}</TCTd>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 50 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <TCButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</TCButton>
          <span style={{ fontSize: 12, alignSelf: "center" }}>Page {page} of {Math.ceil(total / 50)}</span>
          <TCButton onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}>Next</TCButton>
        </div>
      )}
    </div>
  );
}

function TCActivityFeedTab({ token }: { token: string }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const load = useCallback(() => {
    apiFetch(`/admin/activity?page=${page}`, token).then(r => r.json()).then(d => { setItems(d.data || []); setTotal(d.total || 0); }).catch(() => {});
  }, [token, page]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div style={{ marginBottom: 12, fontSize: 12, color: "#9CA3AF" }}>{total} total events across all projects (platform-wide)</div>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TCTh>Project</TCTh><TCTh>User</TCTh><TCTh>Company</TCTh><TCTh>Action</TCTh><TCTh>Entity</TCTh><TCTh>Details</TCTh><TCTh>When</TCTh></tr></thead>
          <tbody>
            {items.map((a: Record<string, unknown>) => (
              <tr key={String(a.id)}>
                <TCTd style={{ fontWeight: 500, fontSize: 12 }}>{String(a.projectName || "")}</TCTd>
                <TCTd style={{ fontSize: 12 }}>{String(a.userFullName || "")}</TCTd>
                <TCTd style={{ fontSize: 12 }}>{String(a.userCompanyName || "")}</TCTd>
                <TCTd><Pill label={String(a.actionType || "")} color="#2563EB" /></TCTd>
                <TCTd style={{ fontSize: 12 }}>{String(a.entityType || "")}</TCTd>
                <TCTd style={{ maxWidth: 400, wordBreak: "break-word", whiteSpace: "normal", overflowWrap: "anywhere", fontSize: 11, color: "#9CA3AF" }}>{String(a.details || "")}</TCTd>
                <TCTd style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(String(a.createdAt)).toLocaleString()}</TCTd>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > 50 && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
          <TCButton onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</TCButton>
          <span style={{ fontSize: 12, alignSelf: "center" }}>Page {page} of {Math.ceil(total / 50)}</span>
          <TCButton onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 50)}>Next</TCButton>
        </div>
      )}
    </div>
  );
}

export function TotalControl() {
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    try {
      try {
        const r = await apiFetch("/admin/overview", token);
        if (r?.ok) { const d = await r.json(); setStats((d?.stats ?? d) || null); }
      } catch (e) { console.warn("overview failed", e); }
      try {
        const r = await apiFetch("/admin/companies", token);
        if (r?.ok) {
          const d = await r.json();
          setCompanies((Array.isArray(d) ? d : []).map((c: any) => ({ ...c, projectCount: Number(c.projectCount ?? 0), userCount: Number(c.userCount ?? 0), fileCount: Number(c.fileCount ?? 0), createdAt: c.createdAt ?? new Date().toISOString() })));
        }
      } catch (e) { console.warn("companies failed", e); }
      try {
        const r = await apiFetch("/admin/projects", token);
        if (r?.ok) {
          const d = await r.json();
          const raw: any[] = Array.isArray(d) ? d : Array.isArray(d?.projects) ? d.projects : [];
          setProjects(raw.map((p: any) => ({ ...p, memberCount: Number(p.memberCount ?? 0), fileCount: Number(p.fileCount ?? 0), rfiCount: Number(p.rfiCount ?? 0), submittalCount: Number(p.submittalCount ?? 0), createdAt: p.createdAt ?? new Date().toISOString() })));
        }
      } catch (e) { console.warn("projects failed", e); }
    } catch (e) {
      console.warn("loadAll failed", e);
      setLoadError(true);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    getMe()
      .then((data) => {
        const userData = data as any;
        if (!(userData?.is_super_admin === true || userData?.isSuperAdmin === true)) { setLocation("/dashboard"); return; }
        setAuthorized(true);
        loadAll();
      })
      .catch(() => { setLocation("/dashboard"); });
  }, [token, loadAll]);

  const safeStats: PlatformStats = {
    totalUsers: Number(stats?.totalUsers ?? 0), totalCompanies: Number(stats?.totalCompanies ?? 0),
    totalProjects: Number(stats?.totalProjects ?? 0), totalFiles: Number(stats?.totalFiles ?? 0),
    totalRfis: Number(stats?.totalRfis ?? 0), totalSubmittals: Number(stats?.totalSubmittals ?? 0),
    activeProjects: Number(stats?.activeProjects ?? 0), filesLast24h: Number(stats?.filesLast24h ?? 0),
    rfisLast7d: Number(stats?.rfisLast7d ?? 0),
  };

  if (authorized === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
        <div style={{ textAlign: "center", color: "#9CA3AF" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><Lock size={36} color="#9CA3AF" /></div>
          <div>Verifying access...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
        <div style={{ textAlign: "center", color: "#6B7280" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><AlertTriangle size={32} color="#9CA3AF" /></div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Unable to load Total Control dashboard.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => { setLoadError(false); loadAll(); }} style={{ padding: "8px 20px", borderRadius: 6, background: "#1D4ED8", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>Retry</button>
            <button onClick={() => setLocation("/dashboard")} style={{ padding: "8px 20px", borderRadius: 6, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB", cursor: "pointer", fontWeight: 600 }}>Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ background: "#111827", padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 32, height: 32, background: "#2563EB", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "white" }}>TC</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "white", lineHeight: 1 }}>Total Control</div>
              <div style={{ fontSize: 10, color: "#6B7280", marginTop: 1 }}>Super Admin · Platform-wide scope · All projects & companies</div>
            </div>
          </div>
          <button onClick={() => setLocation("/dashboard")} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Back to Dashboard</button>
        </div>
        <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)} style={{
              padding: "10px 18px", fontSize: 13, fontWeight: activeTab === i ? 700 : 500, border: "none",
              borderBottom: activeTab === i ? "2px solid #3B82F6" : "2px solid transparent",
              background: "none", cursor: "pointer", color: activeTab === i ? "#93C5FD" : "#D1D5DB",
              whiteSpace: "nowrap", transition: "all 0.15s",
            }}>
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[...Array(4)].map((_, i) => <div key={i} style={{ height: 80, background: "#E5E7EB", borderRadius: 12, animation: "pulse 1.5s infinite" }} />)}
          </div>
        ) : (
          <>
            {activeTab === 0 && token && <TCOverviewTab token={token} stats={safeStats} companies={companies} projects={projects} onRefresh={loadAll} />}
            {activeTab === 1 && token && <TCUsersTab token={token} />}
            {activeTab === 2 && token && <TCCompaniesTab token={token} />}
            {activeTab === 3 && token && <TCProjectsTab token={token} />}
            {activeTab === 4 && token && <TCEmailLogTab token={token} />}
            {activeTab === 5 && token && <TCActivityFeedTab token={token} />}
          </>
        )}
      </div>
    </div>
  );
}
