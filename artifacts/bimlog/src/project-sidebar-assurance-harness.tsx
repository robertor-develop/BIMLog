import { createRoot } from "react-dom/client";
import { Router as WouterRouter } from "wouter";
import { I18nProvider } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { ProjectSidebar } from "@/components/layout/ProjectSidebar";
import "@/index.css";

const harnessUser = {
  id: 9101,
  email: "sidebar.assurance@bimlog.test",
  fullName: "Sidebar Assurance Reviewer",
  companyName: "BIMLog Fixture Company",
  companyId: 91,
  commercialAccess: true,
  commercialFeatures: {
    package: true,
    budget: true,
    contracts: true,
    cost_value_planner: true,
    team_performance: true,
  },
  createdAt: "2026-09-14T00:00:00.000Z",
};

useAuthStore.persist.setOptions({
  storage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
});
useAuthStore.getState().setAuth("sidebar-assurance-token", harnessUser);

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <WouterRouter>
      <div className="app-shell">
        <ProjectSidebar
          projectId={91}
          projectCode="QA-091"
          projectName="Sidebar assurance project"
          projectDesc="Controlled production-component browser evidence"
          activeTab="command-center"
          isAdmin
          memberRole="project_admin"
        />
        <main className="main-area" data-testid="sidebar-assurance-workspace">
          <div className="page-content">
            <h1>Project Sidebar Assurance</h1>
            <p>The adjacent navigation is the actual production ProjectSidebar component.</p>
          </div>
        </main>
      </div>
    </WouterRouter>
  </I18nProvider>,
);
