import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";
import { MasterSidebar } from "@/components/layout/MasterSidebar";
import "./CompanyPricingTemplates.css";

const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type Node = {
  id: string; label: string; method: "fixed_amount" | "quantity_unit_cost" | "hours_hourly_rate";
  amount?: string; quantity?: string; unitCost?: string; hours?: string; hourlyRate?: string;
};
type Definition = { schemaVersion: 1; currency: string; industry: string; name: string; nodes: Node[] };
type Version = { templateId: string; versionId: string; version: number; status: string; provenance: { code: string; definition: Definition }; createdById?: number; publishedById?: number };
const initial: Definition = { schemaVersion: 1, currency: "USD", industry: "BIM Services", name: "", nodes: [{ id: "labor", label: "Labor", method: "hours_hourly_rate", hours: "1", hourlyRate: "0" }] };

export function CompanyPricingTemplates() {
  const { token } = useAuthStore();
  const { lang } = useI18n();
  const [, setLocation] = useLocation();
  const es = lang === "es";
  const t = (en: string, spanish: string) => es ? spanish : en;
  const statusText = (status: string) => status === "published" ? t("Published", "Publicada")
    : status === "retired" ? t("Retired", "Retirada") : t("Draft", "Borrador");
  const [items, setItems] = useState<Version[]>([]);
  const [selected, setSelected] = useState<Version | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [definition, setDefinition] = useState<Definition>(initial);
  const definitionRef = useRef(definition);
  definitionRef.current = definition;
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{ total: string; currency: string; lines: unknown[] } | null>(null);
  const [history, setHistory] = useState<Version[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmingRetire, setConfirmingRetire] = useState(false);
  const original = selected ? { code: selected.provenance.code, definition: selected.provenance.definition } : { code: "", definition: initial };
  const hasUnsavedChanges = JSON.stringify({ code, definition }) !== JSON.stringify(original);
  const confirmDiscard = () => !hasUnsavedChanges || window.confirm(t("Discard unsaved pricing changes?", "¿Descartar los cambios de precios sin guardar?"));

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsavedChanges]);
  useEffect(() => { setPreview(null); }, [definition]);

  const request = useCallback(async (path: string, method = "GET", body?: object) => {
    const response = await fetch(`${base}/api/v1${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(response.status === 403
      ? t("You do not have company permission to view pricing templates.", "No tiene permiso de la empresa para ver las plantillas de precios.")
      : payload.code || t("Request failed", "La solicitud falló"));
    return payload;
  }, [token, lang]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError("");
    try {
      const payload = await request("/company/pricing-templates");
      setItems(payload.templates ?? []); setCanManage(payload.canManage === true); setListError(false);
    } catch (cause) { setItems([]); setCanManage(false); setSelected(null); setHistory([]); setCode(""); setDefinition(initial); setPreview(null); setConfirmingRetire(false); setListError(true); setError((cause as Error).message); }
    finally { setLoading(false); }
  }, [request, token]);
  useEffect(() => { void reload(); }, [reload]);

  const open = async (item: Version) => {
    if (!confirmDiscard()) return;
    setBusy(true); setError(""); setNotice(""); setPreview(null); setConfirmingRetire(false);
    try {
      const payload = await request(`/company/pricing-templates/${encodeURIComponent(item.templateId)}`);
      const versions = payload.versions as Version[];
      const latest = versions[0];
      setHistory(versions); setSelected(latest); setCode(latest.provenance.code);
      setDefinition(latest.provenance.definition); setReason("");
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };
  const newTemplate = () => { if (!confirmDiscard()) return; setSelected(null); setHistory([]); setCode(""); setDefinition(initial); setReason(""); setPreview(null); setConfirmingRetire(false); setError(""); setNotice(""); };
  const updateNode = (index: number, patch: Partial<Node>) => setDefinition(current => ({ ...current,
    nodes: current.nodes.map((node, position) => position === index ? { ...node, ...patch } : node) }));
  const changeMethod = (index: number, method: Node["method"]) => setDefinition(current => ({ ...current,
    nodes: current.nodes.map((node, position) => position !== index ? node : method === "fixed_amount"
      ? { id: node.id, label: node.label, method, amount: node.amount ?? "0" }
      : method === "quantity_unit_cost"
        ? { id: node.id, label: node.label, method, quantity: node.quantity ?? "1", unitCost: node.unitCost ?? "0" }
        : { id: node.id, label: node.label, method, hours: node.hours ?? "1", hourlyRate: node.hourlyRate ?? "0" }) }));
  const run = async (action: "preview" | "save" | "publish" | "retire") => {
    setBusy(true); setError(""); setNotice("");
    try {
      if (action === "preview") {
        const submitted = JSON.stringify(definition);
        const result = await request("/company/pricing-templates/preview", "POST", { definition });
        if (JSON.stringify(definitionRef.current) === submitted) setPreview(result);
        return;
      }
      if (!reason.trim()) throw new Error(t("Enter a reason for the audit history.", "Indique un motivo para el historial de auditoría."));
      if (action === "retire") {
        if (!selected || selected.status !== "published") throw new Error(t("Select the current published version.", "Seleccione la versión publicada vigente."));
        await request(`/company/pricing-templates/${encodeURIComponent(selected.templateId)}/retire`, "POST", { expectedVersion: selected.version, reason });
        setConfirmingRetire(false);
        setNotice(t("Retired in a new immutable version. Existing contract history is preserved.", "Retirada en una nueva versión inmutable. Se conserva el historial de los contratos existentes."));
      } else if (action === "publish") {
        if (!selected || selected.status !== "draft") throw new Error(t("Select the latest draft.", "Seleccione el último borrador."));
        await request(`/company/pricing-templates/${encodeURIComponent(selected.templateId)}/publish`, "POST", { expectedVersion: selected.version, reason });
        setNotice(t("Published as a new immutable version.", "Publicado como una nueva versión inmutable."));
      } else if (selected) {
        await request(`/company/pricing-templates/${encodeURIComponent(selected.templateId)}/versions`, "POST", { expectedVersion: selected.version, reason, definition });
        setNotice(t("New draft version saved.", "Nueva versión borrador guardada."));
      } else {
        await request("/company/pricing-templates", "POST", { code, reason, definition });
        setNotice(t("Draft created.", "Borrador creado."));
      }
      const list = await request("/company/pricing-templates");
      setItems(list.templates ?? []);
      const refreshed = (list.templates as Version[]).find(row => row.templateId === selected?.templateId || (!selected && row.provenance?.code === code.trim().toUpperCase()));
      if (refreshed) {
        const detail = await request(`/company/pricing-templates/${encodeURIComponent(refreshed.templateId)}`);
        setHistory(detail.versions); setSelected(detail.versions[0]); setCode(detail.versions[0].provenance.code); setDefinition(detail.versions[0].provenance.definition);
      }
      setReason(""); setPreview(null);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  };

  if (!token) return null;
  return <div className="company-pricing-page" style={{ display: "flex", minHeight: "100vh", minWidth: 0 }}>
    <MasterSidebar />
    <main className="company-pricing-main" style={{ flex: 1, minWidth: 0, padding: "clamp(16px,3vw,36px)" }}>
      <button type="button" onClick={() => { if (confirmDiscard()) setLocation("/dashboard"); }}>{t("Back to Headquarters", "Volver a la Sede")}</button>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", margin: "20px 0" }}>
        <div><h1>{t("APU / Pricing Templates", "Plantillas APU / Precios")}</h1><p>{t("Company pricing definitions. Commercial remains the source of contract prices.", "Definiciones de precios de la empresa. Comercial sigue siendo la fuente de precios contractuales.")}</p></div>
        <button type="button" onClick={newTemplate} disabled={!canManage || busy}>{t("New template", "Nueva plantilla")}</button>
      </header>
      {loading && <p role="status">{t("Loading pricing templates…", "Cargando plantillas de precios…")}</p>}
      {error && <div role="alert" style={{ color: "#991B1B", padding: 12, border: "1px solid #FCA5A5" }}>{error} <button type="button" onClick={() => void reload()}>{t("Retry", "Reintentar")}</button></div>}
      {notice && <p role="status" style={{ color: "#166534" }}>{notice}</p>}
      {!loading && !listError && <div className="company-pricing-layout" style={{ display: "grid", gap: 20 }}>
        <section aria-label={t("Template list", "Lista de plantillas")} style={{ minWidth: 0 }}>
          <h2>{t("Company templates", "Plantillas de empresa")}</h2>
          {!items.length && <p>{t("No pricing templates yet.", "Todavía no hay plantillas de precios.")}</p>}
          {items.map(item => <button type="button" key={item.templateId} onClick={() => void open(item)} style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8, padding: 12, border: selected?.templateId === item.templateId ? "2px solid #2563EB" : "1px solid #CBD5E1", borderRadius: 8, background: "white" }}>
            <strong>{item.provenance.code} · {item.provenance.definition.name}</strong><br />v{item.version} · {statusText(item.status)}
          </button>)}
        </section>
        <section aria-label={t("Template editor", "Editor de plantilla")} style={{ minWidth: 0 }}>
          <h2>{selected ? t("Template version", "Versión de plantilla") + ` v${selected.version}` : t("New pricing template", "Nueva plantilla de precios")}</h2>
          {!canManage && <p>{t("Read-only. Company PMO permission is required to edit.", "Solo lectura. Se requiere permiso PMO de la empresa para editar.")}</p>}
          <div className="company-pricing-fields" style={{ display: "grid", gap: 10 }}>
            <label>{t("Code", "Código")}<input value={code} disabled={!canManage || !!selected} onChange={event => setCode(event.target.value)} /></label>
            <label>{t("Name", "Nombre")}<input value={definition.name} disabled={!canManage} onChange={event => setDefinition(current => ({ ...current, name: event.target.value }))} /></label>
            <label>{t("Industry", "Industria")}<input value={definition.industry} disabled={!canManage} onChange={event => setDefinition(current => ({ ...current, industry: event.target.value }))} /></label>
            <label>{t("Currency", "Moneda")}<input value={definition.currency} maxLength={3} disabled={!canManage} onChange={event => setDefinition(current => ({ ...current, currency: event.target.value.toUpperCase() }))} /></label>
            <h3>{t("Price components", "Componentes de precio")}</h3>
            {definition.nodes.map((node, index) => <fieldset key={index} style={{ border: "1px solid #CBD5E1", borderRadius: 8, padding: 12 }} disabled={!canManage}>
              <legend>{t("Component", "Componente")} {index + 1}</legend>
              <label>{t("Stable ID", "ID estable")}<input value={node.id} onChange={event => updateNode(index, { id: event.target.value })} /></label>
              <label>{t("Label", "Nombre")}<input value={node.label} onChange={event => updateNode(index, { label: event.target.value })} /></label>
              <label>{t("Calculation", "Cálculo")}<select value={node.method} onChange={event => changeMethod(index, event.target.value as Node["method"])}>
                <option value="fixed_amount">{t("Fixed amount", "Monto fijo")}</option><option value="quantity_unit_cost">{t("Quantity × unit cost", "Cantidad × costo unitario")}</option><option value="hours_hourly_rate">{t("Hours × hourly rate", "Horas × tarifa")}</option>
              </select></label>
              {node.method === "fixed_amount" && <label>{t("Amount", "Monto")}<input inputMode="decimal" value={node.amount ?? ""} onChange={event => updateNode(index, { amount: event.target.value })} /></label>}
              {node.method === "quantity_unit_cost" && <><label>{t("Quantity", "Cantidad")}<input inputMode="decimal" value={node.quantity ?? ""} onChange={event => updateNode(index, { quantity: event.target.value })} /></label><label>{t("Unit cost", "Costo unitario")}<input inputMode="decimal" value={node.unitCost ?? ""} onChange={event => updateNode(index, { unitCost: event.target.value })} /></label></>}
              {node.method === "hours_hourly_rate" && <><label>{t("Hours", "Horas")}<input inputMode="decimal" value={node.hours ?? ""} onChange={event => updateNode(index, { hours: event.target.value })} /></label><label>{t("Hourly rate", "Tarifa por hora")}<input inputMode="decimal" value={node.hourlyRate ?? ""} onChange={event => updateNode(index, { hourlyRate: event.target.value })} /></label></>}
              <button type="button" onClick={() => setDefinition(current => ({ ...current, nodes: current.nodes.filter((_, position) => position !== index) }))} disabled={definition.nodes.length <= 1}>{t("Remove component", "Quitar componente")}</button>
            </fieldset>)}
            {canManage && <button type="button" onClick={() => setDefinition(current => ({ ...current, nodes: [...current.nodes, { id: `line${current.nodes.length + 1}`, label: "", method: "fixed_amount", amount: "0" }] }))}>{t("Add component", "Agregar componente")}</button>}
            {canManage && <label>{t("Reason for audit history", "Motivo para el historial de auditoría")}<textarea value={reason} onChange={event => setReason(event.target.value)} /></label>}
            {selected?.status === "retired" && <p role="status">{t("Retired: unavailable for new contracts. Earlier contracts keep their exact historical reference. To publish a replacement, save a revised definition for separate review.", "Retirada: no está disponible para contratos nuevos. Los contratos anteriores conservan su referencia histórica exacta. Para publicar un reemplazo, guarde una definición revisada para otra revisión.")}</p>}
            {hasUnsavedChanges && canManage && <p role="status" className="company-pricing-unsaved">{t("Unsaved changes. Save a new draft before leaving or publishing.", "Cambios sin guardar. Guarde un nuevo borrador antes de salir o publicar.")}</p>}
            {canManage && <div className="company-pricing-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" disabled={busy} onClick={() => void run("preview")}>{t("Preview", "Vista previa")}</button><button className="company-pricing-primary" type="button" disabled={busy} onClick={() => void run("save")}>{t("Save new draft version", "Guardar nueva versión borrador")}</button><button type="button" disabled={busy || hasUnsavedChanges || selected?.status !== "draft"} onClick={() => void run("publish")}>{t("Publish (different PMO user with Finance approval)", "Publicar (otro usuario PMO con aprobación financiera)")}</button><button type="button" disabled={busy || hasUnsavedChanges || selected?.status !== "published"} onClick={() => setConfirmingRetire(true)}>{t("Retire (Finance approval required)", "Retirar (requiere aprobación financiera)")}</button></div>}
            {confirmingRetire && selected?.status === "published" && <div className="company-pricing-retire-confirm" role="group" aria-label={t("Confirm template retirement", "Confirmar retiro de plantilla")}><p>{t("Retire this template from all future selections? Existing contract references remain unchanged. A different PMO user with Finance approval is required.", "¿Retirar esta plantilla de futuras selecciones? Las referencias de contratos existentes permanecen sin cambios. Se requiere otro usuario PMO con aprobación financiera.")}</p><div><button type="button" disabled={busy} onClick={() => setConfirmingRetire(false)}>{t("Cancel", "Cancelar")}</button><button type="button" disabled={busy || hasUnsavedChanges} onClick={() => void run("retire")}>{t("Confirm retirement", "Confirmar retiro")}</button></div></div>}
            {preview && <p role="status"><strong>{t("Calculated preview", "Vista previa calculada")}: {preview.total} {preview.currency}</strong> · {preview.lines.length} {t("components", "componentes")}</p>}
            {!!history.length && <details><summary>{t("Immutable version history", "Historial inmutable de versiones")}</summary>{history.map(version => <p key={version.versionId}>v{version.version} · {statusText(version.status)} · {version.versionId}</p>)}</details>}
          </div>
        </section>
      </div>}
    </main>
  </div>;
}
