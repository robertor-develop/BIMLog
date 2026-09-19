import { createRoot } from "react-dom/client";
import { Router as WouterRouter } from "wouter";
import { I18nProvider } from "@/lib/i18n";
import { useAuthStore } from "@/store/auth";
import { Navbar } from "@/components/layout/Navbar";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import { RouteState } from "@/components/layout/RouteState";
import "@/index.css";

const user = { id: 9001, email: "shell.assurance@bimlog.test", fullName: "Shell Assurance Reviewer", companyName: "BIMLog Fixture Company", companyId: 91, role: "super_admin", isSuperAdmin: true, createdAt: "2026-09-19T00:00:00.000Z" };
useAuthStore.persist.setOptions({ storage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } });
useAuthStore.getState().setAuth("shell-assurance-token", user);

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes("/access-profile")) return Response.json({ decisions: { project_administration: { allow: true }, company_catalogs: { allow: true }, total_control: { allow: true } } });
  if (url.includes("/notifications")) return Response.json([]);
  if (url.includes("/company-profile")) return Response.json({ companyName: "BIMLog Fixture Company", logoUrl: null });
  if (url.includes("/users/me") || url.includes("/auth/me")) return Response.json(user);
  return originalFetch(input, init);
};

function Workspace() {
  const state = new URLSearchParams(window.location.search).get("state") ?? "dashboard";
  if (state === "denied") return <RouteState kind="denied" code="ASSURANCE_DENIED" />;
  if (state === "error") return <RouteState kind="error" code="ASSURANCE_UNAVAILABLE" onRetry={() => undefined} />;
  return <section className="phasea-surface" aria-labelledby="assurance-title">
    <div className="phasea-page-hero"><div><h1 id="assurance-title">{state === "admin" ? "Project Administration" : "BIMLog Headquarters"}</h1><p>Actual production global shell with controlled non-production evidence content.</p></div><span className="phasea-scope-pill">{state === "admin" ? "Administration" : "Headquarters"}</span></div>
    <div className="phasea-card"><div className="phasea-card-title">Current workspace</div><div className="phasea-card-subtitle">Responsive shell, navigation, preferences, focus and route-state evidence.</div></div>
  </section>;
}

createRoot(document.getElementById("root")!).render(<I18nProvider><WouterRouter><Navbar/><div className="app-shell"><MasterSidebar/><main id="main-content" tabIndex={-1} className="main-area"><div className="page-content"><Workspace/></div></main></div></WouterRouter></I18nProvider>);
