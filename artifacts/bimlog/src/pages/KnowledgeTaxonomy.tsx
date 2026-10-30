import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useAuthStore } from '@/store/auth';
import { useI18n } from '@/lib/i18n';

const base = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const kinds = ['discipline', 'category', 'element_type', 'stage', 'tag'] as const;
type Kind = typeof kinds[number];
type Term = { id: string; company_id: number; kind: Kind; revision: number; status: 'active' | 'retired'; code: string; label: string; created_at: string; updated_by_id: number };
export function KnowledgeTaxonomy() {
  const { token } = useAuthStore(), { tt } = useI18n();
  const [caps, setCaps] = useState<string[] | null>(null), [companyId, setCompanyId] = useState<number | null>(null);
  const [terms, setTerms] = useState<Term[]>([]), [kind, setKind] = useState<Kind>('discipline'), [filter, setFilter] = useState('');
  const [code, setCode] = useState(''), [label, setLabel] = useState(''), [selected, setSelected] = useState<Term | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [reload, setReload] = useState(0);
  const write = useRef<AbortController | null>(null); const read = useRef<AbortController | null>(null);
  const resetForm = () => { setSelected(null); setCode(''); setLabel(''); };
  useEffect(() => { setCaps(null); setCompanyId(null); setTerms([]); resetForm(); setBusy(false); setNotice(''); return () => { read.current?.abort(); write.current?.abort(); }; }, [token]);
  useEffect(() => {
    const controller = new AbortController(); read.current = controller; setLoading(true); setError('');
    void (async () => { try {
      const headers = { Authorization: `Bearer ${token}` };
      const capResponse = await fetch(`${base}/api/v1/coordination-knowledge/capabilities`, { headers, signal: controller.signal });
      const capBody = await capResponse.json(); if (!capResponse.ok) throw new Error(capBody.code || String(capResponse.status));
      if (!Array.isArray(capBody.capabilities) || !Number.isSafeInteger(capBody.companyId)) throw new Error('INVALID_CAPABILITY_RESPONSE');
      const response = await fetch(`${base}/api/v1/coordination-knowledge/taxonomy`, { headers, signal: controller.signal });
      const body = await response.json(); if (!response.ok) throw new Error(body.code || String(response.status));
      if (!Array.isArray(body.items) || body.items.some((item: Term) => item.company_id !== capBody.companyId || !Number.isSafeInteger(item.revision))) throw new Error('INVALID_TAXONOMY_RESPONSE');
      if (!controller.signal.aborted) { setCaps(capBody.capabilities); setCompanyId(capBody.companyId); setTerms(body.items); }
    } catch (caught) { if (!controller.signal.aborted) setError(String(caught instanceof Error ? caught.message : caught)); }
    finally { if (!controller.signal.aborted) setLoading(false); } })();
    return () => controller.abort();
  }, [token, reload]);
  async function mutate(retire: boolean) {
    if (busy || loading || !caps || (retire ? !selected || !caps.includes('retire') : !caps.includes('manage_taxonomy'))) return;
    const controller = new AbortController(); write.current = controller; setBusy(true); setError(''); setNotice('');
    try {
      const suffix = selected ? `/${encodeURIComponent(selected.id)}${retire ? '/retire' : ''}` : '';
      const response = await fetch(`${base}/api/v1/coordination-knowledge/taxonomy${suffix}`, { method: retire || !selected ? 'POST' : 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(retire ? { expectedRevision: selected!.revision } : { kind: selected?.kind ?? kind, code: code.trim(), label: label.trim(), ...(selected ? { expectedRevision: selected.revision } : {}) }), signal: controller.signal });
      const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.code || String(response.status));
      if (body.item?.company_id !== companyId || !Number.isSafeInteger(body.item?.revision) || (selected && (body.item.term_id !== selected.id || body.item.revision !== selected.revision + 1))) throw new Error('INVALID_TAXONOMY_RECEIPT');
      if (!controller.signal.aborted) { setNotice(`${tt('Saved revision', 'Revisión guardada')} ${body.item.revision} · ${body.item.status} · ${body.item.term_id}`); resetForm(); setReload(value => value + 1); }
    } catch (caught) { if (!controller.signal.aborted) setError(`${String(caught instanceof Error ? caught.message : caught)} — ${tt('Reload the saved list before retrying; another user may have revised this term.', 'Recargue la lista guardada antes de reintentar; otro usuario puede haber revisado el término.')}`); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  const names: Record<Kind, string> = { discipline: tt('Discipline', 'Disciplina'), category: tt('Category', 'Categoría'), element_type: tt('Element type', 'Tipo de elemento'), stage: tt('Stage', 'Etapa'), tag: tt('Tag', 'Etiqueta') };
  return <main id="main-content" tabIndex={-1} style={{ maxWidth: 1100, margin: 'auto', padding: '24px clamp(16px,4vw,40px)' }}>
    <Link href="/knowledge">{tt('Open knowledge library', 'Abrir biblioteca de conocimiento')}</Link>
    <h1>{tt('Company Knowledge Taxonomy', 'Taxonomía de conocimiento de empresa')}</h1>
    <p>{tt('Maintain the shared terms used to classify coordination knowledge. Administrators create and revise terms; retirement preserves history. Reload before editing a stale revision.', 'Mantenga los términos compartidos para clasificar el conocimiento de coordinación. Los administradores crean y revisan términos; el retiro conserva el historial. Recargue antes de editar una revisión desactualizada.')}</p>
    {companyId !== null && <p>{tt('Current company ID', 'ID de empresa actual')}: {companyId}</p>}
    <button disabled={busy || loading} onClick={() => { resetForm(); setReload(value => value + 1); }}>{tt('Reload saved terms', 'Recargar términos guardados')}</button>
    {loading && <p role="status">{tt('Loading saved taxonomy…', 'Cargando taxonomía guardada…')}</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <p><label>{tt('Filter terms', 'Filtrar términos')} <input value={filter} onChange={event => setFilter(event.target.value)}/></label></p>
    {!loading && !error && terms.length === 0 && <p>{tt('No saved terms. A company knowledge administrator can create the first term.', 'No hay términos guardados. Un administrador de conocimiento puede crear el primero.')}</p>}
    <ul>{terms.filter(term => `${term.code} ${term.label} ${term.kind}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase())).map(term => <li key={term.id}>
      <strong>{term.code} — {term.label}</strong> · {names[term.kind]} · {term.status} · {tt('Revision', 'Revisión')} {term.revision}
      <p>{tt('Saved by', 'Guardado por')} {term.updated_by_id} · {term.created_at}</p>
      {term.status === 'active' && (caps?.includes('manage_taxonomy') || caps?.includes('retire')) && <button disabled={busy || loading} onClick={() => { setSelected(term); setKind(term.kind); setCode(term.code); setLabel(term.label); setNotice(''); }}>{tt('Select term and actions', 'Seleccionar término y acciones')}</button>}
    </li>)}</ul>
    {caps && !caps.includes('manage_taxonomy') && <p>{tt('Your role can read terms. Editing requires company taxonomy management permission.', 'Su rol puede consultar términos. La edición requiere permiso de administración de taxonomía.')}</p>}
    {(caps?.includes('manage_taxonomy') || selected) && <section><h2>{selected ? tt('Selected term', 'Término seleccionado') : tt('Create term', 'Crear término')}</h2>
      <form onSubmit={event => { event.preventDefault(); void mutate(false); }} style={{ display: 'grid', gap: 12, maxWidth: 550 }}>
        <label>{tt('Kind', 'Tipo')} <select value={selected?.kind ?? kind} disabled={!!selected || busy || !caps?.includes('manage_taxonomy')} onChange={event => setKind(event.target.value as Kind)}>{kinds.map(value => <option key={value} value={value}>{names[value]}</option>)}</select></label>
        <label>{tt('Code', 'Código')} <input required maxLength={64} pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}" value={code} disabled={busy || !caps?.includes('manage_taxonomy')} onChange={event => setCode(event.target.value)}/></label>
        <label>{tt('Label', 'Nombre')} <input required maxLength={160} value={label} disabled={busy || !caps?.includes('manage_taxonomy')} onChange={event => setLabel(event.target.value)}/></label>
        {caps?.includes('manage_taxonomy') && <button disabled={busy || loading || !code.trim() || !label.trim()}>{busy ? tt('Saving…', 'Guardando…') : tt('Save term', 'Guardar término')}</button>}
        {selected && <><p>{tt('Expected revision', 'Revisión esperada')}: {selected.revision}</p><button type="button" disabled={busy} onClick={resetForm}>{tt('Cancel selection', 'Cancelar selección')}</button></>}
      </form>
      {selected && caps?.includes('retire') && <details><summary>{tt('Retire selected term', 'Retirar término seleccionado')}</summary><p>{tt('The term becomes historical and cannot be edited afterward. Existing records remain preserved.', 'El término pasa al historial y no se podrá editar. Se conservan los registros existentes.')}</p><button disabled={busy || loading} onClick={() => void mutate(true)}>{tt('Confirm retirement', 'Confirmar retiro')}</button></details>}
    </section>}
  </main>;
}
