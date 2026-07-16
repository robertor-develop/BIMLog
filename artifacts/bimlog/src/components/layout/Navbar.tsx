import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { getMe } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { logClientError } from "@/lib/client-log";
import { useAuthStore } from "@/store/auth";

export function Navbar() {
  const { t, tt } = useI18n();
  const { user, token, logout } = useAuthStore();
  const [location] = useLocation();
  const isLanding = location === "/";
  const isDashboard = location === "/dashboard";
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);

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
      <style>{`@media (max-width:520px){.app-topbar{padding-left:10px;padding-right:10px;gap:6px}.app-topbar-actions{margin-right:0!important;gap:2px}.app-topbar-byline,.app-topbar-profile-label{display:none}.app-topbar-actions button{padding-left:7px;padding-right:7px}}`}</style>
      <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
        <div className="sidebar-logo-mark" style={{ width: 28, height: 28, fontSize: 12 }}>B</div>
        <div className="flex items-baseline gap-1.5">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "hsl(var(--foreground))" }}>BIMLog</span>
          <span className="app-topbar-byline" style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>by IgniteSmart</span>
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
