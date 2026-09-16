import { createRoot } from "react-dom/client";
import { useState } from "react";
import { I18nProvider, useI18n } from "./lib/i18n";
import { CompanyMasterCatalogsTab } from "./components/admin/CompanyMasterCatalogsTab";
import { ProjectControlsDashboard } from "./components/job-operations/ProjectControlsDashboard";
import "./index.css";

// Browser-only fixture: imports the production components; never enters the production build.
const catalogEntries = {
  client: [{ id: "client-1", code: "BIMTECH", name: "BIMTech Corp", state: "active", version: 1 }],
  discipline: [{ id: "discipline-1", code: "MECH", name: "Mechanical", state: "active", version: 1 }],
  service: [{ id: "service-1", code: "SHOP", name: "Shop Drawings", state: "active", version: 1 }],
  phase: [{ id: "phase-1", code: "PRE", name: "Preliminary", state: "active", version: 1 }],
};
type CatalogState = "pmo" | "read-only" | "denied" | "empty" | "loading";
let catalogState: CatalogState = "pmo";
const baseFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const path = String(input);
  if (!path.includes("/api/v1/company/master-catalogs/")) return baseFetch(input, init);
  if (catalogState === "loading") return new Promise<Response>(() => undefined);
  const kind = path.split("/").pop()?.split("?")[0];
  if (catalogState === "denied") return Response.json({ code: "FORBIDDEN" }, { status: 403 });
  if (kind === "capabilities") return Response.json({ companyId: 1, canManage: catalogState !== "read-only", isSuperAdmin: false, mode: "approved_only", policyVersion: 1 });
  if (kind && kind in catalogEntries && (!init?.method || init.method === "GET")) return Response.json({ entries: catalogState === "empty" ? [] : catalogEntries[kind as keyof typeof catalogEntries] });
  return Response.json({ error: "Fixture is read-only" }, { status: 403 });
};

const controls = { enabled: true, budgetVisible: true, valueVisible: true, rows: [
  { id: "scope-1", name: "Floor 1", plannedHours: "100", actualHours: "20", progressPercent: 25, plannedInternalCost: "1000", actualInternalCost: "200", earnedInternalValue: "250", plannedBillableValue: "2000", earnedBillableValue: "400", status: "warning", overduePackages: 0, blockedPackages: 0 },
  { id: "scope-2", name: "Floor 2", plannedHours: "80", actualHours: "0", progressPercent: 0, plannedInternalCost: "800", actualInternalCost: "0", earnedInternalValue: "0", plannedBillableValue: "1600", earnedBillableValue: "0", status: "not_started", overduePackages: 0, blockedPackages: 0 },
] };
const tasks = [
  { id: "task-1", workItemId: "scope-1", plannedHours: "40", progressPercent: 50, status: "in_progress" },
  { id: "task-2", workItemId: "scope-1", plannedHours: "60", progressPercent: 0, status: "not_started" },
  { id: "task-3", workItemId: "scope-2", plannedHours: "80", progressPercent: 0, status: "not_started" },
];
const assignments = [
  { id: "a-1", taskId: "task-1", workItemId: "scope-1", userId: 7, plannedHours: "40", actualHours: "10", plannedInternalCost: "400", internalHourlyRate: "10", plannedBillableValue: "800", billingHourlyRate: "20" },
  { id: "a-2", taskId: "task-2", workItemId: "scope-1", userId: 8, plannedHours: "60", actualHours: "0", plannedInternalCost: "600", internalHourlyRate: "10", plannedBillableValue: "1200", billingHourlyRate: "20" },
  { id: "a-3", taskId: "task-3", workItemId: "scope-2", userId: 8, plannedHours: "80", actualHours: "0", plannedInternalCost: "800", internalHourlyRate: "10", plannedBillableValue: "1600", billingHourlyRate: "20" },
];
const packages = [
  { id: "wp-1", workItemId: "scope-1", packageCode: "WP-01", title: "Floor 1 shop", status: "active" },
  { id: "wp-2", workItemId: "scope-1", packageCode: "WP-02", title: "Floor 1 coordination", status: "active" },
  { id: "wp-3", workItemId: "scope-2", packageCode: "WP-03", title: "Floor 2 shop", status: "active" },
];
const packageTasks = [{ packageId: "wp-1", taskId: "task-1" }, { packageId: "wp-2", taskId: "task-2" }, { packageId: "wp-3", taskId: "task-3" }];

function Harness() {
  const { language, setLanguage } = useI18n();
  const [view, setView] = useState<"catalogs" | "controls">("catalogs");
  const [mode, setMode] = useState<CatalogState>("pmo");
  const [controlMode, setControlMode] = useState<"full" | "redacted" | "empty">("full");
  const chooseCatalogState = (next: CatalogState) => { catalogState = next; setMode(next); setView("catalogs"); };
  return <main style={{ maxWidth: 1300, margin: "0 auto", padding: 16 }}>
    <h1>Production-component acceptance fixture</h1>
    <nav style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
      <button onClick={() => setView("catalogs")}>Catalogs</button>
      <button onClick={() => setView("controls")}>Project Controls</button>
      <button onClick={() => setLanguage(language === "en" ? "es" : "en")}>Language: {language}</button>
    </nav>
    {view === "catalogs" ? <>
      <nav aria-label="Catalog test states" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>{(["pmo", "read-only", "denied", "empty", "loading"] as const).map(next => <button key={next} aria-pressed={mode === next} onClick={() => chooseCatalogState(next)}>{next}</button>)}</nav>
      <CompanyMasterCatalogsTab key={mode} token="fixture" spanish={language === "es"} />
    </> : <>
      <nav aria-label="Controls test states" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>{(["full", "redacted", "empty"] as const).map(next => <button key={next} aria-pressed={controlMode === next} onClick={() => setControlMode(next)}>{next}</button>)}</nav>
      <ProjectControlsDashboard key={controlMode} controls={{ ...controls, rows: controlMode === "empty" ? [] : controls.rows, budgetVisible: controlMode !== "redacted", valueVisible: controlMode !== "redacted" }} members={[{ id: 7, fullName: "Lorena" }, { id: 8, fullName: "Ruben" }]} packages={packages} tasks={tasks} assignments={assignments} workItems={[{ id: "scope-1", billingHourlyRate: 20 }, { id: "scope-2", billingHourlyRate: 20 }]} packageTasks={packageTasks} projectId={1} token={null} />
    </>}
  </main>;
}
createRoot(document.getElementById("root")!).render(<I18nProvider><Harness /></I18nProvider>);
