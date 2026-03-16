import { Link, useLocation } from "wouter";
import { useI18n } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Globe, LayoutDashboard } from "lucide-react";

export function Navbar() {
  const { t, lang: language, setLang: setLanguage } = useI18n();
  const { user, logout } = useAuthStore();
  const [location] = useLocation();

  const isLanding = location === "/";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="font-display font-bold text-white text-sm">B</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-display font-bold text-foreground text-base">BIMLog</span>
            <span className="text-muted-foreground text-xs hidden sm:block">by IgniteSmart</span>
          </div>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">

          {/* Language toggle */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            title={t('nav.toggleLang')}
          >
            <Globe className="w-4 h-4" />
            <span className="font-medium uppercase">{language}</span>
          </button>

          {user ? (
            <>
              {/* User info */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary">
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {user.fullName?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium text-foreground">{user.fullName}</span>
              </div>

              {/* Dashboard link */}
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('nav.dashboard')}</span>
                </Button>
              </Link>

              {/* Logout */}
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{t('nav.logout')}</span>
              </Button>
            </>
          ) : (
            isLanding && (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm">{t('auth.login')}</Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">{t('auth.register')}</Button>
                </Link>
              </>
            )
          )}
        </div>
      </div>
    </header>
  );
}
