import { useCallback, useEffect, useState } from "react";

type Assignment = { userId: number; fullName: string; email: string; projectRole: string; active: boolean };
type Response = { projectId: number; assignments: Assignment[] };
type Translate = (english: string, spanish: string) => string;

export function EdtDirectorAssignmentPanel({ projectId, currentUserId, api, tt }: {
  projectId: number;
  currentUserId: number;
  api: (path: string, init?: RequestInit) => Promise<unknown>;
  tt: Translate;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [action, setAction] = useState<{ userId: number; kind: "grant" | "revoke" } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setStatus("loading"); setError("");
    try {
      const response = await api(`/projects/${projectId}/edt-engine/operations-director-grants`) as Response;
      if (response.projectId !== projectId || !Array.isArray(response.assignments) ||
          response.assignments.some(row => !Number.isSafeInteger(row.userId) || !row.fullName || !row.email || typeof row.active !== "boolean"))
        throw new Error(tt("Assignment response is incomplete.", "La respuesta de asignaciones está incompleta."));
      setAssignments(response.assignments); setStatus("ready"); return true;
    } catch (cause) {
      setAssignments([]); setError(cause instanceof Error ? cause.message : tt("Assignments are unavailable.", "Las asignaciones no están disponibles."));
      setStatus("error"); return false;
    }
  }, [api, projectId, tt]);
  useEffect(() => { void load(); }, [load]);
  const submit = async () => {
    if (!action || reason.trim().length < 10 || reason.trim().length > 2000) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await api(`/projects/${projectId}/edt-engine/operations-director-grants`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: action.kind, targetUserId: action.userId, reason: reason.trim() }),
      });
      setAction(null); setReason("");
      if (await load()) setNotice(tt("EDT approval authority saved and refreshed.", "Autoridad de aprobación EDT guardada y actualizada."));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tt("The assignment could not be saved.", "No se pudo guardar la asignación."));
    } finally { setSaving(false); }
  };
  return <section className="jo-card" aria-labelledby="edt-director-title">
    <div className="jo-item-head"><div>
      <h2 id="edt-director-title">{tt("EDT approval authority", "Autoridad de aprobación EDT")}</h2>
      <p className="jo-muted">{tt("A Super Administrator assigns one project member to independent Operations Director review. This does not activate the EDT.",
        "Un Superadministrador asigna a un miembro del proyecto para la revisión independiente como Director de Operaciones. Esto no activa la EDT.")}</p>
    </div><button type="button" onClick={() => void load()} disabled={status === "loading"}>
      {tt("Refresh assignments", "Actualizar asignaciones")}</button></div>
    {status === "loading" && <p role="status">{tt("Loading eligible members…", "Cargando miembros elegibles…")}</p>}
    {status === "error" && <p role="alert" className="jo-error">{error}</p>}
    {status !== "error" && error && <p role="alert" className="jo-error">{error}</p>}
    {notice && <p role="status" className="jo-ok">{notice}</p>}
    {status === "ready" && !assignments.length && <p className="jo-empty">{tt("No active same-company project members are eligible.", "No hay miembros activos de la misma empresa elegibles en este proyecto.")}</p>}
    {status === "ready" && assignments.length > 0 && <div style={{ overflowX: "auto" }}><table className="jo-table">
      <thead><tr><th>{tt("Project member", "Miembro del proyecto")}</th><th>{tt("Project role", "Rol del proyecto")}</th><th>{tt("EDT approval", "Aprobación EDT")}</th><th>{tt("Action", "Acción")}</th></tr></thead>
      <tbody>{assignments.map(row => <tr key={row.userId}><td>{row.fullName}<br/><span className="jo-muted">{row.email}</span></td>
        <td>{row.projectRole}</td><td>{row.active ? tt("Assigned", "Asignado") : tt("Not assigned", "Sin asignar")}</td>
        <td><button type="button" disabled={saving || row.userId === currentUserId} title={row.userId === currentUserId ? tt("Self-assignment is prohibited", "La autoasignación está prohibida") : undefined}
          onClick={() => { setAction({ userId: row.userId, kind: row.active ? "revoke" : "grant" }); setReason(""); setError(""); setNotice(""); }}>
          {row.active ? tt("Revoke", "Revocar") : tt("Assign", "Asignar")}</button></td></tr>)}</tbody>
    </table></div>}
    {action && <div className="jo-sub" role="group" aria-labelledby="edt-director-confirm-title">
      <h3 id="edt-director-confirm-title">{action.kind === "grant" ? tt("Confirm independent approver", "Confirmar aprobador independiente") : tt("Confirm revocation", "Confirmar revocación")}</h3>
      <p>{assignments.find(row => row.userId === action.userId)?.fullName}</p>
      <label>{tt("Reason for audit history (10–2000 characters)", "Motivo para el historial de auditoría (10–2000 caracteres)")}
        <textarea value={reason} minLength={10} maxLength={2000} onChange={event => setReason(event.target.value)} /></label>
      <div className="jo-actions"><button type="button" className="primary" disabled={saving || reason.trim().length < 10} onClick={() => void submit()}>
        {saving ? tt("Saving…", "Guardando…") : tt("Confirm change", "Confirmar cambio")}</button>
        <button type="button" disabled={saving} onClick={() => { setAction(null); setReason(""); setError(""); }}>
          {tt("Cancel", "Cancelar")}</button></div>
    </div>}
  </section>;
}
