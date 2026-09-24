import { useCallback, useEffect, useState } from "react";

type Assignment = { userId: number; fullName: string; email: string; projectRole: string; active: boolean };
type Response = { projectId: number; assignments: Assignment[] };
type Translate = (english: string, spanish: string) => string;

export function EdtDirectorAssignmentPanel({ projectId, api, tt }: {
  projectId: number;
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  tt: Translate;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setStatus("loading"); setError("");
    try {
      const response = await api(`/projects/${projectId}/edt-engine/operations-director-grants`) as Response;
      if (response.projectId !== projectId || !Array.isArray(response.assignments) ||
          response.assignments.some(row => !Number.isSafeInteger(row.userId) || !row.fullName || !row.email || typeof row.active !== "boolean"))
        throw new Error(tt("Assignment response is incomplete.", "La respuesta de asignaciones está incompleta."));
      setAssignments(response.assignments); setStatus("ready");
    } catch (cause) {
      setAssignments([]); setError(cause instanceof Error ? cause.message : tt("Assignments are unavailable.", "Las asignaciones no están disponibles."));
      setStatus("error");
    }
  }, [api, projectId, tt]);
  useEffect(() => { void load(); }, [load]);
  return <section className="jo-card" aria-labelledby="edt-director-title">
    <div className="jo-item-head"><div>
      <h2 id="edt-director-title">{tt("EDT approval authority", "Autoridad de aprobación EDT")}</h2>
      <p className="jo-muted">{tt("A Super Administrator assigns one project member to independent Operations Director review. This does not activate the EDT.",
        "Un Superadministrador asigna a un miembro del proyecto para la revisión independiente como Director de Operaciones. Esto no activa la EDT.")}</p>
    </div><button type="button" onClick={() => void load()} disabled={status === "loading"}>
      {tt("Refresh assignments", "Actualizar asignaciones")}</button></div>
    {status === "loading" && <p role="status">{tt("Loading eligible members…", "Cargando miembros elegibles…")}</p>}
    {status === "error" && <p role="alert" className="jo-error">{error}</p>}
    {status === "ready" && !assignments.length && <p className="jo-empty">{tt("No active same-company project members are eligible.", "No hay miembros activos de la misma empresa elegibles en este proyecto.")}</p>}
    {status === "ready" && assignments.length > 0 && <div style={{ overflowX: "auto" }}><table className="jo-table">
      <thead><tr><th>{tt("Project member", "Miembro del proyecto")}</th><th>{tt("Project role", "Rol del proyecto")}</th><th>{tt("EDT approval", "Aprobación EDT")}</th></tr></thead>
      <tbody>{assignments.map(row => <tr key={row.userId}><td>{row.fullName}<br/><span className="jo-muted">{row.email}</span></td>
        <td>{row.projectRole}</td><td>{row.active ? tt("Assigned", "Asignado") : tt("Not assigned", "Sin asignar")}</td></tr>)}</tbody>
    </table></div>}
  </section>;
}
