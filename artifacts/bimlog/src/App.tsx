import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { ConfigProvider } from "@/lib/config-context";
import { useAuthStore } from "@/store/auth";

// Pages
import { Landing } from "@/pages/Landing";
import { Login } from "@/pages/Login";
import { Register } from "@/pages/Register";
import { Dashboard } from "@/pages/Dashboard";
import { PendingItems } from "@/pages/PendingItems";
import { ProjectDetail } from "@/pages/ProjectDetail";
import { SetupGuide } from "@/pages/SetupGuide";
import { Profile } from "@/pages/Profile";
import { CompanyProfile } from "@/pages/CompanyProfile";
import { Privacy } from "@/pages/Privacy";
import { Terms } from "@/pages/Terms";
import { Disclaimer } from "@/pages/Disclaimer";
import { DataRetention } from "@/pages/DataRetention";
import { ResetPasswordPage } from "@/pages/ResetPassword";
import { AdminPanel } from "@/pages/AdminPanel";
import { TotalControl } from "@/pages/TotalControl";
import { LivingBrief } from "@/pages/LivingBrief";
import { Pricing } from "@/pages/Pricing";
import { About } from "@/pages/About";
import { Contact } from "@/pages/Contact";
import { Features } from "@/pages/Features";
import NotFound from "@/pages/not-found";
import { Navbar } from "@/components/layout/Navbar";
import { DebugBanner } from "@/components/DebugBanner";
import { FeedbackWidget } from "@/components/FeedbackWidget";

const queryClient = new QueryClient();

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { token } = useAuthStore();
  const [, setLocation] = useLocation();

  if (!token) {
    setLocation('/login');
    return null;
  }

  return <Component />;
}

// F5 intercept: eligible admins (super admin or granted access) are sent to the
// Living Brief instead of a browser refresh. Everyone else gets a normal F5 refresh.
// Ctrl+R / Cmd+R are intentionally NOT intercepted.
function LivingBriefHotkey() {
  const { token } = useAuthStore();
  const [, setLocation] = useLocation();
  const eligibleRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (!token) { eligibleRef.current = false; return; }
    fetch(`${API_BASE}/api/v1/living-brief/eligibility`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : { eligible: false }))
      .then((d) => { if (active) eligibleRef.current = !!d.eligible; })
      .catch(() => { if (active) eligibleRef.current = false; });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F5" && !e.ctrlKey && !e.metaKey && eligibleRef.current) {
        e.preventDefault();
        setLocation("/living-brief");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setLocation]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/reset-password" component={ResetPasswordPage} />

      {/* Legal pages - public */}
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/disclaimer" component={Disclaimer} />
      <Route path="/data-retention" component={DataRetention} />

      {/* Protected Routes */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/pending">
        {() => <ProtectedRoute component={PendingItems} />}
      </Route>
      <Route path="/projects/:id/:tab?">
        {() => <ProtectedRoute component={ProjectDetail} />}
      </Route>
      <Route path="/setup-guide" component={SetupGuide} />
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      <Route path="/settings/company-profile">
        {() => <ProtectedRoute component={CompanyProfile} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminPanel} />}
      </Route>
      <Route path="/total-control">
        {() => <ProtectedRoute component={TotalControl} />}
      </Route>
      <Route path="/living-brief">
        {() => <ProtectedRoute component={LivingBrief} />}
      </Route>
      <Route path="/pricing" component={Pricing} />
      <Route path="/features" component={Features} />
      <Route path="/about" component={About} />
      <Route path="/contact" component={Contact} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DebugBanner />
      <I18nProvider>
        <ConfigProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <LivingBriefHotkey />
            <div className="min-h-screen flex flex-col bg-background selection:bg-primary/30 text-foreground font-sans">
              <Navbar />
              <main className="flex-1">
                <Router />
              </main>
            </div>
            <FeedbackWidget />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
        </ConfigProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
