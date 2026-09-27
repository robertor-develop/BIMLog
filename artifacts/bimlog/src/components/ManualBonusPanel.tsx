import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Proposal = { id: string; fingerprint: string; state: string; decision_reason?: string;
  proposal: { makerUserId: number; reason: string; total: { amount: string; currency: string }; entries: Array<{ userId: number; amount: string }> } };
type Data = { actorUserId: number; canPropose: boolean; canReview: boolean; approvableCurrencies: string[]; proposals: Proposal[]; nextCursor: string | null;
  sources: Array<{ id: string; work_item_id: string; work_item_label?: string; currency: string; reserve_amount: string; reserved_amount: string }>;
  recipients: Array<{ id: number; full_name: string }> };
type Props = { projectId: number; token: string | null; language: string };
export function ManualBonusPanel(props: Props) {
  // Remount on authority/context changes. An old in-flight response must never
  // populate the next account/project's form; the key never contains credentials.
  const contextKey = useMemo(() => crypto.randomUUID(), [props.projectId, props.token, props.language]);
  return <ManualBonusContext key={contextKey} {...props}/>;
}
function ManualBonusContext({ projectId, token, language }: Props) {
  const t = (en: string, es: string) => language === "es" ? es : en;
  const endpoint = `${(import.meta.env.VITE_API_URL as string | undefined) ?? ""}/api/v1/projects/${projectId}/financial/apu/bonus-proposals`;
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(""); const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [fundingId, setFunding] = useState(""); const [userId, setUser] = useState("");
  const [amount, setAmount] = useState(""); const [reason, setReason] = useState("");
  const [selected, setSelected] = useState<Proposal | null>(null); const [decisionReason, setDecisionReason] = useState("");
  const retry = useRef<{ content: string; key: string } | null>(null);
  const request = useCallback(async (url: string, body?: unknown, signal?: AbortSignal) => {
    const response = await fetch(url, { method: body === undefined ? "GET" : "POST", signal,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error?.[language] ?? result.error?.en ?? result.code ?? `HTTP ${response.status}`);
    return result;
  }, [token, language]);
  const reload = useCallback(async (signal?: AbortSignal, before?: string) => {
    const result = await request(`${endpoint}${before ? `?before=${encodeURIComponent(before)}` : ""}`, undefined, signal);
    if (!signal?.aborted) { setData(result); setSelected(null); }
  }, [endpoint, request]);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(""); setSelected(null);
    void reload(controller.signal).catch(e => { if (!controller.signal.aborted) setError(String(e.message)); });
    return () => controller.abort();
  }, [reload]);
  const mutate = async (operation: () => Promise<void>, refresh = () => reload()) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await operation(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : t("Request failed. Refresh before retrying.", "La solicitud falló. Actualice antes de reintentar.")); }
    finally { lock.current = false; setBusy(false); }
  };
  const submit = () => mutate(async () => {
    const content = JSON.stringify({ fundingId, reason, entries: [{ userId: Number(userId), amount }] });
    if (retry.current?.content !== content) retry.current = { content, key: crypto.randomUUID() };
    await request(endpoint, { ...JSON.parse(content), idempotencyKey: retry.current.key });
    setMessage(t("Proposal saved. It reserves funds but does not authorize payment.", "Propuesta guardada. Reserva fondos, pero no autoriza pagos."));
    setAmount(""); setReason(""); retry.current = null;
  });
  const decide = (outcome: "approved" | "rejected") => mutate(async () => {
    if (!selected) return;
    await request(`${endpoint}/${encodeURIComponent(selected.id)}/decision`, { outcome, reason: decisionReason, expectedFingerprint: selected.fingerprint });
    setSelected(null); setDecisionReason("");
    setMessage(t("Decision recorded. No payment was made.", "Decisión registrada. No se realizó ningún pago."));
  });
  return <section className="panel manual-bonus" aria-label={t("Manual bonus proposals", "Propuestas manuales de bonos")}>
    <style>{`.manual-bonus{display:grid;gap:12px;min-width:0}.manual-bonus label{display:grid;gap:6px;min-width:0}.manual-bonus select,.manual-bonus textarea{width:100%;min-width:0;box-sizing:border-box;border:1px solid hsl(var(--border));border-radius:8px;padding:10px;background:hsl(var(--background));color:hsl(var(--foreground));font:inherit}.manual-bonus textarea{min-height:88px;resize:vertical}.manual-bonus button{width:max-content;max-width:100%;white-space:normal}.manual-bonus button:disabled{opacity:.5;cursor:not-allowed}.manual-bonus fieldset{min-width:0}.manual-bonus select:focus-visible,.manual-bonus textarea:focus-visible,.manual-bonus button:focus-visible{outline:2px solid #2563eb;outline-offset:2px}.manual-bonus [role=alert]{color:#b91c1c}.manual-bonus [role=status]{color:#15803d}`}</style>
    <h2>{t("Manual bonus proposals", "Propuestas manuales de bonos")}</h2>
    <p>{t("Proposed amounts require independent financial approval. Eligibility estimates are not funding or payments.", "Los importes propuestos requieren aprobación financiera independiente. Las estimaciones de elegibilidad no son fondos ni pagos.")}</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button type="button" disabled={busy} onClick={() => void mutate(async () => {})}>{t("Refresh", "Actualizar")}</button>
    {!data ? <p>{error ? t("Data unavailable.", "Datos no disponibles.") : t("Loading…", "Cargando…")}</p> : <>
      {!data.sources.length && <p>{t("No activated economic reserve is available. A saved performance scenario cannot fund a proposal.", "No existe una reserva económica activada. Un escenario de rendimiento guardado no puede financiar una propuesta.")}</p>}
      {data.canPropose && data.sources.length > 0 && <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <fieldset disabled={busy} style={{ border: 0, padding: 0, display: "grid", gap: 12 }}>
          <label>{t("Funding reserve", "Reserva de fondos")}<select required value={fundingId} onChange={e => setFunding(e.target.value)}><option value="">{t("Select reserve", "Seleccione reserva")}</option>{data.sources.map(source => <option key={source.id} value={source.id}>{source.work_item_label ?? source.work_item_id} · {source.reserve_amount} {source.currency} · {t("Reserved", "Reservado")}: {source.reserved_amount}</option>)}</select></label>
          <label>{t("Recipient", "Beneficiario")}<select required value={userId} onChange={e => setUser(e.target.value)}><option value="">{t("Select recipient", "Seleccione beneficiario")}</option>{data.recipients.map(user => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select></label>
          <label>{t("Amount", "Importe")}<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,6})?" value={amount} onChange={e => setAmount(e.target.value)}/></label>
          <label>{t("Reason", "Motivo")}<textarea required minLength={8} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)}/></label>
          <button type="submit">{t("Submit proposal", "Enviar propuesta")}</button>
        </fieldset>
      </form>}
      {!data.proposals.length && <p>{t("No proposals yet.", "Aún no hay propuestas.")}</p>}
      {data.proposals.map(row => <article key={row.id} style={{ borderTop: "1px solid hsl(var(--border))", padding: "12px 0", overflowWrap: "anywhere" }}>
        <strong>{row.proposal.total.amount} {row.proposal.total.currency} · {({ pending: t("Pending", "Pendiente"), approved: t("Approved — unpaid", "Aprobado — sin pago"), rejected: t("Rejected", "Rechazado") } as Record<string, string>)[row.state]}</strong>
        <p>{row.proposal.reason}</p>{row.proposal.entries.map(entry => <p key={entry.userId}>{data.recipients.find(user => user.id === entry.userId)?.full_name ?? t(`Historical recipient ${entry.userId}`, `Beneficiario histórico ${entry.userId}`)}: {entry.amount}</p>)}
        {row.decision_reason && <p>{row.decision_reason}</p>}
        {row.state === "pending" && (data.canReview || data.approvableCurrencies.includes(row.proposal.total.currency)) && row.proposal.makerUserId !== data.actorUserId && !row.proposal.entries.some(entry => entry.userId === data.actorUserId) && <button disabled={busy} onClick={() => { setSelected(row); setDecisionReason(""); }}>{t("Review", "Revisar")}</button>}
      </article>)}
      {data.nextCursor && <button disabled={busy} onClick={() => void mutate(async () => {}, () => reload(undefined, data.nextCursor!))}>{t("Older proposals", "Propuestas anteriores")}</button>}
      {selected && <fieldset disabled={busy}><legend>{t("Independent decision", "Decisión independiente")} · {selected.proposal.total.amount} {selected.proposal.total.currency}</legend>
        <p>{t("Approval also requires current financial authority and an applicable approval limit.", "La aprobación también requiere autoridad financiera vigente y un límite de aprobación aplicable.")}</p>
        <label>{t("Decision reason", "Motivo de la decisión")}<textarea minLength={8} maxLength={1000} value={decisionReason} onChange={e => setDecisionReason(e.target.value)}/></label>
        <button disabled={decisionReason.trim().length < 8 || !data.approvableCurrencies.includes(selected.proposal.total.currency)} onClick={() => void decide("approved")}>{t("Approve allocation", "Aprobar asignación")}</button>
        <button disabled={decisionReason.trim().length < 8 || !data.canReview} onClick={() => void decide("rejected")}>{t("Reject", "Rechazar")}</button>
        <button onClick={() => setSelected(null)}>{t("Cancel", "Cancelar")}</button>
      </fieldset>}
    </>}
  </section>;
}
