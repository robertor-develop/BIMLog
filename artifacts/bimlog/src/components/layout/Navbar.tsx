import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { Globe, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { t, language, setLanguage } = useI18n();
  const { user, logout } = useAuthStore();
  const [location] = useLocation();
  const isLanding = location === "/";
  const isProjectPage = location.startsWith("/projects/");

  if (isProjectPage) return null;

  return (
    <header className="topbar">
      <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
        <div className="sidebar-logo-mark" style={{ width: 28, height: 28, fontSize: 12 }}>B</div>
        <div className="flex items-baseline gap-1.5">
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "hsl(var(--foreground))" }}>BIMLog</span>
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>by IgniteSmart</span>
        </div>
      </Link>

      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={() => setLanguage(language === "en" ? "es" : "en")}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 6,
            fontSize: 11, fontWeight: 600,
            color: "hsl(var(--muted-foreground))",
            background: "hsl(var(--secondary))",
            border: "1px solid hsl(var(--border))",
            cursor: "pointer"
          }}
        >
          <Globe style={{ width: 13, height: 13 }} />
          {language.toUpperCase()}
        </button>

        <Link href="/setup-guide">
          <button
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 6,
              fontSize: 11, fontWeight: 600,
              color: "hsl(var(--muted-foreground))",
              background: "hsl(var(--secondary))",
              border: "1px solid hsl(var(--border))",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            <HelpCircle style={{ width: 13, height: 13 }} />
            Help
          </button>
        </Link>

        {user ? (
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "5px 12px", borderRadius: 6,
              background: "hsl(var(--secondary))",
              border: "1px solid hsl(var(--border))"
            }}>
              <div className="avatar avatar-sm av-blue">{user.fullName?.charAt(0).toUpperCase()}</div>
              <span style={{ fontSize: 12, fontWeight: 500, color: "hsl(var(--foreground))" }}>{user.fullName}</span>
            </div>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" style={{ fontSize: 12 }}>{t("nav.dashboard")}</Button>
            </Link>
            <Link href="/profile">
              <Button variant="ghost" size="sm" style={{ fontSize: 12 }}>Profile</Button>
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
