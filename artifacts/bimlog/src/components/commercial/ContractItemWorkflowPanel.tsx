import { useEffect, useState } from "react";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type WorkflowNode = { id: string; parentId: string | null; type: "phase" | "revision" | "version" | "task"; name: string; sequence: number; status: string; dueDate: string | null; assigneeUserId: number | null; revision: number; children: WorkflowNode[] };
type Props = { projectId: number; contractId: string; stableLineId: string; displayName: string; token: string; language: string; tt: (en: string, es: string) => string };

const styles = `.ciw{margin-top:12px;padding:14px;border:1px solid #a9c7e8;border-radius:10px;background:#f7fbff}.ciw-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.ciw-head h4,.ciw-head p{margin:0}.ciw-head p{margin-top:4px;font-size:12px;color:#526273}.ciw-tree{display:grid;gap:10px;margin-top:14px}.ciw-node{padding:10px;border-left:4px solid #5b8bc2;border-radius:6px;background:#fff;box-shadow:0 1px 2px rgba(15,35,55,.08)}.ciw-node[data-type=revision]{margin-left:18px;border-color:#7c6bc4}.ciw-node[data-type=version]{margin-left:36px;border-color:#c0803d}.ciw-node[data-type=task]{margin-left:54px;border-color:#4b9a66}.ciw-row{display:flex;align-items:center;justify-content:space-between;gap:10px}.ciw-label{display:flex;gap:8px;align-items:center}.ciw-label small{padding:2px 6px;border-radius:99px;background:#e9f1f9;color:#38536d}.ciw-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.ciw button,.ciw select{padding:6px 8px;border:1px solid #bdc9d6;border-radius:6px;background:#fff}.ciw button.primary{background:#1d5ca8;color:#fff;border-color:#1d5ca8}.ciw-empty{margin-top:12px;padding:12px;border-radius:8px;background:#eef6ff;color:#334e68}.ciw-error{margin-top:10px;color:#b42318}@media(max-width:700px){.ciw-head,.ciw-row{display:block}.ciw-actions{margin-top:8px}.ciw-node[data-type]{margin-left:0}}`;
const childType: Record<WorkflowNode["type"], WorkflowNode["type"] | null> = { phase: "revision", revision: "version", version: "task", task: null };
const typeLabel = (type: WorkflowNode["type"], tt: Props["tt"]) => ({ phase: tt("Phase", "Fase"), revision: tt("Revision", "Revisión"), version: tt("Internal Version", "Versión interna"), task: tt("Task", "Tarea") })[type];

export function ContractItemWorkflowPanel({ projectId, contractId, stableLineId, displayName, token, language, tt }: Props) {
  const [data, setData] = useState<any>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const base = `/projects/${projectId}/financial/contracts/${encodeURIComponent(contractId)}/items/${encodeURIComponent(stableLineId)}/workflow`;
  const request = async (path = "", options?: RequestInit) => {
    const response = await fetch(`${API_BASE}/api/v1${base}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options?.headers ?? {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.[language] ?? body?.error?.en ?? tt("Workflow request failed.", "Falló la solicitud del flujo."));
    return body;
  };
  const load = async () => { setBusy(true); setError(""); try { setData(await request()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };
  useEffect(() => { void load(); }, [projectId, contractId, stableLineId, token, language]);
  const initialize = async () => { setBusy(true); setError(""); try { setData(await request("/initialize", { method: "POST", body: "{}" })); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); } };
  const add = async (type: WorkflowNode["type"], parentId: string | null) => {
    const name = window.prompt(tt(`Name for new ${typeLabel(type, tt)}`, `Nombre de nueva ${typeLabel(type, tt)}`));
    if (!name?.trim()) return;
    setBusy(true); setError("");
    try { setData(await request("/nodes", { method: "POST", body: JSON.stringify({ nodeType: type, parentId, name: name.trim() }) })); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const changeStatus = async (node: WorkflowNode, status: string) => {
    setBusy(true); setError("");
    try { setData(await request(`/nodes/${encodeURIComponent(node.id)}`, { method: "PATCH", body: JSON.stringify({ expectedRevision: node.revision, status }) })); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const renderNode = (node: WorkflowNode) => <div key={node.id}>
    <div className="ciw-node" data-type={node.type}><div className="ciw-row"><div className="ciw-label"><small>{typeLabel(node.type, tt)}</small><strong>{node.name}</strong></div><div className="ciw-actions"><select disabled={busy} value={node.status} onChange={(event) => void changeStatus(node, event.target.value)}><option value="not_started">{tt("Not started", "No iniciado")}</option><option value="in_progress">{tt("In progress", "En progreso")}</option><option value="blocked">{tt("Blocked", "Bloqueado")}</option><option value="complete">{tt("Complete", "Completo")}</option><option value="cancelled">{tt("Cancelled", "Cancelado")}</option></select>{childType[node.type] && <button disabled={busy} onClick={() => void add(childType[node.type]!, node.id)}>+ {typeLabel(childType[node.type]!, tt)}</button>}</div></div></div>
    {node.children.map(renderNode)}
  </div>;
  return <section className="ciw"><style>{styles}</style><div className="ciw-head"><div><h4>{tt("Contract Item Workflow", "Flujo de la Partida de Contrato")}: {displayName}</h4><p>{tt("Execution follows Phase → Revision → Internal Version → Task. Adding execution detail never creates additional budget.", "La ejecución sigue Fase → Revisión → Versión interna → Tarea. Agregar detalle de ejecución nunca crea presupuesto adicional.")}</p></div>{data?.workflow && <button disabled={busy} onClick={() => void add("phase", null)}>+ {tt("Phase", "Fase")}</button>}</div>
    {!data?.workflow && !busy && <div className="ciw-empty"><p>{tt("This Contract Item has a frozen APU and value, but its execution workflow has not been initialized.", "Esta Partida tiene APU y valor congelados, pero su flujo de ejecución aún no se ha iniciado.")}</p><button className="primary" onClick={() => void initialize()}>{tt("Initialize workflow", "Iniciar flujo")}</button></div>}
    {busy && !data && <div className="ciw-empty">{tt("Loading workflow…", "Cargando flujo…")}</div>}
    {data?.workflow && <div className="ciw-tree">{data.nodes.map(renderNode)}</div>}
    {error && <div className="ciw-error">{error}</div>}
  </section>;
}
