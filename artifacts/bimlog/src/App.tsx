import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
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
import { ProjectDetail } from "@/pages/ProjectDetail";
import { SetupGuide } from "@/pages/SetupGuide";
import { Profile } from "@/pages/Profile";
import { Privacy } from "@/pages/Privacy";
import { Terms } from "@/pages/Terms";
import { Disclaimer } from "@/pages/Disclaimer";
import { DataRetention } from "@/pages/DataRetention";
import { ResetPasswordPage } from "@/pages/ResetPassword";
import { AdminPanel } from "@/pages/AdminPanel";
import { Pricing } from "@/pages/Pricing";
import { About } from "@/pages/About";
import { Contact } from "@/pages/Contact";
import { Features } from "@/pages/Features";
import NotFound from "@/pages/not-found";
import { Navbar } from "@/components/layout/Navbar";

const queryClient = new QueryClient();

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

function Router() {
  const [location] = useLocation();
  // Track last visited project ID so MasterSidebar can link to it
  if (typeof window !== "undefined") {
    const m = location.match(/^\/projects\/(\d+)/);
    if (m) localStorage.setItem("bimlog-last-project-id", m[1]);
  }
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/reset-password" component={ResetPasswordPage} />

      {/* Legal pages — public */}
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/disclaimer" component={Disclaimer} />
      <Route path="/data-retention" component={DataRetention} />

      {/* Protected Routes */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/projects/:id/:tab?">
        {() => <ProtectedRoute component={ProjectDetail} />}
      </Route>
      <Route path="/setup-guide" component={SetupGuide} />
      <Route path="/profile">
        {() => <ProtectedRoute component={Profile} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminPanel} />}
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
      <I18nProvider>
        <ConfigProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <div className="min-h-screen flex flex-col bg-background selection:bg-primary/30 text-foreground font-sans">
              <Navbar />
              <main className="flex-1">
                <Router />
              </main>
            </div>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
        </ConfigProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
