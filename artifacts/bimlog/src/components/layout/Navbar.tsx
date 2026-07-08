import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { Info, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useRef } from "react";
import { logClientError } from "@/lib/client-log";
import { getMe } from "@workspace/api-client-react";

export function Navbar() {
  const { t, tt } = useI18n();
  const INFO_LINKS = [
    { label: tt("How It Works", "Cómo Funciona"),       href: "/setup-guide" },
    { label: tt("Pricing", "Precios"),                  href: "/pricing" },
    { label: tt("Features", "Funcionalidades"),         href: "/features" },
    { label: tt("About", "Acerca de"),                  href: "/about" },
    { label: tt("Contact", "Contacto"),                 href: "/contact" },
    { label: tt("Privacy Policy", "Política de Privacidad"), href: "/privacy" },
    { label: tt("Terms of Service", "Términos del Servicio"), href: "/terms" },
    { label: tt("Platform Disclaimer", "Aviso Legal de la Plataforma"), href: "/disclaimer" },
    { label: tt("Data Retention", "Retención de Datos"), href: "/data-retention" },
  ];
  const { user, token, logout } = useAuthStore();
  const [location] = useLocation();
  const isLanding = location === "/";
  const isProjectPage = location.startsWith("/projects/");
  const isDashboard = location === "/dashboard";
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !token) { setAvatarUrl(null); setIsSuperAdmin(false); return; }
    getMe()
      .then(data => {
        if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
        if (data.isSuperAdmin) setIsSuperAdmin(true);
      })
      .catch((error) => logClientError("navbar user profile load", error));
    const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    fetch(`${BASE}/api/v1/users/me/company-profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then((cp: { logoUrl?: string | null } | null) => {
        if (cp?.logoUrl) setCompanyLogoUrl(cp.logoUrl);
      })
      .catch((error) => logClientError("navbar company profile load", error));
  }, [user?.id, token]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (infoRef.current && !infoRef.current.contains(e.target as Node)) setInfoOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (isProjectPage || isDashboard) return null;

  const infoDropdown = (
    <div ref={infoRef} style={{ position: "relative" }}>
      <button
        onClick={() => setInfoOpen(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 10px", borderRadius: 6,
          fontSize: 11, fontWeight: 600,
          color: "hsl(var(--muted-foreground))",
          background: "hsl(var(--secondary))",
          border: "1px solid hsl(var(--border))",
          cursor: "pointer",
        }}
      >
        <Info style={{ width: 13, height: 13 }} />
        {tt("Information", "Información")}
        <ChevronDown style={{ width: 11, height: 11, transform: infoOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>
      {infoOpen && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 1000,
          background: "hsl(var(--background))", border: "1px solid hsl(var(--border))",
          borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          minWidth: 200, overflow: "hidden",
        }}>
          {INFO_LINKS.map(link => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setInfoOpen(false)}
              style={{
                display: "block", padding: "10px 16px", fontSize: 13, color: "hsl(var(--foreground))",
                textDecoration: "none", transition: "background 0.1s",
                borderBottom: "1px solid hsl(var(--border))",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--secondary))")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <header className="topbar">
      <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
        <div className="sidebar-logo-mark" style={{ width: 28, height: 28, fontSize: 12 }}>B</div>
        <div className="flex items-baseline gap-1.5">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "hsl(var(--foreground))" }}>BIMLog</span>
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>by IgniteSmart</span>
        </div>
      </Link>

      <div className="flex items-center gap-2 ml-auto" style={{ marginRight: 56 }}>
        {infoDropdown}

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
                    width: 26, height: 26, borderRadius: 4, flexShrink: 0,
                    background: `url(${companyLogoUrl}) center/contain no-repeat #fff`,
                    border: "1px solid hsl(var(--border))",
                  }}
                />
              )}
              <div
                style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: avatarUrl
                    ? `url(${avatarUrl}) center/cover no-repeat`
                    : "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/0.7))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "white",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                {!avatarUrl && (user.fullName?.charAt(0).toUpperCase() ?? "?")}
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>{tt("Profile", "Perfil")}</span>
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
