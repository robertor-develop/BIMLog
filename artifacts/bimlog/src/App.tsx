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
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
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
