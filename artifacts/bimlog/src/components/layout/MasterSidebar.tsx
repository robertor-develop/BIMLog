import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { LayoutDashboard, FolderOpen, User, ShieldAlert } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

const NAV_ITEMS = [
  { label: "Dashboard",  href: "/dashboard",  icon: LayoutDashboard },
  { label: "Projects",   href: "/dashboard",  icon: FolderOpen,      scrollTo: "projects" },
  { label: "Profile",    href: "/profile",    icon: User },
];

export function MasterSidebar() {
  const { user, token, logout } = useAuthStore();
  const [location] = useLocation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companyName, setCompanyName] = useState<string>("");

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
        <span className="sidebar-section-label">Navigation</span>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = location === item.href && !item.scrollTo;
          return (
            <a
              key={item.label}
              href={item.href}
              onClick={e => {
                if (item.scrollTo) {
                  e.preventDefault();
                  const el = document.getElementById(item.scrollTo);
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }
              }}
              className={`sidebar-nav-item${isActive ? " active" : ""}`}
            >
              <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
              {item.label}
            </a>
          );
        })}
        {isSuperAdmin && (
          <Link
            href="/admin"
            className={`sidebar-nav-item${location === "/admin" ? " active" : ""}`}
          >
            <ShieldAlert style={{ width: 14, height: 14, flexShrink: 0, color: "#ef4444" }} />
            <span style={{ color: location === "/admin" ? undefined : "#ef4444" }}>Admin</span>
          </Link>
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
