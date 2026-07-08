import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/layout/LangToggle";
import { SmartGuideSidebarButton } from "@/components/layout/SmartGuide";
import { logClientError } from "@/lib/client-log";
import { getMe } from "@workspace/api-client-react";
import { Bell, Search, X, Building2 } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

interface Notification {
  id: number; type: string; title: string; message: string;
  isRead: boolean; actionUrl?: string; createdAt: string;
}

interface SearchResults {
  files: Array<{ id: number; projectId: number; name: string; status?: string; type: string }>;
  rfis: Array<{ id: number; projectId: number; label: string; type: string }>;
  submittals: Array<{ id: number; projectId: number; label: string; type: string }>;
  transmittals: Array<{ id: number; projectId: number; label: string; type: string }>;
  change_orders: Array<{ id: number; projectId: number; label: string; type: string }>;
  meetings: Array<{ id: number; projectId: number; name: string; type: string }>;
  action_items: Array<{ id: number; projectId: number; name: string; type: string }>;
  people: Array<{ id: number; name: string; email: string; type: string }>;
}

export function MasterSidebar() {
  const { user, token, logout } = useAuthStore();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const t = (en: string, es: string) => lang === "es" ? es : en;

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTotalControl, setShowTotalControl] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showBell, setShowBell] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    getMe()
      .then((data) => {
        const d = data as typeof data & { isSuperAdmin?: boolean; avatarUrl?: string; companyName?: string };
        if (d.isSuperAdmin === true) { setShowAdminPanel(true); setShowTotalControl(true); }
        if (d.avatarUrl) setAvatarUrl(d.avatarUrl);
        if (d.companyName) setCompanyName(d.companyName);
      })
      .catch((error) => logClientError("master sidebar user profile load", error));
    fetch(`${API_BASE}/api/v1/users/me/company-profile`, { headers })
      .then(r => r.ok ? r.json() : null)
      .then((cp: { logoUrl?: string | null; companyName?: string | null } | null) => {
        if (cp?.logoUrl) setCompanyLogoUrl(cp.logoUrl);
        if (cp?.companyName) setCompanyName(prev => prev || cp.companyName!);
      })
      .catch((error) => logClientError("master sidebar company profile load", error));
    fetch(`${API_BASE}/api/v1/projects`, { headers })
      .then(r => r.json())
      .then((projects: Array<{ userRole?: string }>) => {
        if (Array.isArray(projects) && projects.some(p => p.userRole === "project_admin")) {
          setShowAdminPanel(true);
        }
      })
      .catch((error) => logClientError("master sidebar projects load", error));
    loadNotifications();
  }, [user?.id, token]);

  const loadNotifications = async () => {
    if (!token) return;
    setLoadingNotifs(true);
    try {
      const r = await fetch(`${API_BASE}/api/v1/notifications`, { headers });
      if (!r.ok) { console.error("Notifications fetch failed", r.status); return; }
      setNotifications(await r.json());
    } finally { setLoadingNotifs(false); }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markRead = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/v1/notifications/${id}/read`, { method: "PATCH", headers });
    } catch(e) { console.error("Notification action failed", e); }
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllRead = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/notifications/read-all`, { method: "PATCH", headers });
    } catch(e) { console.error("Notification action failed", e); }
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const deleteNotif = async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/v1/notifications/${id}`, { method: "DELETE", headers });
    } catch(e) { console.error("Notification action failed", e); }
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowBell(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!searchQ || searchQ.length < 2) { setSearchResults(null); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const r = await fetch(`${API_BASE}/api/v1/search?q=${encodeURIComponent(searchQ)}`, { headers });
        if (!r.ok) { setSearchResults(null); return; }
        setSearchResults(await r.json());
      } finally { setSearchLoading(false); }
    }, 300);
  }, [searchQ]);

  const typeRoutes: Record<string, (item: { id: number; projectId: number }) => string> = {
    file: (i) => `/projects/${i.projectId}/files`,
    rfi: (i) => `/projects/${i.projectId}/rfis`,
    submittal: (i) => `/projects/${i.projectId}/submittals`,
    transmittal: (i) => `/projects/${i.projectId}/transmittals`,
    change_order: (i) => `/projects/${i.projectId}/change-orders`,
    meeting: (i) => `/projects/${i.projectId}/meetings`,
    action_item: (i) => `/projects/${i.projectId}/meetings`,
  };

  const allSearchResults: Array<{ id: number; projectId?: number; label: string; type: string }> = searchResults ? [
    ...searchResults.files.map(i => ({ ...i, label: i.name })),
    ...searchResults.rfis,
    ...searchResults.submittals,
    ...searchResults.transmittals,
    ...searchResults.change_orders,
    ...searchResults.meetings.map(i => ({ ...i, label: i.name })),
    ...searchResults.action_items.map(i => ({ ...i, label: i.name })),
    ...searchResults.people.map(i => ({ ...i, projectId: 0, label: `${i.name} (${i.email})` })),
  ] : [];

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">B</div>
        <div>
          <div className="sidebar-logo-name">BIMLog</div>
          <div className="sidebar-logo-by">by IgniteSmart</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 10px 10px" }}>
        <LangToggle />
        <SmartGuideSidebarButton activeTab="dashboard" />
      </div>

      <div ref={searchRef} style={{ position: "relative", padding: "0 10px 10px" }}>
        <button onClick={() => { setShowSearch(!showSearch); setSearchQ(""); setSearchResults(null); }} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, padding: "6px 10px", color: "rgba(255,255,255,0.75)", cursor: "pointer", fontSize: 11 }}>
          <Search style={{ width: 13, height: 13 }} />
          {t("Search everything…", "Buscar todo…")}
        </button>

        {showSearch && (
          <div style={{ position: "absolute", left: 10, top: "calc(100% - 4px)", width: "280px", zIndex: 9999, background: "white", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", border: "1px solid #E5E7EB", overflow: "hidden" }}>
            <div style={{ padding: "10px 12px", borderBottom: "1px solid #F3F4F6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Search style={{ width: 14, height: 14, color: "#6B7280", flexShrink: 0 }} />
                <input autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder={t("Type to search…", "Escribe para buscar…")} style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#111" }} />
                {searchQ && (
                  <button onClick={() => { setSearchQ(""); setSearchResults(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", padding: 2 }}>
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                )}
              </div>
            </div>
            {searchLoading && (
              <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#6B7280" }}>{t("Searching…", "Buscando…")}</div>
            )}
            {!searchLoading && searchQ.length >= 2 && allSearchResults.length === 0 && (
              <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>{t("No results found", "Sin resultados")}</div>
            )}
            {!searchLoading && allSearchResults.length > 0 && (
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {allSearchResults.map((item, idx) => (
                  <button key={`${item.type}-${item.id}-${idx}`} onClick={() => { if (item.type !== "person" && item.projectId) { const route = typeRoutes[item.type]?.({ id: item.id, projectId: item.projectId }); if (route) setLocation(route); } setShowSearch(false); }} style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", padding: "8px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #F9FAFB" }} onMouseEnter={e => (e.currentTarget.style.background = "#F9FAFB")} onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", color: "#6B7280", paddingTop: 2, minWidth: 60 }}>{item.type.replace(/_/g, " ")}</span>
                    <span style={{ fontSize: 12, color: "#111", lineHeight: 1.4 }}>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-nav" style={{ flex: 1 }} />

      {user && (
        <div style={{ padding: "0 0 8px" }}>

          <div ref={bellRef} style={{ position: "relative", padding: "0 14px 10px" }}>
            <button onClick={() => { setShowBell(!showBell); if (!showBell) loadNotifications(); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 7, padding: "7px 10px", cursor: "pointer", color: "rgba(255,255,255,0.95)", fontSize: 12 }}>
              <Bell style={{ width: 14, height: 14 }} />
              <span style={{ flex: 1, textAlign: "left" }}>{t("Notifications", "Notificaciones")}</span>
              {unreadCount > 0 && (
                <span style={{ background: "#DC2626", color: "white", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>

            {showBell && (
              <div style={{ position: "absolute", bottom: "calc(100% + 4px)", left: 14, width: 300, zIndex: 9999, background: "white", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.2)", border: "1px solid #E5E7EB", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #F3F4F6" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#111" }}>{t("Notifications", "Notificaciones")}</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} style={{ background: "none", border: "none", fontSize: 11, color: "#2563EB", cursor: "pointer", fontWeight: 600 }}>
                      {t("Mark all read", "Marcar todo leído")}
                    </button>
                  )}
                </div>
                {loadingNotifs && (
                  <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: "#6B7280" }}>{t("Loading…", "Cargando…")}</div>
                )}
                {!loadingNotifs && notifications.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>
                    <div style={{ marginBottom: 6, display: "flex", justifyContent: "center" }}><Bell style={{ width: 28, height: 28, color: "#9CA3AF" }} /></div>
                    {t("No notifications", "Sin notificaciones")}
                  </div>
                )}
                <div style={{ maxHeight: 320, overflowY: "auto" }}>
                  {notifications.map(n => (
                    <div key={n.id} style={{ padding: "10px 14px", borderBottom: "1px solid #F9FAFB", background: n.isRead ? "white" : "#EFF6FF", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, cursor: "pointer" }} onClick={() => { markRead(n.id); if (n.actionUrl) setLocation(n.actionUrl); setShowBell(false); }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 2 }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.4 }}>{n.message}</div>
                        <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>{new Date(n.createdAt).toLocaleDateString()}</div>
                      </div>
                      <button onClick={() => deleteNotif(n.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", padding: 2, flexShrink: 0 }}>
                        <X style={{ width: 12, height: 12 }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "0 14px 4px" }}>
            <button className="sidebar-nav-item" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }} onClick={() => setLocation("/settings/company-profile")}>
              <Building2 style={{ width: 14, height: 14, flexShrink: 0 }} />
              {t("Company Profile", "Perfil de Empresa")}
            </button>
          </div>

          {(showAdminPanel || showTotalControl) && (
            <div style={{ padding: "0 14px 8px" }}>
              {showAdminPanel && (
                <button className="sidebar-nav-item" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }} onClick={() => setLocation("/admin")}>
                  <div className="nav-dot" />
                  {t("Admin Panel", "Panel de Administración")}
                </button>
              )}
              {showTotalControl && (
                <button className="sidebar-nav-item" style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left" }} onClick={() => setLocation("/total-control")}>
                  <div className="nav-dot" />
                  {t("Total Control", "Control Total")}
                </button>
              )}
            </div>
          )}

          <div style={{ height: 1, background: "var(--sidebar-border)", margin: "0 14px 10px" }} />

          <a href="#" className="sidebar-footer" style={{ textDecoration: "none", cursor: "pointer" }} title="My Profile" onClick={e => { e.preventDefault(); setLocation("/profile"); }}>
            <div className="avatar avatar-sm av-blue" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>
              {!avatarUrl && (user.fullName?.charAt(0).toUpperCase() ?? "?")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.fullName}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
                {companyLogoUrl && (
                  <span aria-hidden style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, background: `url(${companyLogoUrl}) center/contain no-repeat #fff`, flexShrink: 0 }} />
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{companyName || user.companyName || ""}</span>
              </div>
            </div>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", flexShrink: 0 }}>{t("Profile →", "Perfil →")}</div>
          </a>

          <button onClick={logout} style={{ display: "block", width: "calc(100% - 28px)", margin: "6px 14px 0", padding: "5px 0", borderRadius: 5, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: 500 }}>
            {t("Sign Out", "Cerrar Sesión")}
          </button>
          <button onClick={() => { localStorage.removeItem("bimlog-auth"); logout(); window.location.href = "/"; }} style={{ display: "block", width: "calc(100% - 28px)", margin: "4px 14px 0", padding: "3px 0", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.7)", fontSize: 10, textAlign: "center", textDecoration: "underline", textUnderlineOffset: 2 }}>
            {t("Clear session & sign in again", "Limpiar sesión e iniciar sesión")}
          </button>
        </div>
      )}
    </div>
  );
}
