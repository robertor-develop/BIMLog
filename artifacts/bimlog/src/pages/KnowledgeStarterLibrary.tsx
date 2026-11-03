import React, { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type Candidate = { code: string; name?: string; title?: string; description?: string; guidance?: string; [key: string]: unknown };
type Preview = {
  seedKey: string; displayName: string; fingerprint: string;
  provenance: { source: string; preparedFor: string; preparedAt: string; synthetic: true; professionalApproval: string };
  counts: { conflictTypes: number; rules: number; resolutionMethods: number };
  items: { conflictTypes: Candidate[]; rules: Candidate[]; resolutionMethods: Candidate[] };
};
type Receipt = { companyId: number; seedKey: string; fingerprint: string; status: "imported" | "idempotent_noop"; created: Preview["counts"]; existing: Preview["counts"] };

export function StarterPreview({ preview, es }: { preview: Preview; es: boolean }) {
  return <section aria-label={es ? "Contenido inicial" : "Starter content"}>
    <h2>{preview.displayName}</h2>
    <p>{preview.provenance.source} · {preview.provenance.preparedFor} · {preview.provenance.preparedAt}</p>
    <p>{es ? "Contenido sintético sin revisión profesional. La importación crea borradores; no aprueba ni publica conocimiento." : "Synthetic content without professional review. Import creates drafts; it does not approve or publish knowledge."}</p>
    <p style={{ overflowWrap: "anywhere" }}>{es ? "Huella del contenido" : "Content fingerprint"}: {preview.fingerprint}</p>
    {([['conflictTypes', 'Conflict types', 'Tipos de conflicto'], ['rules', 'Rules', 'Reglas'], ['resolutionMethods', 'Resolution methods', 'Métodos de resolución']] as const).map(([key, en, spanish]) => <section key={key}>
      <h3>{es ? spanish : en} ({preview.counts[key]})</h3>
      <ul>{preview.items[key].map(item => <li key={item.code}><details><summary>{item.code} — {item.name || item.title}</summary>
        <p>{item.description || item.guidance}</p>
        <dl>{Object.entries(item).filter(([field]) => !['code','name','title','description','guidance'].includes(field)).map(([field, value]) => <React.Fragment key={field}><dt>{field}</dt><dd style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{Array.isArray(value) ? value.join('; ') : String(value ?? '—')}</dd></React.Fragment>)}</dl>
      </details></li>)}</ul>
    </section>)}
  </section>;
}

export function KnowledgeStarterLibrary() {
  const { token } = useAuthStore(); const { lang, tt } = useI18n(); const es = lang === 'es';
  const [preview, setPreview] = useState<Preview | null>(null), [caps, setCaps] = useState<string[] | null>(null);
  const [companyId, setCompanyId] = useState<number | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false), [receipt, setReceipt] = useState<Receipt | null>(null);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setPreview(null); setCaps(null); setCompanyId(null); setError(''); setConfirmed(false); setReceipt(null); setBusy(false);
    const read = async (path: string) => { const response = await fetch(`${base}/api/v1/coordination-knowledge/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }); const body = await response.json(); if (!response.ok) throw new Error(body.code || String(response.status)); return body; };
    void (async () => { try {
      const capability = await read('capabilities'); if (controller.signal.aborted) return;
      if (!Array.isArray(capability.capabilities) || !Number.isSafeInteger(capability.companyId)) throw new Error('INVALID_CAPABILITY_RESPONSE');
      setCaps(capability.capabilities); setCompanyId(capability.companyId);
      if (!capability.capabilities.includes('view_draft')) return;
      const body = await read('starter-library/bimtech');
      if (!body.seedKey || !/^[a-f0-9]{64}$/.test(body.fingerprint) || !body.items || !body.provenance || !['conflictTypes','rules','resolutionMethods'].every(key => Array.isArray(body.items[key]) && body.items[key].length === body.counts?.[key])) throw new Error('INVALID_STARTER_PREVIEW');
      if (!controller.signal.aborted) setPreview(body);
    } catch (caught) { if (!controller.signal.aborted) setError(String(caught instanceof Error ? caught.message : caught)); } })();
    return () => { controller.abort(); mutation.current?.abort(); };
  }, [token, retry]);
  async function importDrafts() {
    if (!preview || !confirmed || !caps?.includes('manage_taxonomy') || busy) return;
    const controller = new AbortController(); mutation.current = controller; setBusy(true); setError(''); setReceipt(null);
    try {
      const response = await fetch(`${base}/api/v1/coordination-knowledge/starter-library/bimtech/import`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedFingerprint: preview.fingerprint }), signal: controller.signal });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.code || String(response.status));
      if (body.result?.companyId !== companyId || body.result?.fingerprint !== preview.fingerprint || body.result?.seedKey !== preview.seedKey || !['imported','idempotent_noop'].includes(body.result?.status) || !body.result?.created || !body.result?.existing) throw new Error('INVALID_IMPORT_RECEIPT');
      if (!controller.signal.aborted) { setReceipt(body.result); setConfirmed(false); }
    } catch (caught) { if (!controller.signal.aborted) setError(String(caught instanceof Error ? caught.message : caught)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <main id="main-content" tabIndex={-1} style={{ maxWidth: 1100, margin: 'auto', padding: '24px clamp(16px,4vw,40px)' }}>
    <Link href="/knowledge">{tt('Open knowledge library', 'Abrir biblioteca de conocimiento')}</Link>
    <h1>{tt('BIMTECH Starter Library', 'Biblioteca inicial BIMTECH')}</h1>
    <p>{tt('Preview candidate knowledge, then import drafts into your current company. A knowledge administrator reviews the drafts in the library before submitting them for professional approval. Existing records are preserved.', 'Revise el contenido candidato e importe borradores a su empresa actual. Un administrador revisa los borradores en la biblioteca antes de solicitar aprobación profesional. Los registros existentes se conservan.')}</p>
    {companyId !== null && <p>{tt('Current company ID', 'ID de empresa actual')}: {companyId}</p>}
    {caps === null && !error && <p role="status">{tt('Loading permissions…', 'Cargando permisos…')}</p>}
    {caps !== null && !caps.includes('view_draft') && <p role="status">{tt('Your role cannot preview draft starter knowledge. Ask your company knowledge administrator for access.', 'Su rol no puede consultar el contenido inicial en borrador. Solicite acceso al administrador de conocimiento de su empresa.')}</p>}
    {caps?.includes('view_draft') && !preview && !error && <p role="status">{tt('Loading starter preview…', 'Cargando vista previa…')}</p>}
    {error && <p role="alert">{error} <button disabled={busy} onClick={() => setRetry(value => value + 1)}>{tt('Reload preview and check library before retrying', 'Recargar vista previa y revisar biblioteca antes de reintentar')}</button></p>}
    {preview && <><StarterPreview preview={preview} es={es}/>
      {caps?.includes('manage_taxonomy') ? <section><h2>{tt('Import draft candidates', 'Importar candidatos en borrador')}</h2>
        <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)}/>{tt('I reviewed this content and the current company. Import as unapproved drafts.', 'Revisé el contenido y la empresa actual. Importar como borradores sin aprobar.')}</label>
        <p><button disabled={!confirmed || busy} onClick={() => void importDrafts()}>{busy ? tt('Importing…', 'Importando…') : tt('Import drafts', 'Importar borradores')}</button></p>
      </section> : <p>{tt('Preview only: your role cannot import. A company knowledge administrator can import these drafts.', 'Solo consulta: su rol no puede importar. Un administrador de conocimiento puede importar estos borradores.')}</p>}
    </>}
    {receipt && <section role="status"><h2>{receipt.status === 'idempotent_noop' ? tt('Already imported — existing records preserved', 'Ya importado — registros existentes conservados') : tt('Draft import saved', 'Importación de borradores guardada')}</h2>
      <p>{tt('Created conflict types / rules / methods', 'Tipos de conflicto / reglas / métodos creados')}: {receipt.created.conflictTypes} / {receipt.created.rules} / {receipt.created.resolutionMethods}</p>
      <p>{tt('Existing conflict types / rules / methods preserved', 'Tipos de conflicto / reglas / métodos existentes conservados')}: {receipt.existing.conflictTypes} / {receipt.existing.rules} / {receipt.existing.resolutionMethods}</p>
      <p>{tt('Server receipt', 'Comprobante del servidor')}: {receipt.seedKey} · {receipt.companyId} · {receipt.status}</p>
      <Link href="/knowledge">{tt('Review saved drafts in the library', 'Revisar borradores guardados en la biblioteca')}</Link>
    </section>}
  </main>;
}
