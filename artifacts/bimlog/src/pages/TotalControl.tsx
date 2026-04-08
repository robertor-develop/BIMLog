import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { getMe } from "@workspace/api-client-react";
import { User, Building2, Folder, Circle, FileText, Zap, MessageSquare, ClipboardList, TrendingUp, Brain, Loader2, Lock, AlertTriangle, Users, MapPin, Calendar } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function apiFetch(path: string, token: string, opts?: RequestInit) {
  return fetch(`${API_BASE}/api/v1${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
  });
}

/* ── Helper sub-components ─────────────────────────────────────────────────── */

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

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
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

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface PlatformStats { totalUsers: number; totalCompanies: number; totalProjects: number; totalFiles: number; totalRfis: number; totalSubmittals: number; activeProjects: number; filesLast24h: number; rfisLast7d: number; }
interface Company { id: number; name: string; status: string; plan?: string; projectCount: number; userCount: number; fileCount: number; createdAt: string; }
interface Project { id: number; code: string; name: string; status: string; companyName?: string; memberCount: number; fileCount: number; rfiCount?: number; submittalCount?: number; createdAt: string; conventionCompanyCodes?: string[]; participatingCompanies?: string[]; unassignedConventionCompanies?: string[]; }
interface UserRow { id: number; fullName: string; email: string; role: string; status: string; companyName?: string; lastLoginAt?: string; createdAt: string; }
interface EmailLogRow { id: number; to: string; subject: string; status: string; createdAt: string; errorMessage?: string; }
interface ActivityRow { id: number; userId?: number; userName?: string; projectId?: number; projectCode?: string; action: string; entity?: string; entityId?: number; createdAt: string; }
interface BriefData { summary: string; criticalItems: string[]; todaysDate: string; highlights?: string[]; }

/* ── Layer 1: Platform Health Bar ─────────────────────────────────────────── */

function HealthBar({ stats, onExpand }: { stats: PlatformStats; onExpand: (tab: string) => void }) {
  const items = [
    { key: "totalUsers",     label: "Users",          value: stats.totalUsers,     tab: "users",    color: "#2563EB", icon: <User size={16} /> },
    { key: "totalCompanies", label: "Companies",      value: stats.totalCompanies, tab: "companies",color: "#7C3AED", icon: <Building2 size={16} /> },
    { key: "totalProjects",  label: "All Projects",   value: stats.totalProjects,  tab: "projects", color: "#0891B2", icon: <Folder size={16} /> },
    { key: "activeProjects", label: "Active Projects",value: stats.activeProjects, tab: "projects", color: "#16A34A", icon: <Circle size={16} fill="#16A34A" /> },
    { key: "totalFiles",     label: "Files",          value: stats.totalFiles,     tab: "projects", color: "#D97706", icon: <FileText size={16} /> },
    { key: "filesLast24h",   label: "Files 24h",      value: stats.filesLast24h,   tab: "projects", color: "#EA580C", icon: <Zap size={16} /> },
    { key: "totalRfis",      label: "RFIs",           value: stats.totalRfis,      tab: "projects", color: "#DC2626", icon: <MessageSquare size={16} /> },
    { key: "totalSubmittals",label: "Submittals",     value: stats.totalSubmittals,tab: "projects", color: "#9333EA", icon: <ClipboardList size={16} /> },
    { key: "rfisLast7d",     label: "RFIs (7d)",      value: stats.rfisLast7d,     tab: "projects", color: "#DB2777", icon: <TrendingUp size={16} /> },
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        marginBottom: 10, padding: "3px 10px",
        background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6,
      }}>
        <MapPin size={11} color="#2563EB" />
        <span style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Platform-wide totals — all projects across all users
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {items.map(i => (
          <button
            key={i.key}
            onClick={() => onExpand(i.tab)}
            style={{
              flex: "1 0 120px", minWidth: 110, padding: "14px 16px",
              border: "1.5px solid #E5E7EB", borderRadius: 12,
              background: "white", cursor: "pointer", textAlign: "left",
              transition: "border-color 0.15s, box-shadow 0.15s",
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = i.color; e.currentTarget.style.boxShadow = `0 0 0 3px ${i.color}18`; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
          >
            <div style={{ fontSize: 18, marginBottom: 6 }}>{i.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: i.color, lineHeight: 1 }}>{i.value.toLocaleString()}</div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9CA3AF", marginTop: 4 }}>{i.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Layer 2: Company Performance Panel ───────────────────────────────────── */

function CompanyPanel({ companies, onSelect }: { companies: Company[]; onSelect: (c: Company) => void }) {
  const [sortKey, setSortKey] = useState<keyof Company>("projectCount");
  const sorted = [...companies].sort((a, b) => {
    const av = a[sortKey]; const bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number") return bv - av;
    return String(av).localeCompare(String(bv));
  });

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#111", display: "flex", alignItems: "center", gap: 6 }}><Building2 size={15} /> Company Performance</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{companies.length} companies on platform · click any row to drill in</div>
        </div>
        <select
          value={String(sortKey)}
          onChange={e => setSortKey(e.target.value as keyof Company)}
          style={{ fontSize: 12, padding: "5px 10px", border: "1px solid #E5E7EB", borderRadius: 6, cursor: "pointer" }}
        >
          <option value="projectCount">Sort: Projects</option>
          <option value="fileCount">Sort: Files</option>
          <option value="userCount">Sort: Users</option>
          <option value="name">Sort: Name</option>
          <option value="createdAt">Sort: Newest</option>
        </select>
      </div>
      <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["Company", "Plan", "Status", "Projects", "Users", "Files", "Joined"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9CA3AF", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={c.id}
                onClick={() => onSelect(c)}
                style={{ cursor: "pointer", background: i % 2 === 0 ? "white" : "#FAFAFA" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#EFF6FF")}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "white" : "#FAFAFA")}
              >
                <td style={{ padding: "10px 14px", fontWeight: 600, fontSize: 13, borderBottom: "1px solid #F3F4F6" }}>{c.name}</td>
                <td style={{ padding: "10px 14px", fontSize: 12, borderBottom: "1px solid #F3F4F6" }}><Pill label={c.plan ?? "free"} color="#7C3AED" /></td>
                <td style={{ padding: "10px 14px", fontSize: 12, borderBottom: "1px solid #F3F4F6" }}><Pill label={c.status} color={STATUS_COLOR[c.status]} /></td>
                <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#2563EB", borderBottom: "1px solid #F3F4F6" }}>{c.projectCount}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, borderBottom: "1px solid #F3F4F6" }}>{c.userCount}</td>
                <td style={{ padding: "10px 14px", fontSize: 13, borderBottom: "1px solid #F3F4F6" }}>{c.fileCount.toLocaleString()}</td>
                <td style={{ padding: "10px 14px", fontSize: 11, color: "#9CA3AF", borderBottom: "1px solid #F3F4F6" }}>{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Layer 3: Active Projects Grid ────────────────────────────────────────── */

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
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#111", display: "flex", alignItems: "center", gap: 6 }}><Folder size={15} /> Active Projects Grid</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{projects.length} total projects · color-coded by health · click to inspect</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["all", "healthy", "watch", "high load", "archived"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, border: "1px solid #E5E7EB",
                background: filter === f ? "#1D4ED8" : "white", color: filter === f ? "white" : "#374151", cursor: "pointer",
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
        {filtered.map(p => {
          const health = getProjectHealth(p);
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              style={{
                border: `2px solid ${health.color}44`,
                borderLeft: `4px solid ${health.color}`,
                borderRadius: 10, padding: "14px 14px",
                background: `${health.color}08`,
                cursor: "pointer", textAlign: "left",
                transition: "box-shadow 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 0 0 3px ${health.color}28`)}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 800, color: health.color, background: `${health.color}18`, padding: "1px 7px", borderRadius: 4 }}>{p.code}</span>
                <Pill label={health.label} color={health.color} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#111", marginBottom: 6, lineHeight: 1.3 }}>{p.name}</div>
              {p.companyName && <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}><Building2 size={11} /> {p.companyName}</div>}
              <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#6B7280" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Users size={11} /> {p.memberCount}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 3 }}><FileText size={11} /> {p.fileCount.toLocaleString()}</span>
                {p.rfiCount !== undefined && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><MessageSquare size={11} /> {p.rfiCount}</span>}
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
      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF", fontSize: 13 }}>No projects match this filter</div>
      )}
    </div>
  );
}

/* ── Layer 4: Brain Daily Brief ───────────────────────────────────────────── */

function BrainBrief({ token }: { token: string }) {
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [loading, setLoading] = useState(false);
  const [shown, setShown] = useState(false);

  const load = async () => {
    if (shown) return;
    setLoading(true); setShown(true);
    try {
      const r = await apiFetch("/dashboard/briefing?platform=1", token);
      if (r.ok) setBrief(await r.json());
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      border: "1.5px solid #BFDBFE", borderRadius: 14,
      background: "linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #DBEAFE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#1D4ED8", display: "flex", alignItems: "center", gap: 6 }}><Brain size={15} /> Brain Daily Brief</div>
          <div style={{ fontSize: 12, color: "#3B82F6", marginTop: 2 }}>AI-powered platform intelligence snapshot</div>
        </div>
        {!shown && (
          <button
            onClick={load}
            style={{ padding: "8px 16px", background: "#2563EB", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
          >
            Generate Brief
          </button>
        )}
      </div>
      <div style={{ padding: "16px 20px" }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#2563EB", fontSize: 13 }}>
            <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
            Generating AI brief…
          </div>
        )}
        {!loading && !brief && !shown && (
          <div style={{ color: "#9CA3AF", fontSize: 13 }}>Click "Generate Brief" to get an AI-powered summary of platform activity, risks, and recommended actions.</div>
        )}
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
                <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
                  {brief.criticalItems.map((item, i) => (
                    <li key={i} style={{ fontSize: 13, color: "#374151", marginBottom: 5, lineHeight: 1.5 }}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {(brief.highlights ?? []).length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Highlights</div>
                <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
                  {(brief.highlights ?? []).map((item, i) => (
                    <li key={i} style={{ fontSize: 13, color: "#374151", marginBottom: 5, lineHeight: 1.5 }}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Drill-in Modals ──────────────────────────────────────────────────────── */

function UsersModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch("/admin/users", token).then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const filtered = users.filter(u =>
    !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal title={`Users (${users.length})`} onClose={onClose} wide>
      <input
        placeholder="Search by name or email…"
        value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", padding: "7px 12px", border: "1px solid #E5E7EB", borderRadius: 7, fontSize: 12, marginBottom: 14, boxSizing: "border-box" }}
      />
      {loading ? <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>Loading…</div> : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["Name", "Email", "Role", "Company", "Status", "Joined"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td style={{ padding: "9px 10px", fontSize: 12, fontWeight: 600, borderBottom: "1px solid #F3F4F6" }}>{u.fullName}</td>
                <td style={{ padding: "9px 10px", fontSize: 11, color: "#6B7280", borderBottom: "1px solid #F3F4F6" }}>{u.email}</td>
                <td style={{ padding: "9px 10px", borderBottom: "1px solid #F3F4F6" }}><Pill label={u.role} color="#2563EB" /></td>
                <td style={{ padding: "9px 10px", fontSize: 11, color: "#6B7280", borderBottom: "1px solid #F3F4F6" }}>{u.companyName ?? "—"}</td>
                <td style={{ padding: "9px 10px", borderBottom: "1px solid #F3F4F6" }}><Pill label={u.status} color={STATUS_COLOR[u.status]} /></td>
                <td style={{ padding: "9px 10px", fontSize: 11, color: "#9CA3AF", borderBottom: "1px solid #F3F4F6" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function EmailLogModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch("/admin/email-log", token).then(r => r.json()).then(setRows).catch(() => {}).finally(() => setLoading(false));
  }, [token]);
  return (
    <Modal title="Email Log" onClose={onClose} wide>
      {loading ? <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>Loading…</div> : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {["To", "Subject", "Status", "Sent At"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", borderBottom: "1px solid #E5E7EB" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ padding: "9px 10px", fontSize: 12, borderBottom: "1px solid #F3F4F6" }}>{r.to}</td>
                <td style={{ padding: "9px 10px", fontSize: 11, color: "#6B7280", borderBottom: "1px solid #F3F4F6" }}>{r.subject}</td>
                <td style={{ padding: "9px 10px", borderBottom: "1px solid #F3F4F6" }}><Pill label={r.status} color={STATUS_COLOR[r.status]} /></td>
                <td style={{ padding: "9px 10px", fontSize: 11, color: "#9CA3AF", borderBottom: "1px solid #F3F4F6" }}>{new Date(r.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function ActivityModal({ token, onClose }: { token: string; onClose: () => void }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiFetch("/admin/activity", token).then(r => r.json()).then(d => setRows(Array.isArray(d) ? d : d.activity ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [token]);
  return (
    <Modal title="Platform Activity Feed" onClose={onClose} wide>
      {loading ? <div style={{ padding: 20, textAlign: "center", color: "#9CA3AF" }}>Loading…</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map(r => (
            <div key={r.id} style={{ padding: "8px 12px", border: "1px solid #F3F4F6", borderRadius: 7, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span><strong>{r.userName ?? `User #${r.userId}`}</strong> · {r.action} {r.entity ? `(${r.entity})` : ""} {r.projectCode ? `@ ${r.projectCode}` : ""}</span>
                <span style={{ fontSize: 10, color: "#9CA3AF" }}>{new Date(r.createdAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function AssignUserModal({ projectId, companyCode, token, onClose, onDone }: { projectId: number; companyCode: string; token: string; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"new">("new");
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
    <Modal title={`Assign User — ${companyCode}`} onClose={onClose}>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>
        Create a new user for convention company <strong>{companyCode}</strong> in this project.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full Name" style={{ padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13 }} />
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" style={{ padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13 }} />
        <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company Name" style={{ padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 13 }} />
      </div>
      {error && <div style={{ color: "#DC2626", fontSize: 12, marginTop: 8 }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onClose} style={{ flex: 1, padding: "8px 0", border: "1px solid #D1D5DB", borderRadius: 6, background: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        <button onClick={handleSubmit} disabled={submitting} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 6, background: "#1D4ED8", color: "white", fontSize: 13, fontWeight: 700, cursor: submitting ? "wait" : "pointer" }}>
          {submitting ? "Assigning..." : "Assign User"}
        </button>
      </div>
    </Modal>
  );
}

function ProjectDetailModal({ project, token, onClose, onRefresh }: { project: Project; token: string; onClose: () => void; onRefresh?: () => void }) {
  const [, setLocation] = useLocation();
  const [archiving, setArchiving] = useState(false);
  const [assignCode, setAssignCode] = useState<string | null>(null);

  const handleArchive = async () => {
    if (!confirm(`Archive project "${project.name}" (${project.code})? This will hide it from the active projects grid.`)) return;
    setArchiving(true);
    try {
      const r = await apiFetch(`/admin/projects/${project.id}`, token, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (r?.ok) {
        onClose();
        onRefresh?.();
      } else {
        alert("Failed to archive project");
      }
    } catch { alert("Failed to archive project"); }
    setArchiving(false);
  };

  return (
    <Modal title={`${project.code} — ${project.name}`} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          ["Company", project.companyName ?? "—"],
          ["Status", project.status],
          ["Members", String(project.memberCount)],
          ["Files", project.fileCount.toLocaleString()],
          ["RFIs", String(project.rfiCount ?? "—")],
          ["Submittals", String(project.submittalCount ?? "—")],
          ["Created", new Date(project.createdAt).toLocaleDateString()],
        ].map(([k, v]) => (
          <div key={k} style={{ padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", marginBottom: 3 }}>{k}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{v}</div>
          </div>
        ))}
      </div>

      {(project.conventionCompanyCodes?.length ?? 0) > 0 && (
        <div style={{ marginBottom: 20, padding: 14, border: "1px solid #E5E7EB", borderRadius: 8, background: "#F9FAFB" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#6B7280", marginBottom: 10 }}>Company / User Assignment</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div style={{ padding: "8px 12px", background: "#EFF6FF", borderRadius: 6, border: "1px solid #BFDBFE" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#3B82F6" }}>Convention Companies</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#1D4ED8" }}>{project.conventionCompanyCodes!.length}</div>
            </div>
            <div style={{ padding: "8px 12px", background: "#F0FDF4", borderRadius: 6, border: "1px solid #BBF7D0" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#16A34A" }}>Participating (with users)</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#15803D" }}>{project.participatingCompanies?.length ?? 0}</div>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {project.conventionCompanyCodes!.map(code => {
              const isUnassigned = project.unassignedConventionCompanies?.includes(code);
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
        <button
          onClick={() => { onClose(); setLocation(`/projects/${project.id}/analytics`); }}
          style={{ flex: 1, padding: "10px 0", background: "#1D4ED8", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
        >
          Open Project
        </button>
        {project.status !== "archived" && (
          <button
            onClick={handleArchive}
            disabled={archiving}
            style={{ padding: "10px 16px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 8, cursor: archiving ? "wait" : "pointer", fontSize: 13, fontWeight: 700 }}
          >
            {archiving ? "..." : "Archive"}
          </button>
        )}
      </div>
      {assignCode && (
        <AssignUserModal
          projectId={project.id}
          companyCode={assignCode}
          token={token}
          onClose={() => setAssignCode(null)}
          onDone={() => { setAssignCode(null); onRefresh?.(); }}
        />
      )}
    </Modal>
  );
}

/* ── Fallback error screen ─────────────────────────────────────────────────── */

function TCErrorFallback({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ padding: 40, textAlign: "center", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
      <div>
        <h2 style={{ fontWeight: 800, fontSize: 18, marginBottom: 12, color: "#111" }}>Total Control — Loading Error</h2>
        <p style={{ color: "#6B7280", marginBottom: 20, fontSize: 14 }}>Something went wrong rendering this page.</p>
        <button onClick={onBack} style={{ padding: "10px 24px", background: "#1D4ED8", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 }}>
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

/* ── Main TotalControl Component ──────────────────────────────────────────── */

export function TotalControl() {
  const [, setLocation] = useLocation();
  const { token } = useAuthStore();

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [renderError, setRenderError] = useState(false);

  // Modal state
  const [showUsers, setShowUsers] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(false);
    try {
      try {
        const r = await apiFetch("/admin/platform-stats", token);
        if (r?.ok) {
          const d = await r.json();
          setStats(prev => ({ ...(prev ?? {}), ...(d ?? {}) } as PlatformStats));
        }
      } catch(e) { console.warn("platform-stats failed", e); }

      try {
        const r = await apiFetch("/admin/overview", token);
        if (r?.ok) {
          const d = await r.json();
          setStats((d?.stats ?? d) || null);
        }
      } catch(e) { console.warn("overview failed", e); }

      try {
        const r = await apiFetch("/admin/companies", token);
        if (r?.ok) {
          const d = await r.json();
          const raw: any[] = Array.isArray(d) ? d : [];
          setCompanies(raw.map(c => ({
            ...c,
            projectCount: Number(c.projectCount ?? 0),
            userCount:    Number(c.userCount    ?? 0),
            fileCount:    Number(c.fileCount    ?? 0),
            createdAt:    c.createdAt ?? new Date().toISOString(),
          })));
        }
      } catch(e) { console.warn("companies failed", e); }

      try {
        const r = await apiFetch("/admin/projects", token);
        if (r?.ok) {
          const d = await r.json();
          const raw: any[] = Array.isArray(d) ? d : Array.isArray(d?.projects) ? d.projects : [];
          setProjects(raw.map(p => ({
            ...p,
            memberCount:    Number(p.memberCount    ?? 0),
            fileCount:      Number(p.fileCount      ?? 0),
            rfiCount:       Number(p.rfiCount       ?? 0),
            submittalCount: Number(p.submittalCount ?? 0),
            createdAt:      p.createdAt ?? new Date().toISOString(),
          })));
        }
      } catch(e) { console.warn("projects failed", e); }

      try {
        const r = await apiFetch("/dashboard/stats", token);
        if (r?.ok) await r.json();
      } catch(e) { console.warn("dash-stats failed", e); }

      try {
        const r = await apiFetch("/dashboard/briefing", token);
        if (r?.ok) await r.json();
      } catch(e) { console.warn("briefing failed", e); }

    } catch(e) {
      console.warn("loadAll failed", e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    getMe()
      .then((data) => {
        const userData = data as any;
        const isAdmin = userData?.is_super_admin === true || userData?.isSuperAdmin === true;
        if (!isAdmin) { setLocation("/dashboard"); return; }
        setAuthorized(true);
        loadAll();
      })
      .catch(() => { setLocation("/dashboard"); });
  }, [token, loadAll]);

  const handleHealthBarExpand = (tab: string) => {
    try {
      if (tab === "users") setShowUsers(true);
    } catch(e) { console.warn("handleHealthBarExpand failed", e); }
  };

  // Safe stat accessor with 0 fallback
  const safeStats: PlatformStats = {
    totalUsers:      Number(stats?.totalUsers      ?? 0),
    totalCompanies:  Number(stats?.totalCompanies  ?? 0),
    totalProjects:   Number(stats?.totalProjects   ?? 0),
    totalFiles:      Number(stats?.totalFiles      ?? 0),
    totalRfis:       Number(stats?.totalRfis       ?? 0),
    totalSubmittals: Number(stats?.totalSubmittals ?? 0),
    activeProjects:  Number(stats?.activeProjects  ?? 0),
    filesLast24h:    Number(stats?.filesLast24h    ?? 0),
    rfisLast7d:      Number(stats?.rfisLast7d      ?? 0),
  };

  const safeCompanies: Company[] = Array.isArray(companies) ? companies : [];
  const safeProjects: Project[]  = Array.isArray(projects)  ? projects  : [];

  if (renderError) {
    return <TCErrorFallback onBack={() => setLocation("/dashboard")} />;
  }

  if (authorized === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
        <div style={{ textAlign: "center", color: "#9CA3AF" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}><Lock size={36} color="#9CA3AF" /></div>
          <div>Verifying access…</div>
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
          <p style={{ marginBottom: 16, fontSize: 13 }}>One or more data endpoints could not be reached.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => { setLoadError(false); loadAll(); }} style={{ padding: "8px 20px", borderRadius: 6, background: "#1D4ED8", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>Retry</button>
            <button onClick={() => setLocation("/dashboard")} style={{ padding: "8px 20px", borderRadius: 6, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB", cursor: "pointer", fontWeight: 600 }}>Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  try { return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Modals */}
      {showUsers && token && <UsersModal token={token} onClose={() => setShowUsers(false)} />}
      {showEmail && token && <EmailLogModal token={token} onClose={() => setShowEmail(false)} />}
      {showActivity && token && <ActivityModal token={token} onClose={() => setShowActivity(false)} />}
      {selectedProject && token && <ProjectDetailModal project={selectedProject} token={token} onClose={() => setSelectedProject(null)} onRefresh={loadAll} />}
      {selectedCompany && (
        <Modal title={`${selectedCompany?.name ?? "Company"} — Details`} onClose={() => setSelectedCompany(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              ["Plan",     selectedCompany?.plan ?? "free"],
              ["Status",   selectedCompany?.status ?? "—"],
              ["Projects", String(Number(selectedCompany?.projectCount ?? 0))],
              ["Users",    String(Number(selectedCompany?.userCount    ?? 0))],
              ["Files",    Number(selectedCompany?.fileCount ?? 0).toLocaleString()],
              ["Joined",   selectedCompany?.createdAt ? new Date(selectedCompany.createdAt).toLocaleDateString() : "—"],
            ].map(([k, v]) => (
              <div key={k} style={{ padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", marginBottom: 3 }}>{k ?? ""}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{v ?? "—"}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Page header */}
      <div style={{ background: "#111827", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 32, height: 32, background: "#2563EB", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "white" }}>TC</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "white", lineHeight: 1 }}>Total Control</div>
            <div style={{ fontSize: 10, color: "#6B7280", marginTop: 1 }}>Super Admin · IgniteSmart Platform</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowActivity(true)} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Activity Feed</button>
          <button onClick={() => setShowEmail(true)} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Email Log</button>
          <button onClick={() => setLocation("/dashboard")} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "rgba(255,255,255,0.7)", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>← Dashboard</button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{ height: 80, background: "#E5E7EB", borderRadius: 12, animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        ) : (
          <>
            {/* ── Layer 1: Platform Health Bar ─── */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", marginBottom: 10 }}>
                LAYER 1 · PLATFORM HEALTH · click any metric to drill in
              </div>
              <HealthBar stats={safeStats} onExpand={handleHealthBarExpand} />
            </div>

            {/* ── Layer 2: Company Performance ─── */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", marginBottom: 10 }}>
                LAYER 2 · COMPANY PERFORMANCE
              </div>
              <CompanyPanel companies={safeCompanies} onSelect={setSelectedCompany} />
            </div>

            {/* ── Layer 3: Active Projects Grid ─── */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", marginBottom: 10 }}>
                LAYER 3 · ACTIVE PROJECTS GRID
              </div>
              <ProjectsGrid projects={safeProjects} onSelect={setSelectedProject} />
            </div>

            {/* ── Layer 4: Brain Daily Brief ─── */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", marginBottom: 10 }}>
                LAYER 4 · BRAIN DAILY BRIEF
              </div>
              {token && <BrainBrief token={token} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
  } catch(e) {
    console.warn("TotalControl render error", e);
    return <TCErrorFallback onBack={() => setLocation("/dashboard")} />;
  }
}
