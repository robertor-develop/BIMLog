import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { FolderOpen, MessageSquare, BarChart2, ShieldAlert, Settings } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

function getLastProjectId(): string | null {
  try { return localStorage.getItem("bimlog-last-project-id"); } catch { return null; }
}

const COMING_SOON_STYLE: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: "#F59E0B",
  background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)",
  borderRadius: 3, padding: "1px 5px", marginLeft: "auto",
};

export function MasterSidebar() {
  const { user, token, logout } = useAuthStore();
  const [location] = useLocation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companyName, setCompanyName] = useState<string>("");
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);

  useEffect(() => {
    setLastProjectId(getLastProjectId());
  }, []);

  useEffect(() => {
    if (!user || !token) { setAvatarUrl(null); setIsSuperAdmin(false); setCompanyName(""); return; }
    fetch(`${API_BASE}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.avatarUrl) setAvatarUrl(data.avatarUrl);
        if (data?.isSuperAdmin) setIsSuperAdmin(true);
        if (data?.companyName) setCompanyName(data.companyName);
      })
      .catch(() => {});
  }, [user?.id, token]);

  const initial = user?.fullName?.charAt(0).toUpperCase() ?? "?";

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 9px", borderRadius: 6,
    fontSize: 12, fontWeight: 500, cursor: "pointer",
    marginBottom: 1, textDecoration: "none",
    color: active ? "#fff" : "rgba(255,255,255,0.5)",
    background: active ? "rgba(37,99,235,0.28)" : "transparent",
    transition: "all 0.12s ease",
  });

  function navHover(e: React.MouseEvent<HTMLAnchorElement>, active: boolean) {
    if (!active) {
      e.currentTarget.style.color = "rgba(255,255,255,0.88)";
      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
    }
  }
  function navLeave(e: React.MouseEvent<HTMLAnchorElement>, active: boolean) {
    if (!active) {
      e.currentTarget.style.color = "rgba(255,255,255,0.5)";
      e.currentTarget.style.background = "transparent";
    }
  }

  const filesHref = lastProjectId ? `/projects/${lastProjectId}/files` : "/dashboard";
  const rfisHref  = lastProjectId ? `/projects/${lastProjectId}/rfis`  : "/dashboard";
  const filesActive = location === `/projects/${lastProjectId}/files`;
  const rfisActive  = location === `/projects/${lastProjectId}/rfis`;

  return (
    <div className="sidebar" style={{ height: "100vh", position: "sticky", top: 0 }}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">B</div>
        <div>
          <div className="sidebar-logo-name">BIMLog</div>
          <div className="sidebar-logo-by">by IgniteSmart</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Workspace</span>

        <a
          href={filesHref}
          style={navItemStyle(filesActive)}
          onMouseEnter={e => navHover(e, filesActive)}
          onMouseLeave={e => navLeave(e, filesActive)}
        >
          <FolderOpen style={{ width: 14, height: 14, flexShrink: 0 }} />
          Files
        </a>

        <a
          href={rfisHref}
          style={navItemStyle(rfisActive)}
          onMouseEnter={e => navHover(e, rfisActive)}
          onMouseLeave={e => navLeave(e, rfisActive)}
        >
          <MessageSquare style={{ width: 14, height: 14, flexShrink: 0 }} />
          RFIs
        </a>

        <a
          href="/dashboard"
          title="Reporting module coming soon"
          style={{ ...navItemStyle(false), cursor: "default" }}
          onClick={e => e.preventDefault()}
        >
          <BarChart2 style={{ width: 14, height: 14, flexShrink: 0 }} />
          Reports
          <span style={COMING_SOON_STYLE}>Soon</span>
        </a>

        {isSuperAdmin && (
          <>
            <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 9px" }} />
            <span className="sidebar-section-label">Admin</span>

            <a
              href="/admin"
              style={navItemStyle(location === "/admin")}
              onMouseEnter={e => navHover(e, location === "/admin")}
              onMouseLeave={e => navLeave(e, location === "/admin")}
            >
              <ShieldAlert style={{ width: 14, height: 14, flexShrink: 0, color: location === "/admin" ? undefined : "#ef4444" }} />
              <span style={{ color: location === "/admin" ? undefined : "#ef4444" }}>Admin Panel</span>
            </a>

            <a
              href="/admin"
              style={navItemStyle(false)}
              onMouseEnter={e => navHover(e, false)}
              onMouseLeave={e => navLeave(e, false)}
            >
              <Settings style={{ width: 14, height: 14, flexShrink: 0, color: "#a78bfa" }} />
              <span style={{ color: "#a78bfa" }}>Total Control</span>
            </a>
          </>
        )}
      </nav>

      {/* Footer / user */}
      <div className="sidebar-footer" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
        <Link href="/profile" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 9 }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: avatarUrl
                ? `url(${avatarUrl}) center/cover no-repeat`
                : "linear-gradient(135deg, #2563EB, #1D4ED8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "white",
            }}
          >
            {!avatarUrl && initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.fullName || "User"}
            </div>
            {companyName && (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {companyName}
              </div>
            )}
          </div>
        </Link>
        <button
          onClick={logout}
          style={{
            width: "100%", padding: "5px 0", borderRadius: 5,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)",
            color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 500, cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
