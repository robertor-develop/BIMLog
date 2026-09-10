import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { lazy, Suspense, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { ConfigProvider } from "@/lib/config-context";
import { useAuthStore } from "@/store/auth";

import { Navbar } from "@/components/layout/Navbar";
import { DebugBanner } from "@/components/DebugBanner";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { PublicRouteMetadata } from "@/components/PublicRouteMetadata";

const namedPage = (loader: () => Promise<object>, name: string) =>
  lazy(async () => ({ default: (await loader() as Record<string, React.ComponentType<any>>)[name] }));

const Landing = namedPage(() => import("@/pages/Landing"), "Landing");
const Login = namedPage(() => import("@/pages/Login"), "Login");
const Register = namedPage(() => import("@/pages/Register"), "Register");
const Dashboard = namedPage(() => import("@/pages/Dashboard"), "Dashboard");
const PendingItems = namedPage(() => import("@/pages/PendingItems"), "PendingItems");
const ProjectDetail = namedPage(() => import("@/pages/ProjectDetail"), "ProjectDetail");
const HelpCenter = namedPage(() => import("@/pages/HelpCenter"), "HelpCenter");
const Profile = namedPage(() => import("@/pages/Profile"), "Profile");
const CompanyProfile = namedPage(() => import("@/pages/CompanyProfile"), "CompanyProfile");
const NotificationSettings = namedPage(() => import("@/pages/NotificationSettings"), "NotificationSettings");
const FinancialControlsSettings = namedPage(() => import("@/pages/FinancialControlsSettings"), "FinancialControlsSettings");
const FinancialApuWorkspace = namedPage(() => import("@/pages/FinancialApuWorkspace"), "FinancialApuWorkspace");
const FinancialBudgetWorkspace = namedPage(() => import("@/pages/FinancialBudgetWorkspace"), "FinancialBudgetWorkspace");
const FinancialContractWorkspace = namedPage(() => import("@/pages/FinancialContractWorkspace"), "FinancialContractWorkspace");
const JobIntakeWorkspace = namedPage(() => import("@/pages/JobIntakeWorkspace"), "JobIntakeWorkspace");
const JobOperationsWorkspace = namedPage(() => import("@/pages/JobOperationsWorkspace"), "JobOperationsWorkspace");
const TeamPerformanceWorkspace = namedPage(() => import("@/pages/TeamPerformanceWorkspace"), "TeamPerformanceWorkspace");
const Privacy = namedPage(() => import("@/pages/Privacy"), "Privacy");
const Terms = namedPage(() => import("@/pages/Terms"), "Terms");
const Disclaimer = namedPage(() => import("@/pages/Disclaimer"), "Disclaimer");
const DataRetention = namedPage(() => import("@/pages/DataRetention"), "DataRetention");
const ResetPasswordPage = namedPage(() => import("@/pages/ResetPassword"), "ResetPasswordPage");
const AdminPanel = namedPage(() => import("@/pages/AdminPanel"), "AdminPanel");
const TotalControl = namedPage(() => import("@/pages/TotalControl"), "TotalControl");
const LivingBrief = namedPage(() => import("@/pages/LivingBrief"), "LivingBrief");
const Pricing = namedPage(() => import("@/pages/Pricing"), "Pricing");
const About = namedPage(() => import("@/pages/About"), "About");
const Contact = namedPage(() => import("@/pages/Contact"), "Contact");
const Features = namedPage(() => import("@/pages/Features"), "Features");
const LensNextWorkspace = namedPage(() => import("@/features/lens-next/LensNextWorkspace"), "LensNextWorkspace");
const NotFound = lazy(() => import("@/pages/not-found"));

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
      <Route path="/lens-next">
        {() => <ProtectedRoute component={LensNextWorkspace} />}
      </Route>
      <Route path="/projects/:id/financial/cost-structure">
        {() => <ProtectedRoute component={() => <FinancialBudgetWorkspace mode="structure" />} />}
      </Route>
      <Route path="/projects/:id/financial/budget">
        {() => <ProtectedRoute component={() => <FinancialBudgetWorkspace mode="budget" />} />}
      </Route>
      <Route path="/projects/:id/financial/history">
        {() => <ProtectedRoute component={() => <FinancialBudgetWorkspace mode="history" />} />}
      </Route>
      <Route path="/projects/:id/financial/snapshots/:snapshotId">
        {() => <ProtectedRoute component={() => <FinancialBudgetWorkspace mode="snapshot" />} />}
      </Route>
      <Route path="/projects/:id/financial/contracts">
        {() => <ProtectedRoute component={FinancialContractWorkspace} />}
      </Route>
      <Route path="/projects/:id/financial/apu">
        {() => <ProtectedRoute component={FinancialApuWorkspace} />}
      </Route>
      <Route path="/projects/:id/commercial/team-performance">
        {() => <ProtectedRoute component={TeamPerformanceWorkspace} />}
      </Route>
      <Route path="/projects/:id/intake">
        {() => <ProtectedRoute component={JobIntakeWorkspace} />}
      </Route>
      <Route path="/projects/:id/operations">
        {() => <ProtectedRoute component={JobOperationsWorkspace} />}
      </Route>
      <Route path="/projects/:id/:tab?">
        {() => <ProtectedRoute component={ProjectDetail} />}
      </Route>
      <Route path="/help">
        {() => <ProtectedRoute component={HelpCenter} />}
      </Route>
      <Route path="/setup-guide">
        {() => <ProtectedRoute component={HelpCenter} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      <Route path="/settings/company-profile">
        {() => <ProtectedRoute component={CompanyProfile} />}
      </Route>
      <Route path="/settings/notifications">
        {() => <ProtectedRoute component={NotificationSettings} />}
      </Route>
      <Route path="/settings/financial-controls">
        {() => <ProtectedRoute component={FinancialControlsSettings} />}
      </Route>
      <Route path="/admin/feedback">
        {() => <ProtectedRoute component={AdminPanel} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminPanel} />}
      </Route>
      <Route path="/feedback">
        {() => <ProtectedRoute component={Dashboard} />}
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
            <PublicRouteMetadata />
            <LivingBriefHotkey />
            <div className="min-h-screen flex flex-col bg-background selection:bg-primary/30 text-foreground font-sans">
              <a className="skip-to-main" href="#main-content">Skip to main content / Ir al contenido principal</a>
              <Navbar />
              <main id="main-content" tabIndex={-1} className="flex-1">
                <Suspense fallback={<div className="route-loading" role="status" aria-live="polite">Loading workspace… / Cargando espacio de trabajo…</div>}>
                  <Router />
                </Suspense>
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
