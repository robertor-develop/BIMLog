import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { getMe } from "@workspace/api-client-react";

export function MasterSidebar() {
  const { user, token, logout } = useAuthStore();
  const [, setLocation] = useLocation();
  const [showAdmin, setShowAdmin] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");

  useEffect(() => {
    if (!token) return;
    getMe()
      .then((data) => {
        if (data.isSuperAdmin === true) setShowAdmin(true);
        if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
        if (data.companyName) setCompanyName(data.companyName);
      })
      .catch(() => {});
  }, [user?.id, token]);

  return (
    <div className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">B</div>
        <div>
          <div className="sidebar-logo-name">BIMLog</div>
          <div className="sidebar-logo-by">by IgniteSmart</div>
        </div>
      </div>

      {/* Middle nav — spacer */}
      <div className="sidebar-nav" style={{ flex: 1 }} />

      {/* Bottom section */}
      {user && (
        <div style={{ padding: "0 0 8px" }}>

          {/* Admin links — right above the divider/profile */}
          {showAdmin && (
            <div style={{ padding: "0 14px 8px" }}>
              <button
                className="sidebar-nav-item"
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                onClick={() => setLocation("/admin")}
              >
                <div className="nav-dot" />
                Admin Panel
              </button>
              <button
                className="sidebar-nav-item"
                style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                onClick={() => setLocation("/admin")}
              >
                <div className="nav-dot" />
                Total Control
              </button>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: "var(--sidebar-border)", margin: "0 14px 10px" }} />

          {/* Avatar + name + company + profile link */}
          <a
            href="#"
            className="sidebar-footer"
            style={{ textDecoration: "none", cursor: "pointer" }}
            title="My Profile"
            onClick={e => { e.preventDefault(); setLocation("/profile"); }}
          >
            <div
              className="avatar avatar-sm av-blue"
              style={avatarUrl ? {
                backgroundImage: `url(${avatarUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              } : {}}
            >
              {!avatarUrl && (user.fullName?.charAt(0).toUpperCase() ?? "?")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.fullName}
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>
                {companyName || user.companyName || ""}
              </div>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", flexShrink: 0 }}>Profile →</div>
          </a>

          {/* Sign out */}
          <button
            onClick={logout}
            style={{
              display: "block", width: "calc(100% - 28px)", margin: "6px 14px 0",
              padding: "5px 0", borderRadius: 5, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 500,
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
