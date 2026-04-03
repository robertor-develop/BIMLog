import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { getMe } from "@workspace/api-client-react";

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
interface Project { id: number; code: string; name: string; status: string; companyName?: string; memberCount: number; fileCount: number; rfiCount?: number; submittalCount?: number; createdAt: string; }
interface UserRow { id: number; fullName: string; email: string; role: string; status: string; companyName?: string; lastLoginAt?: string; createdAt: string; }
interface EmailLogRow { id: number; to: string; subject: string; status: string; createdAt: string; errorMessage?: string; }
interface ActivityRow { id: number; userId?: number; userName?: string; projectId?: number; projectCode?: string; action: string; entity?: string; entityId?: number; createdAt: string; }
interface BriefData { summary: string; criticalItems: string[]; todaysDate: string; highlights?: string[]; }

/* ── Layer 1: Platform Health Bar ─────────────────────────────────────────── */

function HealthBar({ stats, onExpand }: { stats: PlatformStats; onExpand: (tab: string) => void }) {
  const items = [
    { key: "totalUsers",     label: "Users",          value: stats.totalUsers,     tab: "users",    color: "#2563EB", icon: "👤" },
    { key: "totalCompanies", label: "Companies",      value: stats.totalCompanies, tab: "companies",color: "#7C3AED", icon: "🏢" },
    { key: "totalProjects",  label: "Projects",       value: stats.totalProjects,  tab: "projects", color: "#0891B2", icon: "📁" },
    { key: "activeProjects", label: "Active",         value: stats.activeProjects, tab: "projects", color: "#16A34A", icon: "🟢" },
    { key: "totalFiles",     label: "Files",          value: stats.totalFiles,     tab: "projects", color: "#D97706", icon: "📄" },
    { key: "filesLast24h",   label: "Files 24h",      value: stats.filesLast24h,   tab: "projects", color: "#EA580C", icon: "⚡" },
    { key: "totalRfis",      label: "RFIs",           value: stats.totalRfis,      tab: "projects", color: "#DC2626", icon: "💬" },
    { key: "totalSubmittals",label: "Submittals",     value: stats.totalSubmittals,tab: "projects", color: "#9333EA", icon: "📋" },
    { key: "rfisLast7d",     label: "RFIs (7d)",      value: stats.rfisLast7d,     tab: "projects", color: "#DB2777", icon: "📈" },
  ];

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
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
          <div style={{ fontWeight: 800, fontSize: 15, color: "#111" }}>🏢 Company Performance</div>
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
          <div style={{ fontWeight: 800, fontSize: 15, color: "#111" }}>📁 Active Projects Grid</div>
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
              {p.companyName && <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>🏢 {p.companyName}</div>}
              <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#6B7280" }}>
                <span>👥 {p.memberCount}</span>
                <span>📄 {p.fileCount.toLocaleString()}</span>
                {p.rfiCount !== undefined && <span>💬 {p.rfiCount}</span>}
              </div>
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
          <div style={{ fontWeight: 800, fontSize: 15, color: "#1D4ED8" }}>🧠 Brain Daily Brief</div>
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
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</span>
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
    apiFetch("/admin/users", token).then(r => r.json()).then(setUsers).catch(() => {}).finally(() => setLoading(false));
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

function ProjectDetailModal({ project, token, onClose }: { project: Project; token: string; onClose: () => void }) {
  const [, setLocation] = useLocation();
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
      <button
        onClick={() => { onClose(); setLocation(`/projects/${project.id}/analytics`); }}
        style={{ width: "100%", padding: "10px 0", background: "#1D4ED8", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}
      >
        Open Project →
      </button>
    </Modal>
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

  // Modal state
  const [showUsers, setShowUsers] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

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
  }, [token]);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [overviewRes, companiesRes, projectsRes] = await Promise.all([
        apiFetch("/admin/overview", token),
        apiFetch("/admin/companies", token),
        apiFetch("/admin/projects", token),
      ]);
      if (overviewRes.ok) {
        const d = await overviewRes.json();
        setStats(d.stats ?? d);
      }
      if (companiesRes.ok) setCompanies(await companiesRes.json());
      if (projectsRes.ok) {
        const d = await projectsRes.json();
        setProjects(Array.isArray(d) ? d : d.projects ?? []);
      }
    } catch {
      setLoadError(true);
    } finally { setLoading(false); }
  }, [token]);

  const handleHealthBarExpand = (tab: string) => {
    if (tab === "users") setShowUsers(true);
    else if (tab === "companies") { /* already visible in Layer 2 */ }
    else if (tab === "projects") { /* already visible in Layer 3 */ }
  };

  if (authorized === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
        <div style={{ textAlign: "center", color: "#9CA3AF" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔐</div>
          <div>Verifying access…</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F9FAFB" }}>
        <div style={{ textAlign: "center", color: "#6B7280" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Unable to load admin dashboard.</div>
          <div>Please refresh.</div>
          <button onClick={() => { setLoadError(false); loadAll(); }} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 6, background: "#1D4ED8", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Modals */}
      {showUsers && token && <UsersModal token={token} onClose={() => setShowUsers(false)} />}
      {showEmail && token && <EmailLogModal token={token} onClose={() => setShowEmail(false)} />}
      {showActivity && token && <ActivityModal token={token} onClose={() => setShowActivity(false)} />}
      {selectedProject && token && <ProjectDetailModal project={selectedProject} token={token} onClose={() => setSelectedProject(null)} />}
      {selectedCompany && (
        <Modal title={`${selectedCompany.name} — Details`} onClose={() => setSelectedCompany(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Plan", selectedCompany.plan ?? "free"], ["Status", selectedCompany.status], ["Projects", String(selectedCompany.projectCount)], ["Users", String(selectedCompany.userCount)], ["Files", selectedCompany.fileCount.toLocaleString()], ["Joined", new Date(selectedCompany.createdAt).toLocaleDateString()]].map(([k, v]) => (
              <div key={k} style={{ padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>{v}</div>
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
              {stats && <HealthBar stats={stats} onExpand={handleHealthBarExpand} />}
            </div>

            {/* ── Layer 2: Company Performance ─── */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", marginBottom: 10 }}>
                LAYER 2 · COMPANY PERFORMANCE
              </div>
              <CompanyPanel companies={companies} onSelect={setSelectedCompany} />
            </div>

            {/* ── Layer 3: Active Projects Grid ─── */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9CA3AF", marginBottom: 10 }}>
                LAYER 3 · ACTIVE PROJECTS GRID
              </div>
              <ProjectsGrid projects={projects} onSelect={setSelectedProject} />
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
}
