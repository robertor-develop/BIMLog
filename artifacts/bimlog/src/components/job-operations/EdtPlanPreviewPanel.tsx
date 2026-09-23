import { useEffect, useRef, useState } from "react";

type PlanNode = { kind: "project" | "contract" | "deliverable" | "location"; sourceIdentity: string; name: string; code: string };
type PlanWorkItem = { id: string; displayCode: string; tradeIdentity: string; locationIdentity: string };
export type EdtPlanPreview = { nodes: PlanNode[]; workItems: PlanWorkItem[]; sourceFingerprint: string; activationEvidence?: {
  workflowCount: number; governanceVerified: true; commercialVerified: true;
} };

export function describeEdtPreviewError(cause: unknown, tt: (english: string, spanish: string) => string): string {
  const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code ?? "") : "";
  if (code === "EDT_CONTRACT_SOURCE_MISSING" || code === "EDT_CONTRACT_SOURCE_MISMATCH")
    return tt("This activated Intake has no verifiable canonical Contract version. Existing work is unchanged; complete the Contract source before using the EDT preview.",
      "Este ingreso activado no tiene una versión verificable del contrato canónico. El trabajo existente no cambió; complete el contrato de origen antes de usar la vista EDT.");
  if (code === "EDT_LOCATION_AMBIGUOUS" || code === "EDT_PLAN_COVERAGE_MISMATCH")
    return tt("This Intake needs exactly one saved floor or area Work Package for each Work Item before an EDT plan can be projected.",
      "Este ingreso necesita exactamente un paquete de trabajo de piso o área guardado por cada elemento de trabajo antes de proyectar el plan EDT.");
  if (code === "EDT_TRADE_SOURCE_MISMATCH" || code === "EDT_SOURCE_AMBIGUOUS")
    return tt("This Intake is missing a verifiable saved discipline or scope identity. Check its original Work Packages and company catalog; no records were changed.",
      "Este ingreso no tiene una identidad verificable de disciplina o alcance guardada. Revise los paquetes originales y el catálogo de la empresa; no se cambió ningún registro.");
  if (code === "EDT_WORKFLOW_SOURCE_MISSING" || code === "EDT_WORKFLOW_SOURCE_MISMATCH")
    return tt("An activated Work Item is missing a verifiable Delivery Workflow. Check its saved workflow binding before previewing EDT.",
      "Un elemento activado no tiene un flujo de entrega verificable. Revise su vínculo guardado antes de ver la EDT.");
  if (code === "EDT_GOVERNANCE_SOURCE_MISSING" || code === "EDT_ACTIVATION_SOURCE_INCOMPLETE")
    return tt("The activated Intake lacks a complete frozen Governance, Contract, or Workflow source for EDT. Review its saved configuration; no records were changed.",
      "El ingreso activado no tiene un origen congelado y completo de Gobernanza, Contrato o Flujo para la EDT. Revise la configuración guardada; no se cambió ningún registro.");
  if (code === "INTAKE_NOT_FOUND" || code === "PROJECT_COMPANY_MISMATCH" || code === "ACTIVE_PROJECT_ROLE_REQUIRED")
    return tt("This Intake is unavailable in your current project or role. Reopen the correct project or ask its administrator to check access.",
      "Este ingreso no está disponible en su proyecto o rol actual. Abra el proyecto correcto o pida al administrador revisar el acceso.");
  return cause instanceof Error && cause.message && cause.message !== "The request failed." && cause.message !== "La solicitud falló."
    ? cause.message : tt("EDT preview is unavailable. Refresh and try again; no records were changed.",
      "La vista EDT no está disponible. Actualice e intente de nuevo; no se cambió ningún registro.");
}

export function parseEdtPlanPreview(value: unknown): EdtPlanPreview {
  const envelope = value as Record<string, unknown> | null;
  const input = (envelope?.plan && typeof envelope.plan === "object" ? envelope.plan : value) as Record<string, unknown> | null;
  if (!input || !Array.isArray(input.nodes) || !Array.isArray(input.workItems) ||
    typeof input.sourceFingerprint !== "string" || !/^[a-f0-9]{64}$/.test(input.sourceFingerprint))
    throw new Error("The EDT preview response is incomplete.");
  const nodes = input.nodes as PlanNode[];
  const workItems = input.workItems as PlanWorkItem[];
  if (!nodes.length || !workItems.length || nodes.some(node => !node || !["project", "contract", "deliverable", "location"].includes(node.kind) ||
    typeof node.sourceIdentity !== "string" || !node.sourceIdentity || typeof node.name !== "string" || !node.name || typeof node.code !== "string" || !node.code) ||
    workItems.some(item => !item || typeof item.id !== "string" || !item.id || typeof item.displayCode !== "string" || !item.displayCode ||
      typeof item.tradeIdentity !== "string" || !item.tradeIdentity || typeof item.locationIdentity !== "string" || !item.locationIdentity ||
      !nodes.some(node => node.kind === "location" && node.sourceIdentity === item.locationIdentity)))
    throw new Error("The EDT preview response is incomplete.");
  if (envelope?.plan) {
    if (envelope.sourceFingerprint !== input.sourceFingerprint || typeof envelope.governanceVersionId !== "string" ||
      !/^activated-governance:[a-f0-9]{64}$/.test(envelope.governanceVersionId) ||
      typeof envelope.pricingVersionId !== "string" || !/^activated-commercial:[a-f0-9]{64}$/.test(envelope.pricingVersionId) ||
      !Array.isArray(envelope.workflowVersionIds) || envelope.workflowVersionIds.length !== workItems.length ||
      envelope.workflowVersionIds.some(id => typeof id !== "string" || !/^activated-workflow:[a-f0-9]{64}$/.test(id)))
      throw new Error("The EDT activation candidate is incomplete.");
    return { nodes, workItems, sourceFingerprint: input.sourceFingerprint,
      activationEvidence: { workflowCount: envelope.workflowVersionIds.length, governanceVerified: true, commercialVerified: true } };
  }
  return { nodes, workItems, sourceFingerprint: input.sourceFingerprint };
}

export function EdtPlanPreviewPanel({ projectId, intakeId, loadPlan, tt }: {
  projectId: number;
  intakeId: string;
  loadPlan: () => Promise<unknown>;
  tt: (english: string, spanish: string) => string;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [plan, setPlan] = useState<EdtPlanPreview | null>(null);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => { generation.current += 1; setStatus("idle"); setPlan(null); setError("");
    return () => { generation.current += 1; }; }, [projectId, intakeId]);
  const preview = async () => {
    const current = ++generation.current;
    setStatus("loading"); setError("");
    try {
      const next = parseEdtPlanPreview(await loadPlan());
      if (current !== generation.current) return;
      setPlan(next); setStatus("ready");
    } catch (cause) {
      if (current !== generation.current) return;
      setPlan(null); setError(describeEdtPreviewError(cause, tt)); setStatus("error");
    }
  };
  return <section className="jo-card" aria-labelledby="edt-preview-title">
    <div className="jo-item-head">
      <div><h2 id="edt-preview-title">{tt("EDT plan preview", "Vista previa del plan EDT")}</h2>
        <p className="jo-muted">{tt("Read-only projection from the saved, activated Intake. Preview does not approve, allocate money, or change work.",
          "Proyección de solo lectura del ingreso activado y guardado. La vista previa no aprueba, asigna dinero ni cambia el trabajo.")}</p></div>
      <button type="button" disabled={status === "loading"} onClick={() => void preview()} aria-controls="edt-preview-result" aria-expanded={status === "ready"}>
        {status === "loading" ? tt("Checking…", "Verificando…") : tt("Check EDT readiness", "Verificar preparación EDT")}
      </button>
    </div>
    <div id="edt-preview-result">
      {status === "loading" && <p role="status">{tt("Verifying saved source records…", "Verificando registros guardados…")}</p>}
      {status === "error" && <p className="jo-error" role="alert">{error}</p>}
      {status === "ready" && plan && <div role="status">
        <p>{tt("Verified read-only preview", "Vista previa verificada de solo lectura")}: {plan.nodes.length} {tt("nodes", "nodos")}, {plan.workItems.length} {tt("work items", "elementos de trabajo")}.</p>
        {plan.activationEvidence && <p className="jo-muted">{tt("Frozen Governance and Commercial sources verified; Delivery Workflow bindings", "Orígenes congelados de Gobernanza y Comercial verificados; vínculos de flujo de entrega")}: {plan.activationEvidence.workflowCount}. {tt("Governed EDT activation is not yet enabled.", "La activación gobernada de la EDT aún no está habilitada.")}</p>}
        <div style={{ overflowX: "auto" }}><table className="jo-table"><thead><tr><th>{tt("Work Item code", "Código del elemento")}</th><th>{tt("Trade", "Disciplina")}</th><th>{tt("Location", "Ubicación")}</th></tr></thead>
          <tbody>{plan.workItems.slice(0, 20).map(item => <tr key={item.id}><td>{item.displayCode}</td><td>{item.tradeIdentity}</td><td>{plan.nodes.find(node => node.sourceIdentity === item.locationIdentity)?.name ?? item.locationIdentity}</td></tr>)}</tbody></table></div>
        {plan.workItems.length > 20 && <p className="jo-muted">{tt("Showing the first 20 work items; the full plan remains on the server.", "Se muestran los primeros 20 elementos; el plan completo permanece en el servidor.")}</p>}
      </div>}
    </div>
  </section>;
}
