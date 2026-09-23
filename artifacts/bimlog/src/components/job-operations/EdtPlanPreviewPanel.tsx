import { useEffect, useRef, useState } from "react";

type PlanNode = { kind: "project" | "contract" | "deliverable" | "location"; sourceIdentity: string; name: string; code: string };
type PlanWorkItem = { id: string; displayCode: string; tradeIdentity: string; locationIdentity: string };
export type EdtPlanPreview = { nodes: PlanNode[]; workItems: PlanWorkItem[]; sourceFingerprint: string };

export function parseEdtPlanPreview(value: unknown): EdtPlanPreview {
  const input = value as Record<string, unknown> | null;
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
      setPlan(null); setError(cause instanceof Error ? cause.message : String(cause)); setStatus("error");
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
        <div style={{ overflowX: "auto" }}><table className="jo-table"><thead><tr><th>{tt("Work Item code", "Código del elemento")}</th><th>{tt("Trade", "Disciplina")}</th><th>{tt("Location", "Ubicación")}</th></tr></thead>
          <tbody>{plan.workItems.slice(0, 20).map(item => <tr key={item.id}><td>{item.displayCode}</td><td>{item.tradeIdentity}</td><td>{plan.nodes.find(node => node.sourceIdentity === item.locationIdentity)?.name ?? item.locationIdentity}</td></tr>)}</tbody></table></div>
        {plan.workItems.length > 20 && <p className="jo-muted">{tt("Showing the first 20 work items; the full plan remains on the server.", "Se muestran los primeros 20 elementos; el plan completo permanece en el servidor.")}</p>}
      </div>}
    </div>
  </section>;
}
