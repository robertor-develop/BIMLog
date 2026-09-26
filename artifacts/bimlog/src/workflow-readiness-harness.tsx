import { createRoot } from "react-dom/client";
import { useState } from "react";
import { CompanyDeliveryWorkflowsTab } from "./components/admin/CompanyDeliveryWorkflowsTab";
import "./index.css";
if (!import.meta.env.DEV || !["localhost", "127.0.0.1"].includes(location.hostname)) throw new Error("Local fixture only");
let failure = false;
const definition = { schemaVersion: 1, deliverableTypes: ["SHOP_DRAWING"], roles: { execute: "PRODUCER", review: "REVIEWER", approve: "APPROVER" }, phases: [{ id: "produce", code: "PROD", name: "TEST Production", order: 1, tasks: [{ id: "task", code: "TASK", name: "TEST task", order: 1, requiredDocuments: [] }], completionRule: "all_tasks_complete", qcRequired: false, approvalRequired: false }], transitions: [], reopen: { role: "approve", reasonRequired: true } };
const rows = ["draft", "approved", "published", "superseded", "retired"].map((state, i) => ({ id: "TEST", templateId: "TEST", code: "TEST", name: "TEST workflow", versionId: state, version: i + 1, state, revision: 1, definition, createdAt: "2026-09-26", reviewEligibility: { eligible: false, code: "DELIVERY_WORKFLOW_SELF_APPROVAL_DENIED" } }));
window.fetch = async input => {
  const path = String(input);
  if (failure) return Response.json({ error: { en: "TEST unavailable", es: "TEST no disponible" } }, { status: 503 });
  if (path.endsWith("/delivery-workflows/options")) return Response.json({ mode: "approved_only", options: [{ source: "company", versionId: "published", activationBlock: null }] });
  if (path.endsWith("/delivery-workflows")) return Response.json({ canManage: false, versions: rows });
  if (path.endsWith("/delivery-workflows/TEST")) return Response.json({ versions: rows, history: [] });
  throw new Error(`Unexpected fixture request: ${path}`);
};
function Harness() {
  const [spanish, setSpanish] = useState(true);
  const [key, setKey] = useState(0);
  return <main style={{ padding: 16 }}><p>Local actual component — synthetic transport, NOT production acceptance</p>
    <button onClick={() => setSpanish(value => !value)}>English / Español</button>
    <button onClick={() => { failure = !failure; setKey(value => value + 1); }}>Toggle failed load</button>
    <CompanyDeliveryWorkflowsTab key={key} token="synthetic" spanish={spanish} />
  </main>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
