import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/lib/i18n";
import { ConfigProvider } from "@/lib/config-context";
import { installAuthStorageContinuity, useAuthStore } from "@/store/auth";

import { Navbar } from "@/components/layout/Navbar";
import { DebugBanner } from "@/components/DebugBanner";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { PublicRouteMetadata } from "@/components/PublicRouteMetadata";
import { loadAccessProfile, resolveProjectContext, type AccessSurface } from "@/lib/access-profile";

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
const CompanyMasterCatalogs = namedPage(() => import("@/pages/CompanyMasterCatalogs"), "CompanyMasterCatalogs");
const CompanyDeliveryWorkflows = namedPage(() => import("@/pages/CompanyDeliveryWorkflows"), "CompanyDeliveryWorkflows");
const CompanyWorkflowGovernance = namedPage(() => import("@/pages/CompanyWorkflowGovernance"), "CompanyWorkflowGovernance");
const CompanyPricingTemplates = namedPage(() => import("@/pages/CompanyPricingTemplates"), "CompanyPricingTemplates");
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

function AccessRoute({ component: Component, surface }: { component: React.ComponentType; surface: AccessSurface }) {
  const { token, logout } = useAuthStore();
  const [, setLocation] = useLocation();
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");
  const [code, setCode] = useState("ACCESS_CHECK_PENDING");

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    const controller = new AbortController();
    setState("loading");
    loadAccessProfile(token, controller.signal)
      .then((profile) => {
        const decision = profile.decisions[surface];
        setCode(decision?.code ?? "ACCESS_SURFACE_UNKNOWN");
        setState(decision?.allow ? "allowed" : "denied");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (String(error).includes("401")) { logout(); setLocation("/login"); return; }
        setCode("ACCESS_PROFILE_UNAVAILABLE");
        setState("denied");
      });
    return () => controller.abort();
  }, [token, surface, logout, setLocation]);

  if (state === "loading") return <div className="route-loading" role="status">Verifying access… / Verificando acceso…</div>;
  if (state === "denied") return <section role="alert" style={{ maxWidth: 680, margin: "48px auto", padding: 24 }}><h1>Access unavailable / Acceso no disponible</h1><p>This workspace is not authorized for your current account. / Este espacio no está autorizado para su cuenta actual.</p><code>{code}</code></section>;
  return <Component />;
}

function ProjectRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, logout } = useAuthStore();
  const [location, setLocation] = useLocation();
  const [context, setContext] = useState<ReturnType<typeof resolveProjectContext> | null>(null);
  const projectId = Number(location.match(/^\/projects\/(\d+)/)?.[1] ?? 0);

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    const controller = new AbortController();
    setContext(null);
    loadAccessProfile(token, controller.signal)
      .then((profile) => setContext(resolveProjectContext(profile, projectId)))
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (String(error).includes("401")) { logout(); setLocation("/login"); return; }
        setContext({ allow: false, kind: "project_denied", projectId, role: null });
      });
    return () => controller.abort();
  }, [token, projectId, logout, setLocation]);

  if (!context) return <div className="route-loading" role="status">Verifying project context… / Verificando contexto del proyecto…</div>;
  if (!context.allow) return <section role="alert" style={{ maxWidth: 680, margin: "48px auto", padding: 24 }}><h1>{context.kind === "zero_project" ? "No active project / Sin proyecto activo" : "Project access unavailable / Acceso al proyecto no disponible"}</h1><p>{context.kind === "zero_project" ? "Your headquarters account is active without a project assignment." : "This project is outside your current authorized scope."}</p></section>;
  return <>{context.kind === "global_super_admin" && <div role="status" style={{ padding: "6px 16px", background: "#EFF6FF", color: "#1E3A5F", fontSize: 12, fontWeight: 700 }}>Global Super Administrator context / Contexto global de Super Administrador</div>}<Component /></>;
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
        {() => <ProjectRoute component={() => <FinancialBudgetWorkspace mode="structure" />} />}
      </Route>
      <Route path="/projects/:id/financial/budget">
        {() => <ProjectRoute component={() => <FinancialBudgetWorkspace mode="budget" />} />}
      </Route>
      <Route path="/projects/:id/financial/history">
        {() => <ProjectRoute component={() => <FinancialBudgetWorkspace mode="history" />} />}
      </Route>
      <Route path="/projects/:id/financial/snapshots/:snapshotId">
        {() => <ProjectRoute component={() => <FinancialBudgetWorkspace mode="snapshot" />} />}
      </Route>
      <Route path="/projects/:id/financial/contracts">
        {() => <ProjectRoute component={FinancialContractWorkspace} />}
      </Route>
      <Route path="/projects/:id/financial/apu">
        {() => <ProjectRoute component={FinancialApuWorkspace} />}
      </Route>
      <Route path="/projects/:id/commercial/team-performance">
        {() => <ProjectRoute component={TeamPerformanceWorkspace} />}
      </Route>
      <Route path="/projects/:id/intake">
        {() => <ProjectRoute component={JobIntakeWorkspace} />}
      </Route>
      <Route path="/projects/:id/operations">
        {() => <ProjectRoute component={JobOperationsWorkspace} />}
      </Route>
      <Route path="/projects/:id/:tab?">
        {() => <ProjectRoute component={ProjectDetail} />}
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
        {() => <AccessRoute component={AdminPanel} surface="feedback_administration" />}
      </Route>
      <Route path="/company-catalogs">
        {() => <AccessRoute component={CompanyMasterCatalogs} surface="company_catalogs" />}
      </Route>
      <Route path="/company-workflows">
        {() => <AccessRoute component={CompanyDeliveryWorkflows} surface="company_workflows" />}
      </Route>
      <Route path="/company-workflow-governance">
        {() => <AccessRoute component={CompanyWorkflowGovernance} surface="company_workflows" />}
      </Route>
      <Route path="/company-pricing-templates">
        {() => <AccessRoute component={CompanyPricingTemplates} surface="company_pricing" />}
      </Route>
      <Route path="/admin">
        {() => <AccessRoute component={AdminPanel} surface="project_administration" />}
      </Route>
      <Route path="/feedback">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/total-control">
        {() => <AccessRoute component={TotalControl} surface="total_control" />}
      </Route>
      <Route path="/living-brief">
        {() => <AccessRoute component={LivingBrief} surface="living_brief" />}
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
  useEffect(() => installAuthStorageContinuity(), []);
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
