import { createRoot } from "react-dom/client";
import { useState } from "react";
import { ContractItemBulkEditor } from "./components/job-intake/ContractItemBulkEditor";
import "./index.css";

const item = { id: "CI-BUILD4", name: "Plumbing", plannedHours: "50", billingHourlyRate: "35.47", unit: "Hours", apuPlanVersion: null, workflowTemplate: "generic", contractId: "PRIMARY", budgetSnapshotLineId: "", projectCostNodeId: "", description: "", assumptions: "", exclusions: "" };

function Harness() {
  const [items, setItems] = useState([item]);
  const [destination, setDestination] = useState("Intake");
  const navigate = (next: string) => {
    localStorage.setItem("bimlog:job-intake-active-stage:40", "scope");
    localStorage.setItem("bimlog:job-intake-recovery:40", JSON.stringify({ revision: 3, data: { scopeItems: items } }));
    setDestination(next);
  };
  return <main style={{ maxWidth: 1180, margin: "32px auto", padding: 20 }}>
    <h1>Job Intake — Contract Items</h1>
    <p role="status">Current workspace: {destination}</p>
    <ContractItemBulkEditor
      items={items} setItems={setItems} currency="USD" defaultRate="35.47" defaultApuVersion={null} apuVersions={[]}
      defaultWorkflow="generic" capabilities={{ costValuePlanner: true, budget: true }} contracts={[]} defaultContractId="PRIMARY"
      budgetSnapshotId="" budgetLines={[]} onBudgetSnapshotChange={() => undefined} snapshots={[]}
      onOpenCostValuePlanner={() => navigate("Cost & Value Planner")} onOpenProjectBudget={() => navigate("Project Budget")}
      tt={(en) => en} onError={() => undefined} onNotice={() => undefined}
    />
  </main>;
}

createRoot(document.getElementById("root")!).render(<Harness />);
