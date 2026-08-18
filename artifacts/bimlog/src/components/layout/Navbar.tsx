import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { getMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { logClientError } from "@/lib/client-log";
import { useAuthStore } from "@/store/auth";
import { Moon, Sun } from "lucide-react";

export const BIMLOG_RELEASE_VERSION = "v1.60.35.09-F";

export function Navbar() {
  const { t, tt } = useI18n();
  const { user, token, logout } = useAuthStore();
  const [location] = useLocation();
  const isLanding = location === "/";
  const isDashboard = location === "/dashboard";
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("bimlog-theme");
    const dark = saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    setDarkMode(dark);
  }, []);

  function toggleTheme() {
    const dark = !darkMode;
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("bimlog-theme", dark ? "dark" : "light");
    setDarkMode(dark);
  }

  useEffect(() => {
    if (!user || !token) {
      setAvatarUrl(null);
      setCompanyLogoUrl(null);
      return;
    }

    getMe()
      .then((data) => {
        if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
      })
      .catch((error) => logClientError("navbar user profile load", error));

    const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    fetch(`${BASE}/api/v1/users/me/company-profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((cp: { logoUrl?: string | null } | null) => {
        if (cp?.logoUrl) setCompanyLogoUrl(cp.logoUrl);
      })
      .catch((error) => logClientError("navbar company profile load", error));
  }, [user?.id, token]);

  return (
    <header className="topbar app-topbar">
      <style>{`@media (max-width:520px){.app-topbar{padding-left:10px;padding-right:10px;gap:6px}.app-topbar-actions{margin-right:0!important;gap:2px}.app-topbar-byline,.app-topbar-profile-label,.app-topbar-version{display:none}.app-topbar-actions button{padding-left:7px;padding-right:7px}}@media print{.app-topbar,.sidebar,.feedback-widget,[data-print-hidden="true"]{display:none!important}body{background:#fff!important;color:#111!important}.main-area,.financial-page-content{margin:0!important;padding:0!important;max-width:none!important}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}`}</style>
      <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
        <div className="sidebar-logo-mark" style={{ width: 28, height: 28, fontSize: 12 }}>B</div>
        <div style={{display:"grid",lineHeight:1.05}}>
          <div className="flex items-baseline gap-1.5"><span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "hsl(var(--foreground))" }}>BIMLog</span><span className="app-topbar-byline" style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>by IgniteSmart</span></div>
          <span className="app-topbar-version" style={{fontSize:8,color:"hsl(var(--muted-foreground))",letterSpacing:'.04em',marginTop:4,lineHeight:1}}>{BIMLOG_RELEASE_VERSION}</span>
        </div>
      </Link>

      <div className="app-topbar-actions flex items-center gap-2 ml-auto" style={{ marginRight: 56 }}>
        {user ? (
          <>
            {!isDashboard && (
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" style={{ fontSize: 12 }}>{t("nav.dashboard")}</Button>
              </Link>
            )}

            <Link href="/profile" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              {companyLogoUrl && (
                <div
                  title="Company logo"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 4,
                    flexShrink: 0,
                    background: `url(${companyLogoUrl}) center/contain no-repeat #fff`,
                    border: "1px solid hsl(var(--border))",
                  }}
                />
              )}
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: avatarUrl
                    ? `url(${avatarUrl}) center/cover no-repeat`
                    : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.7))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "white",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                {!avatarUrl && (user.fullName?.charAt(0).toUpperCase() ?? "?")}
              </div>
              <span className="app-topbar-profile-label" style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>{tt("Profile", "Perfil")}</span>
            </Link>

            <Button variant="ghost" size="sm" onClick={logout} style={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}>
              {t("nav.logout")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={darkMode ? tt("Use light mode", "Usar modo claro") : tt("Use dark mode", "Usar modo oscuro")}
              title={darkMode ? tt("Light mode", "Modo claro") : tt("Dark mode", "Modo oscuro")}
              style={{ width: 32, height: 32, color: "hsl(var(--muted-foreground))" }}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          </>
        ) : isLanding ? (
          <>
            <Link href="/login"><Button variant="ghost" size="sm">{t("auth.login")}</Button></Link>
            <Link href="/register"><Button size="sm">{t("auth.register")}</Button></Link>
          </>
        ) : null}
      </div>
    </header>
  );
}
