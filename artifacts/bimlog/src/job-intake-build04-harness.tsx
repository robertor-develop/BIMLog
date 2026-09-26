import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ContractItemBulkEditor } from "./components/job-intake/ContractItemBulkEditor";
import "./index.css";
import workspaceSource from "./pages/JobIntakeWorkspace.tsx?raw";
if (!import.meta.env.DEV || !["localhost", "127.0.0.1"].includes(location.hostname)) throw new Error("Local fixture only");
const workspaceCss = workspaceSource.match(/const css = `([\s\S]*?)`;/)?.[1];
if (!workspaceCss) throw new Error("Actual Intake styles unavailable");

const item = { id: "CI-BUILD4", name: "Plumbing", plannedHours: "50", billingHourlyRate: "35.47", unit: "Hours", apuPlanVersion: null, workflowTemplate: "generic", contractId: "PRIMARY", budgetSnapshotLineId: "", projectCostNodeId: "", description: "", assumptions: "", exclusions: "" };

function Harness() {
  const [items, setItems] = useState([{ ...item, deliverableType: "SHOP_DRAWING", deliveryWorkflowVersionId: "TEST-retired" }]);
  const [spanish, setSpanish] = useState(false);
  const [destination, setDestination] = useState("Intake");
  const navigate = (next: string) => {
    localStorage.setItem("bimlog:job-intake-active-stage:40", "scope");
    localStorage.setItem("bimlog:job-intake-recovery:40", JSON.stringify({ revision: 3, data: { scopeItems: items } }));
    setDestination(next);
  };
  return <main className="ji" style={{ maxWidth: 1180, margin: "32px auto", padding: 20 }}>
    <style>{workspaceCss}</style>
    <h1>Job Intake — Contract Items</h1>
    <p>Local actual component; synthetic records, not production acceptance.</p>
    <button onClick={() => setSpanish(value => !value)}>English / Español</button>
    <p role="status">Current workspace: {destination}</p>
    <ContractItemBulkEditor
      items={items} setItems={setItems} currency="USD" defaultRate="35.47" defaultApuVersion={null} apuVersions={[]}
      defaultWorkflow="generic" capabilities={{ costValuePlanner: true, budget: true }} contracts={[]} defaultContractId="PRIMARY"
      deliveryWorkflowMode="approved_only" deliveryWorkflowOptions={[{ versionId: "TEST-current", name: "TEST current workflow", source: "company", version: 2, definition: { deliverableTypes: ["SHOP_DRAWING"], phases: [{ name: "TEST current phase", tasks: [] }] } }]}
      budgetSnapshotId="" budgetLines={[]} onBudgetSnapshotChange={() => undefined} snapshots={[]}
      onOpenCostValuePlanner={() => navigate("Cost & Value Planner")} onOpenProjectBudget={() => navigate("Project Budget")}
      tt={(en, es) => spanish ? es : en} onError={() => undefined} onNotice={() => undefined}
    />
  </main>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
