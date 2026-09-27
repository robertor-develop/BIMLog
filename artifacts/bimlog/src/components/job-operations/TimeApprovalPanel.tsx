import { useEffect, useState } from "react";

type Entry = { id: string; status: string; version: number; workDate: string; hours: string; note: string; decisionReason: string | null; userName: string; taskName: string; taskNameEs?: string; canSubmit: boolean; canDecide: boolean };
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
export function TimeApprovalPanel({ projectId, token, lang, onChanged }: { projectId: number; token: string; lang: string; onChanged: () => void }) {
  const tr = (en: string, es: string) => lang === "es" ? es : en;
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(0);
  const [selection, setSelection] = useState<{ entry: Entry; decision: "submit" | "approve" | "reject" } | null>(null);
  const [reason, setReason] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setEntries([]); setSelection(null); setPage(0);
    fetch(`${API_BASE}/api/v1/projects/${projectId}/edt-engine/time-review`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || tr("Unable to load time review.", "No se pudo cargar la revisión de horas.")); return body; })
      .then(body => { if (!controller.signal.aborted) setEntries(body.entries); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [projectId, token, refresh, lang]);
  async function decide() {
    if (!selection || busy || !reason.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/projects/${projectId}/edt-engine/time-entries/${encodeURIComponent(selection.entry.id)}/transition`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ decision: selection.decision, expectedVersion: selection.entry.version, reason: reason.trim() }) });
      const body = await response.json();
      if (!response.ok) {
        const messages: Record<string, string> = {
          TIME_AMOUNT_NOT_SERVER_RESOLVED: tr("This entry needs a priced assignment and an activated contract budget. Ask the project manager to complete them before submitting.", "Este registro necesita una asignación con tarifa y un presupuesto contractual activado. Solicite al responsable del proyecto que los complete antes del envío."),
          TIME_ENTRY_STALE: tr("This entry changed. Refresh the list before trying again.", "Este registro cambió. Actualice la lista antes de intentarlo de nuevo."),
          SELF_APPROVAL_PROHIBITED: tr("An independent authorized reviewer must decide this entry.", "Un revisor autorizado independiente debe decidir este registro."),
          TIME_TRANSITION_INVALID: tr("This action is not available in the entry's current state. Refresh the list.", "Esta acción no está disponible en el estado actual del registro. Actualice la lista."),
        };
        throw new Error(messages[body.code] || tr("The decision could not be saved. Check your access and refresh the list.", "No se pudo guardar la decisión. Verifique su acceso y actualice la lista."));
      }
      setSelection(null); setReason(""); setRefresh(value => value + 1); onChanged();
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("Time decision failed.", "No se pudo guardar la decisión.")); }
    finally { setBusy(false); }
  }
  const statuses: Record<string, string> = { legacy_recorded: tr("Unreviewed", "Sin revisar"), draft: tr("Draft", "Borrador"), submitted: tr("Pending review", "Pendiente de revisión"), approved: tr("Approved", "Aprobadas"), rejected: tr("Rejected", "Rechazadas") };
  return <section className="jo-card" aria-label={tr("Time review", "Revisión de horas")}>
    <h2>{tr("Time review", "Revisión de horas")}</h2>
    <p>{tr("Submit your recorded hours for independent review. This does not approve a payment. Submission requires a priced assignment and an activated contract budget.", "Envíe sus horas registradas a revisión independiente. Esto no aprueba un pago. El envío requiere una asignación con tarifa y un presupuesto contractual activado.")}</p>
    <button disabled={busy} onClick={() => setRefresh(value => value + 1)}>{tr("Refresh time review", "Actualizar revisión de horas")}</button>
    {error && <p role="alert">{error}</p>}
    {loading ? <p>{tr("Loading…", "Cargando…")}</p> : !entries.length ? <p>{tr("No time entries available to your role.", "No hay registros de horas disponibles para su rol.")}</p> : entries.slice(page * 20, (page + 1) * 20).map(entry => <article className="jo-card" key={entry.id}>
      <h3>{entry.userName} — {lang === "es" ? entry.taskNameEs || entry.taskName : entry.taskName}</h3><p>{entry.workDate} · {entry.hours} h · {statuses[entry.status] ?? entry.status}</p>
      <p>{entry.note}</p>{entry.decisionReason && <p>{entry.decisionReason}</p>}
      <div className="jo-actions">{(entry.canSubmit ? ["submit"] as const : entry.canDecide ? ["approve", "reject"] as const : []).map(decision => <button key={decision} disabled={busy} onClick={() => { setSelection({ entry, decision }); setReason(""); }}>{decision === "submit" ? tr("Submit hours", "Enviar horas") : decision === "approve" ? tr("Approve hours", "Aprobar horas") : tr("Reject hours", "Rechazar horas")}</button>)}</div>
      {selection?.entry.id === entry.id && <form onSubmit={event => { event.preventDefault(); void decide(); }}>
        <label>{tr("Reason", "Motivo")}<textarea required maxLength={1000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)}/></label>
        <button type="submit" disabled={busy || !reason.trim()}>{tr("Confirm decision", "Confirmar decisión")}</button>
        <button type="button" disabled={busy} onClick={() => setSelection(null)}>{tr("Cancel", "Cancelar")}</button>
      </form>}
    </article>)}
    {entries.length > 20 && <nav aria-label={tr("Time review pages", "Páginas de revisión de horas")} className="jo-actions">
      <button disabled={busy || page === 0} onClick={() => { setSelection(null); setPage(value => value - 1); }}>{tr("Previous", "Anterior")}</button>
      <span>{page + 1} / {Math.ceil(entries.length / 20)}</span>
      <button disabled={busy || (page + 1) * 20 >= entries.length} onClick={() => { setSelection(null); setPage(value => value + 1); }}>{tr("Next", "Siguiente")}</button>
    </nav>}
    <p>{tr("Shows the latest 500 accessible entries. The owner, recorder and submitter cannot approve their own entry.", "Muestra los últimos 500 registros accesibles. El titular, quien registró las horas y quien las envió no pueden aprobar ese registro.")}</p>
  </section>;
}
