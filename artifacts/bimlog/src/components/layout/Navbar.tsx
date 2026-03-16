import { Link, useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { LogOut, Globe, Hexagon } from "lucide-react";

export function Navbar() {
  const { user, logout } = useAuthStore();
  const { t, lang, setLang } = useI18n();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/5 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/40 transition-all">
                <Hexagon className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="font-display font-bold text-xl tracking-tight text-white block leading-none">
                  {t('app.name')}
                </span>
                <span className="text-[10px] text-accent font-medium tracking-wider uppercase">
                  {t('app.tagline')}
                </span>
              </div>
            </Link>
            
            {user && (
              <div className="hidden md:flex space-x-1">
                <Link href="/dashboard" className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-white hover:bg-card transition-colors">
                  {t('nav.dashboard')}
                </Link>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
              className="text-muted-foreground hover:text-white"
            >
              <Globe className="w-5 h-5" />
              <span className="sr-only">Toggle Language</span>
            </Button>

            {user ? (
              <div className="flex items-center space-x-4">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-medium text-white">{user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user.companyName}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {user.fullName.charAt(0)}
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="w-5 h-5 text-muted-foreground hover:text-destructive transition-colors" />
                </Button>
              </div>
            ) : (
              <div className="flex space-x-3">
                <Link href="/login">
                  <Button variant="ghost">{t('auth.login')}</Button>
                </Link>
                <Link href="/register">
                  <Button variant="default">{t('auth.register')}</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
