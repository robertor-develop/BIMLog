import { useState } from "react";

type Access = { members: { userId: number; name: string }[]; grants: { userId: number; permission: string; state: string; version: number }[] };
type Props = { projectId: number; contractId: string; api: (path: string, options?: RequestInit) => Promise<any>; tt: (en: string, es: string) => string };

/** Record access complements, but never grants, company financial authority. */
export function ContractRecordAccess({ projectId, contractId, api, tt }: Props) {
  const [data, setData] = useState<Access | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [userId, setUserId] = useState(""), [permission, setPermission] = useState("view"), [state, setState] = useState("active"), [reason, setReason] = useState("");
  const path = `/projects/${projectId}/financial/contracts/${contractId}/grants`;
  const permissions = [["view", tt("View", "Ver")], ["review", tt("Review", "Revisar")], ["approve", tt("Approve", "Aprobar")], ["execute", tt("Execution attestation", "Atestación de ejecución")], ["manage", tt("Manage record access", "Administrar acceso al registro")]];
  const load = async () => {
    setBusy(true); setError(""); setNotice("");
    try { setData(await api(path)); } catch (e) { setData(null); setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      await api(path, { method: "POST", body: JSON.stringify({ userId: Number(userId), permission, state, reason: reason.trim() }) });
      setNotice(tt("Permission saved. Company financial authority and independent approval rules still apply.", "Permiso guardado. Siguen vigentes la autoridad financiera de empresa y la aprobación independiente."));
      setReason("");
      // A manager may revoke their own management access; do not report a successful mutation as failed.
      try { setData(await api(path)); } catch { setData(null); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return <section className="fc-amendment-form" aria-label={tt("Contract record access", "Acceso al registro contractual")}>
    <h4>{tt("Contract record access", "Acceso al registro contractual")}</h4>
    <p>{tt("The record manager grants View first, then the required Review or Approve permission to an existing project member. This does not grant company financial authority or allow self-approval.", "El administrador del registro concede primero Ver y después Revisar o Aprobar a un miembro existente del proyecto. Esto no concede autoridad financiera de empresa ni permite autoaprobación.")}</p>
    <button disabled={busy} onClick={() => void load()}>{tt("Manage contract access", "Administrar acceso al contrato")}</button>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {data && <>
      <div className="fc-form">
        <label>{tt("Project member", "Miembro del proyecto")}<select value={userId} disabled={busy} onChange={e => setUserId(e.target.value)}><option value="">{tt("Select a member", "Seleccione un miembro")}</option>{data.members.map(member => <option key={member.userId} value={member.userId}>{member.name} (#{member.userId})</option>)}</select></label>
        <label>{tt("Record permission", "Permiso del registro")}<select value={permission} disabled={busy} onChange={e => setPermission(e.target.value)}>{permissions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>{tt("Access change", "Cambio de acceso")}<select value={state} disabled={busy} onChange={e => setState(e.target.value)}><option value="active">{tt("Grant", "Conceder")}</option><option value="revoked">{tt("Revoke", "Revocar")}</option></select></label>
        <label>{tt("Reason", "Motivo")}<input value={reason} maxLength={1000} disabled={busy} onChange={e => setReason(e.target.value)}/></label>
      </div>
      <button disabled={busy || !userId || reason.trim().length < 3} onClick={() => void save()}>{tt("Save record permission", "Guardar permiso del registro")}</button>
      <ul>{data.grants.map(grant => <li key={`${grant.userId}-${grant.permission}`}>{data.members.find(member => member.userId === grant.userId)?.name ?? `#${grant.userId}`} · {permissions.find(([value]) => value === grant.permission)?.[1] ?? grant.permission} · {grant.state === "active" ? tt("Active", "Activo") : tt("Revoked", "Revocado")} · v{grant.version}</li>)}</ul>
    </>}
  </section>;
}
