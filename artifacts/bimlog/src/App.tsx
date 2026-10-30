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
import { PublicRouteMetadata } from "@/components/PublicRouteMetadata";
import { RouteAccessibility } from "@/components/layout/RouteAccessibility";
import { RouteState } from "@/components/layout/RouteState";
import { loadAccessProfile, resolveProjectContext, type AccessSurface } from "@/lib/access-profile";
import { loadDeploymentModule } from "@/lib/deployment-module-recovery";

const namedPage = (loader: () => Promise<object>, name: string) =>
  lazy(async () => ({ default: (await loadDeploymentModule(loader) as Record<string, React.ComponentType<any>>)[name] }));

const Landing = namedPage(() => import("@/pages/Landing"), "Landing");
const Login = namedPage(() => import("@/pages/Login"), "Login");
const Register = namedPage(() => import("@/pages/Register"), "Register");
const VerifyEmail = namedPage(() => import("@/pages/VerifyEmail"), "VerifyEmail");
const Dashboard = namedPage(() => import("@/pages/Dashboard"), "Dashboard");
const PendingItems = namedPage(() => import("@/pages/PendingItems"), "PendingItems");
const AllTools = namedPage(() => import("@/pages/AllTools"), "AllTools");
const ProjectDetail = namedPage(() => import("@/pages/ProjectDetail"), "ProjectDetail");
const HelpCenter = namedPage(() => import("@/pages/HelpCenter"), "HelpCenter");
const ProjectSetupTraining = namedPage(() => import("@/pages/ProjectSetupTraining"), "ProjectSetupTraining");
const Profile = namedPage(() => import("@/pages/Profile"), "Profile");
const CompanyProfile = namedPage(() => import("@/pages/CompanyProfile"), "CompanyProfile");
const NotificationSettings = namedPage(() => import("@/pages/NotificationSettings"), "NotificationSettings");
const FinancialControlsSettings = namedPage(() => import("@/pages/FinancialControlsSettings"), "FinancialControlsSettings");
const CommercialWorkspace = namedPage(() => import("@/pages/CommercialWorkspace"), "CommercialWorkspace");
const FinancialApuWorkspace = namedPage(() => import("@/pages/FinancialApuWorkspace"), "FinancialApuWorkspace");
const FinancialBudgetWorkspace = namedPage(() => import("@/pages/FinancialBudgetWorkspace"), "FinancialBudgetWorkspace");
const FinancialContractWorkspace = namedPage(() => import("@/pages/FinancialContractWorkspace"), "FinancialContractWorkspace");
const FinancialContractItemsWorkspace = namedPage(() => import("@/pages/FinancialContractItemsWorkspace"), "FinancialContractItemsWorkspace");
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
const CoordinationKnowledgeLibrary = namedPage(() => import("@/pages/CoordinationKnowledgeLibrary"), "CoordinationKnowledgeLibrary");
const KnowledgeSearch = namedPage(() => import("@/pages/KnowledgeSearch"), "KnowledgeSearch");
const KnowledgeStarterLibrary = namedPage(() => import("@/pages/KnowledgeStarterLibrary"), "KnowledgeStarterLibrary");
const KnowledgeTaxonomy = namedPage(() => import("@/pages/KnowledgeTaxonomy"), "KnowledgeTaxonomy");
const PendingWork = namedPage(() => import("@/pages/PendingWork"), "PendingWork");
const MacSyncAvailability = namedPage(() => import("@/pages/MacSyncAvailability"), "MacSyncAvailability");
const FeatureAccessInspector = namedPage(() => import("@/pages/FeatureAccessInspector"), "FeatureAccessInspector");
const FeatureCatalog = namedPage(() => import("@/pages/FeatureCatalog"), "FeatureCatalog");
const FeaturePolicyWorkspace = namedPage(() => import("@/pages/FeaturePolicyWorkspace"), "FeaturePolicyWorkspace");
const FeaturePreferences = namedPage(() => import("@/pages/FeaturePreferences"), "FeaturePreferences");
const TelegramOperations = namedPage(() => import("@/pages/TelegramOperations"), "TelegramOperations");
const MasterCatalogBrowser = namedPage(() => import("@/pages/MasterCatalogBrowser"), "MasterCatalogBrowser");
const MyAiUsage = namedPage(() => import("@/pages/MyAiUsage"), "MyAiUsage");
const MyConnectionFiles = namedPage(() => import("@/pages/MyConnectionFiles"), "MyConnectionFiles");
const MySetup = namedPage(() => import("@/pages/MySetup"), "MySetup");
const ProjectAgentReview = namedPage(() => import("@/pages/ProjectAgentReview"), "ProjectAgentReview");
const ProjectUserAssignment = namedPage(() => import("@/pages/ProjectUserAssignment"), "ProjectUserAssignment");
const ProjectBriefingReview = namedPage(() => import("@/pages/ProjectBriefingReview"), "ProjectBriefingReview");
const LensImportPlan = namedPage(() => import("@/pages/LensImportPlan"), "LensImportPlan");
const LensImportContext = namedPage(() => import("@/pages/LensImportContext"), "LensImportContext");
const LensSequenceStatus = namedPage(() => import("@/pages/LensSequenceStatus"), "LensSequenceStatus");
const LensSyncReview = namedPage(() => import("@/pages/LensSyncReview"), "LensSyncReview");
const PluginPullReview = namedPage(() => import("@/pages/PluginPullReview"), "PluginPullReview");
const FindOriginalClash = namedPage(() => import("@/pages/FindOriginalClash"), "FindOriginalClash");
const ProcoreConnectionStatus = namedPage(() => import("@/pages/ProcoreConnectionStatus"), "ProcoreConnectionStatus");
const CoordinationOperations = namedPage(() => import("@/pages/CoordinationOperations"), "CoordinationOperations");
const PluginSyncReview = namedPage(() => import("@/pages/PluginSyncReview"), "PluginSyncReview");
const TotalControl = namedPage(() => import("@/pages/TotalControl"), "TotalControl");
const ProjectCompanyBindings = namedPage(() => import("@/pages/parity/admin-project-company-bindings"), "ProjectCompanyBindings");
const FixSpecificLink = namedPage(() => import("@/pages/parity/admin-fix-specific-link"), "FixSpecificLink");
const LaunchConfiguration = namedPage(() => import("@/pages/parity/admin-launch-configuration"), "LaunchConfiguration");
const AdminMasterCatalogs = namedPage(() => import("@/pages/parity/admin-master-catalogs"), "AdminMasterCatalogs");
const AdminOverview = namedPage(() => import("@/pages/parity/admin-overview"), "AdminOverview");
const AdminPlatformCapabilities = namedPage(() => import("@/pages/parity/admin-platform-capabilities"), "AdminPlatformCapabilities");
const AdminPlatformStats = namedPage(() => import("@/pages/parity/admin-platform-stats"), "AdminPlatformStats");
const AdminProjectsList = namedPage(() => import("@/pages/parity/admin-projects-list"), "AdminProjectsList");
const AdminSupport = namedPage(() => import("@/pages/parity/admin-support"), "AdminSupport");
const AiControlBudgets = namedPage(() => import("@/pages/parity/ai-control-budgets"), "AiControlBudgets");
const AiControlCompanies = namedPage(() => import("@/pages/parity/ai-control-companies"), "AiControlCompanies");
const AiControlCompanyAdministrators = namedPage(() => import("@/pages/parity/ai-control-company-ai-administrators"), "AiControlCompanyAdministrators");
const AiControlCompanyUsers = namedPage(() => import("@/pages/parity/ai-control-company-users"), "AiControlCompanyUsers");
const AiControlEntitlements = namedPage(() => import("@/pages/parity/ai-control-entitlements"), "AiControlEntitlements");
const AiControlEstimates = namedPage(() => import("@/pages/parity/ai-control-estimates"), "AiControlEstimates");
const AiControlPrices = namedPage(() => import("@/pages/parity/ai-control-prices"), "AiControlPrices");
const AiControlProviderConnections = namedPage(() => import("@/pages/parity/ai-control-provider-connections"), "AiControlProviderConnections");
const AiControlRuns = namedPage(() => import("@/pages/parity/ai-control-runs"), "AiControlRuns");
const AiControlStatus = namedPage(() => import("@/pages/parity/ai-control-status"), "AiControlStatus");
const AiControlUsage = namedPage(() => import("@/pages/parity/ai-control-usage"), "AiControlUsage");
const AuthLaunchStepUp = namedPage(() => import("@/pages/parity/auth-launch-step-up"), "AuthLaunchStepUp");
const AuthLogin = namedPage(() => import("@/pages/parity/auth-login"), "AuthLogin");
const AuthOpenAiKey = namedPage(() => import("@/pages/parity/auth-openai-key"), "AuthOpenAiKey");
const AutodeskHubs = namedPage(() => import("@/pages/parity/autodesk-hubs"), "AutodeskHubs");
const AutodeskLogin = namedPage(() => import("@/pages/parity/autodesk-login"), "AutodeskLogin");
const AutodeskProjects = namedPage(() => import("@/pages/parity/autodesk-projects"), "AutodeskProjects");
const AutodeskToken = namedPage(() => import("@/pages/parity/autodesk-token"), "AutodeskToken");
const CommercialBillingIdentity = namedPage(() => import("@/pages/parity/commercial-billing-identity"), "CommercialBillingIdentity");
const CommercialBillingPortal = namedPage(() => import("@/pages/parity/commercial-billing-portal"), "CommercialBillingPortal");
const CommercialCheckout = namedPage(() => import("@/pages/parity/commercial-checkout"), "CommercialCheckout");
const CommercialProviders = namedPage(() => import("@/pages/parity/commercial-providers"), "CommercialProviders");
const LivingBrief = namedPage(() => import("@/pages/LivingBrief"), "LivingBrief");
const Pricing = namedPage(() => import("@/pages/Pricing"), "Pricing");
const About = namedPage(() => import("@/pages/About"), "About");
const Contact = namedPage(() => import("@/pages/Contact"), "Contact");
const Features = namedPage(() => import("@/pages/Features"), "Features");
const LensNextWorkspace = namedPage(() => import("@/features/lens-next/LensNextWorkspace"), "LensNextWorkspace");
const NotFound = lazy(() => loadDeploymentModule(() => import("@/pages/not-found")));
const FeedbackWidget = namedPage(() => import("@/components/FeedbackWidget"), "FeedbackWidget");
const PageAssistant = namedPage(() => import("@/components/layout/PageAssistant"), "PageAssistant");

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
  const [state, setState] = useState<"loading" | "allowed" | "denied" | "error">("loading");
  const [code, setCode] = useState("ACCESS_CHECK_PENDING");
  const [retryKey, setRetryKey] = useState(0);

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
        setState("error");
      });
    return () => controller.abort();
  }, [token, surface, logout, setLocation, retryKey]);

  if (state === "loading") return <RouteState kind="loading" title="Verifying access / Verificando acceso" />;
  if (state === "error") return <RouteState kind="error" code="ACCESS_PROFILE_UNAVAILABLE" onRetry={() => setRetryKey(value => value + 1)} />;
  if (state === "denied") return <RouteState kind="denied" code={code} />;
  return <Component />;
}

function ProjectRoute({ component: Component }: { component: React.ComponentType }) {
  const { token, logout } = useAuthStore();
  const [location, setLocation] = useLocation();
  const [context, setContext] = useState<ReturnType<typeof resolveProjectContext> | null>(null);
  const [projectError, setProjectError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const projectId = Number(location.match(/^\/projects\/(\d+)/)?.[1] ?? 0);

  useEffect(() => {
    if (!token) { setLocation("/login"); return; }
    const controller = new AbortController();
    setContext(null);
    setProjectError(false);
    loadAccessProfile(token, controller.signal)
      .then((profile) => setContext(resolveProjectContext(profile, projectId)))
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (String(error).includes("401")) { logout(); setLocation("/login"); return; }
        setProjectError(true);
      });
    return () => controller.abort();
  }, [token, projectId, logout, setLocation, retryKey]);

  if (projectError) return <RouteState kind="error" code="PROJECT_CONTEXT_UNAVAILABLE" onRetry={() => setRetryKey(value => value + 1)} />;
  if (!context) return <RouteState kind="loading" title="Verifying project context / Verificando contexto del proyecto" />;
  if (!context.allow) return <RouteState kind="denied" title={context.kind === "zero_project" ? "No active project / Sin proyecto activo" : "Project access unavailable / Acceso al proyecto no disponible"} detail={context.kind === "zero_project" ? "Your headquarters account is active without a project assignment. / Su cuenta de sede está activa sin asignación de proyecto." : "This project is outside your current authorized scope. / Este proyecto está fuera de su alcance autorizado actual."} />;
  return <>{context.kind === "global_super_admin" && <div role="status" style={{ padding: "6px 16px", background: "#EFF6FF", color: "#1E3A5F", fontSize: 12, fontWeight: 700 }}>Global Super Administrator context / Contexto global de Super Administrador</div>}<Component /></>;
}

function SetupGuideRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => setLocation("/help?topic=getting-started&view=manual", { replace: true }), [setLocation]);
  return <RouteState kind="loading" title="Opening setup guide / Abriendo guía de configuración" />;
}

function LegacySubmittalTrackerRedirect() {
  const [location, setLocation] = useLocation();
  const projectId = location.match(/^\/projects\/(\d+)\/submittal-tracker/)?.[1];
  useEffect(() => {
    if (projectId) setLocation(`/projects/${projectId}/submittals?view=tracking`, { replace: true });
  }, [projectId, setLocation]);
  return <RouteState kind="loading" title="Opening Submittals tracking / Abriendo seguimiento de Submittals" />;
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

const FEEDBACK_IDLE_DELAY_MS = 400;

function DeferredFeedbackWidget() {
  const { token } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) {
      setReady(false);
      return;
    }
    const timer = window.setTimeout(() => setReady(true), FEEDBACK_IDLE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [token]);

  if (!token || !ready) return null;
  return <Suspense fallback={null}><FeedbackWidget launcher={false} /></Suspense>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/auth/login" component={AuthLogin} />
      <Route path="/auth/openai-key">
        {() => <ProtectedRoute component={AuthOpenAiKey} />}
      </Route>
      <Route path="/autodesk/hubs">
        {() => <ProtectedRoute component={AutodeskHubs} />}
      </Route>
      <Route path="/autodesk/login">
        {() => <ProtectedRoute component={AutodeskLogin} />}
      </Route>
      <Route path="/autodesk/projects/:hubId">
        {() => <ProtectedRoute component={AutodeskProjects} />}
      </Route>
      <Route path="/autodesk/token">
        {() => <ProtectedRoute component={AutodeskToken} />}
      </Route>
      <Route path="/commercial/billing-identity">
        {() => <ProtectedRoute component={CommercialBillingIdentity} />}
      </Route>
      <Route path="/commercial/billing-portal">
        {() => <ProtectedRoute component={CommercialBillingPortal} />}
      </Route>
      <Route path="/commercial/checkout">
        {() => <ProtectedRoute component={CommercialCheckout} />}
      </Route>
      <Route path="/commercial/providers">
        {() => <ProtectedRoute component={CommercialProviders} />}
      </Route>
      <Route path="/register" component={Register} />
      <Route path="/verify-email" component={VerifyEmail} />
      <Route path="/reset-password" component={ResetPasswordPage} />

      {/* Legal pages - public */}
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/legal-notice" component={Disclaimer} />
      <Route path="/disclaimer" component={Disclaimer} />
      <Route path="/data-retention" component={DataRetention} />

      {/* Protected Routes */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/pending">
        {() => <ProtectedRoute component={PendingItems} />}
      </Route>
      <Route path="/all-tools">
        {() => <ProtectedRoute component={AllTools} />}
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
      <Route path="/projects/:id/financial/contracts/:contractId/items">
        {() => <ProjectRoute component={FinancialContractItemsWorkspace} />}
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
      <Route path="/projects/:id/submittal-tracker">
        {() => <ProjectRoute component={LegacySubmittalTrackerRedirect} />}
      </Route>
      <Route path="/projects/:id/:tab?">
        {() => <ProjectRoute component={ProjectDetail} />}
      </Route>
      <Route path="/help">
        {() => <ProtectedRoute component={HelpCenter} />}
      </Route>
      <Route path="/setup-guide">
        {() => <ProtectedRoute component={SetupGuideRedirect} />}
      </Route>
      <Route path="/training/project-setup">
        {() => <ProtectedRoute component={ProjectSetupTraining} />}
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
      <Route path="/settings/billing-support">
        {() => <ProtectedRoute component={CommercialWorkspace} />}
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
      <Route path="/knowledge">
        {() => <ProtectedRoute component={CoordinationKnowledgeLibrary} />}
      </Route>
      <Route path="/knowledge/search">
        {() => <ProtectedRoute component={KnowledgeSearch} />}
      </Route>
      <Route path="/knowledge/starter-library">
        {() => <ProtectedRoute component={KnowledgeStarterLibrary} />}
      </Route>
      <Route path="/knowledge/taxonomy">
        {() => <ProtectedRoute component={KnowledgeTaxonomy} />}
      </Route>
      <Route path="/pending-work">
        {() => <ProtectedRoute component={PendingWork} />}
      </Route>
      <Route path="/sync-agent/mac">
        {() => <ProtectedRoute component={MacSyncAvailability} />}
      </Route>
      <Route path="/feature-access">
        {() => <ProtectedRoute component={FeatureAccessInspector} />}
      </Route>
      <Route path="/feature-catalog">
        {() => <ProtectedRoute component={FeatureCatalog} />}
      </Route>
      <Route path="/feature-policies">
        {() => <ProtectedRoute component={FeaturePolicyWorkspace} />}
      </Route>
      <Route path="/feature-preferences">
        {() => <ProtectedRoute component={FeaturePreferences} />}
      </Route>
      <Route path="/telegram-operations">
        {() => <ProtectedRoute component={TelegramOperations} />}
      </Route>
      <Route path="/master-catalogs">
        {() => <ProtectedRoute component={MasterCatalogBrowser} />}
      </Route>
      <Route path="/my-ai-usage">
        {() => <ProtectedRoute component={MyAiUsage} />}
      </Route>
      <Route path="/my-connected-files">
        {() => <ProtectedRoute component={MyConnectionFiles} />}
      </Route>
      <Route path="/my-setup">
        {() => <ProtectedRoute component={MySetup} />}
      </Route>
      <Route path="/project-agent-review">
        {() => <ProtectedRoute component={ProjectAgentReview} />}
      </Route>
      <Route path="/project-user-assignment">
        {() => <ProtectedRoute component={ProjectUserAssignment} />}
      </Route>
      <Route path="/project-briefing-review">
        {() => <ProtectedRoute component={ProjectBriefingReview} />}
      </Route>
      <Route path="/lens-import-plan">
        {() => <ProtectedRoute component={LensImportPlan} />}
      </Route>
      <Route path="/lens-import-context">
        {() => <ProtectedRoute component={LensImportContext} />}
      </Route>
      <Route path="/lens-sequence-status">
        {() => <ProtectedRoute component={LensSequenceStatus} />}
      </Route>
      <Route path="/lens-sync-review">
        {() => <ProtectedRoute component={LensSyncReview} />}
      </Route>
      <Route path="/plugin-pull-review">
        {() => <ProtectedRoute component={PluginPullReview} />}
      </Route>
      <Route path="/find-original-clash">
        {() => <ProtectedRoute component={FindOriginalClash} />}
      </Route>
      <Route path="/procore-connection-status">
        {() => <ProtectedRoute component={ProcoreConnectionStatus} />}
      </Route>
      <Route path="/coordination-operations">
        {() => <ProtectedRoute component={CoordinationOperations} />}
      </Route>
      <Route path="/plugin-sync-review">
        {() => <ProtectedRoute component={PluginSyncReview} />}
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
      <Route path="/admin/project-company-bindings">
        {() => <AccessRoute component={ProjectCompanyBindings} surface="total_control" />}
      </Route>
      <Route path="/admin/fix-specific-link">
        {() => <AccessRoute component={FixSpecificLink} surface="total_control" />}
      </Route>
      <Route path="/admin/launch-configuration">
        {() => <AccessRoute component={LaunchConfiguration} surface="total_control" />}
      </Route>
      <Route path="/admin/master-catalogs">
        {() => <AccessRoute component={AdminMasterCatalogs} surface="total_control" />}
      </Route>
      <Route path="/admin/overview">
        {() => <AccessRoute component={AdminOverview} surface="project_administration" />}
      </Route>
      <Route path="/admin/platform-capabilities">
        {() => <AccessRoute component={AdminPlatformCapabilities} surface="total_control" />}
      </Route>
      <Route path="/admin/platform-stats">
        {() => <AccessRoute component={AdminPlatformStats} surface="total_control" />}
      </Route>
      <Route path="/admin/projects-list">
        {() => <AccessRoute component={AdminProjectsList} surface="project_administration" />}
      </Route>
      <Route path="/admin/support-operations">
        {() => <AccessRoute component={AdminSupport} surface="total_control" />}
      </Route>
      <Route path="/ai-control/budgets">
        {() => <ProtectedRoute component={AiControlBudgets} />}
      </Route>
      <Route path="/ai-control/companies">
        {() => <AccessRoute component={AiControlCompanies} surface="total_control" />}
      </Route>
      <Route path="/ai-control/company-ai-administrators">
        {() => <AccessRoute component={AiControlCompanyAdministrators} surface="total_control" />}
      </Route>
      <Route path="/ai-control/company-users">
        {() => <ProtectedRoute component={AiControlCompanyUsers} />}
      </Route>
      <Route path="/ai-control/entitlements">
        {() => <ProtectedRoute component={AiControlEntitlements} />}
      </Route>
      <Route path="/ai-control/estimates">
        {() => <ProtectedRoute component={AiControlEstimates} />}
      </Route>
      <Route path="/ai-control/prices">
        {() => <AccessRoute component={AiControlPrices} surface="total_control" />}
      </Route>
      <Route path="/ai-control/provider-connections">
        {() => <ProtectedRoute component={AiControlProviderConnections} />}
      </Route>
      <Route path="/ai-control/runs">
        {() => <ProtectedRoute component={AiControlRuns} />}
      </Route>
      <Route path="/ai-control/status">
        {() => <ProtectedRoute component={AiControlStatus} />}
      </Route>
      <Route path="/ai-control/usage">
        {() => <ProtectedRoute component={AiControlUsage} />}
      </Route>
      <Route path="/auth/launch-step-up">
        {() => <AccessRoute component={AuthLaunchStepUp} surface="total_control" />}
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
  const assistantAccount = useAuthStore(state => state.token ? state.user?.id : undefined);
  useEffect(() => installAuthStorageContinuity(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <DebugBanner />
      <I18nProvider>
        <ConfigProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <PublicRouteMetadata />
            <RouteAccessibility />
            <LivingBriefHotkey />
            <div className="bimlog-workspace-split">
            <div className="bimlog-workspace-content min-h-screen flex flex-col bg-background selection:bg-primary/30 text-foreground font-sans">
              <a className="skip-to-main" href="#main-content">Skip to main content / Ir al contenido principal</a>
              <Navbar />
              <main id="main-content" tabIndex={-1} className="flex-1">
                <Suspense fallback={<div className="route-loading" role="status" aria-live="polite">Loading workspace… / Cargando espacio de trabajo…</div>}>
                  <Router />
                </Suspense>
              </main>
            </div>
            <Suspense fallback={null}><PageAssistant key={assistantAccount ?? "signed-out"} /></Suspense>
            </div>
            <DeferredFeedbackWidget />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
        </ConfigProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
