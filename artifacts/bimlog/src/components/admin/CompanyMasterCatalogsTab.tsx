import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { COMPANY_CATALOG_GUIDANCE, filterCompanyCatalogEntries, summarizeCompanyCatalog, validateCompanyCatalogDraft, type CompanyCatalogDraftIssue, type CompanyCatalogEntryState } from "@/lib/company-catalog-guidance";

const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type Kind = "client" | "discipline" | "service" | "phase";
type Entry = { id: string; code: string; name: string; aliases: string[]; state: "active" | "inactive" | "retired"; version: number; canonicalCompanyId?: number | null; deliveryWorkflowVersionId?: string | null; deliveryWorkflowBindingVersion?: number | null };
type WorkflowOption = { versionId: string; name: string; version: number; source: "company" | "bimlog"; definition: { phases: Array<{ name: string }> } };
type Usage = { intakeCount: number; taskCount: number; workPackageCount: number; totalCount: number };
type PolicyMode = "approved_only" | "defaults_allowed";
type Capability = { companyId: number; canManage: boolean; isSuperAdmin: boolean; mode: PolicyMode; policyVersion: number | null };
const kinds: Kind[] = ["client", "discipline", "service", "phase"];
const labels: Record<Kind, [string, string]> = {
  client: ["Clients", "Clientes"], discipline: ["Disciplines", "Disciplinas"], service: ["Services", "Servicios"], phase: ["Phases", "Fases"],
};

export function CompanyMasterCatalogsTab({ token, spanish }: { token: string; spanish: boolean }) {
  const [capability, setCapability] = useState<Capability | null>(null);
  const [entries, setEntries] = useState<Record<Kind, Entry[]>>({ client: [], discipline: [], service: [], phase: [] });
  const [drafts, setDrafts] = useState<Record<Kind, { code: string; name: string; aliases: string }>>({ client: { code: "", name: "", aliases: "" }, discipline: { code: "", name: "", aliases: "" }, service: { code: "", name: "", aliases: "" }, phase: { code: "", name: "", aliases: "" } });
  const [grantEmail, setGrantEmail] = useState("");
  const [policyDraft, setPolicyDraft] = useState<PolicyMode>("defaults_allowed");
  const [editing, setEditing] = useState<{ kind: Kind; id: string; name: string; aliases: string; version: number } | null>(null);
  const [selectedKind, setSelectedKind] = useState<Kind>("client");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<CompanyCatalogEntryState | "all">("all");
  const [usage, setUsage] = useState<Record<string, Usage | "loading" | "error">>({});
  const [workflowOptions, setWorkflowOptions] = useState<WorkflowOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const t = (en: string, es: string) => spanish ? es : en;
  const explainDraftIssue = (issue: CompanyCatalogDraftIssue) => ({
    code_required: t("Enter a code.", "Ingrese un código."),
    code_format: t("Use 1–64 uppercase letters, numbers, periods, underscores, or hyphens; begin with a letter or number.", "Use de 1 a 64 letras mayúsculas, números, puntos, guiones bajos o guiones; comience con una letra o número."),
    name_required: t("Enter a name.", "Ingrese un nombre."),
    name_format: t("Use a plain name of 200 characters or fewer.", "Use un nombre sencillo de 200 caracteres o menos."),
    aliases_limit: t("Use no more than 20 aliases, each 200 characters or fewer.", "Use como máximo 20 alias, cada uno de 200 caracteres o menos."),
  } as const)[issue as Exclude<CompanyCatalogDraftIssue, null>] ?? "";
  const explainRequestError = (error: unknown) => {
    const code = error instanceof Error ? error.message : String(error);
    const known: Record<string, string> = {
      COMPANY_CATALOG_DUPLICATE: t("That code already exists in this company catalog.", "Ese código ya existe en este catálogo de empresa."),
      COMPANY_CATALOG_NOT_FOUND_OR_VERSION_CONFLICT: t("This value changed in another session. Reloaded values are shown; review and retry.", "Este valor cambió en otra sesión. Se muestran los valores recargados; revíselos y vuelva a intentar."),
      COMPANY_CATALOG_PMO_REQUIRED: t("Company PMO permission is required for this change.", "Se requiere permiso PMO de empresa para este cambio."),
      COMPANY_CATALOG_POLICY_STALE: t("The policy changed in another session. Reload and review it before saving.", "La política cambió en otra sesión. Recárguela y revísela antes de guardar."),
    };
    return known[code] ?? t("The change could not be saved. Review the values and retry.", "No se pudo guardar el cambio. Revise los valores y vuelva a intentar.");
  };
  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`${base}/api/v1${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.code || `${response.status}`);
    return body;
  }, [token]);
  const load = useCallback(async () => {
    const cap = await request("/company/master-catalogs/capabilities") as Capability;
    const [rows, workflowBody] = await Promise.all([
      Promise.all(kinds.map(async kind => [kind, (await request(`/company/master-catalogs/${kind}?includeInactive=true`)).entries ?? []] as const)),
      request("/company/delivery-workflows/options"),
    ]);
    setCapability(cap);
    setPolicyDraft(cap.mode);
    setEntries(Object.fromEntries(rows) as Record<Kind, Entry[]>);
    setWorkflowOptions((workflowBody.options ?? []).filter((option: WorkflowOption) => option.source === "company"));
    setLoadError("");
  }, [request]);
  useEffect(() => {
    setLoading(true);
    void load().catch(error => setLoadError(String(error))).finally(() => setLoading(false));
  }, [load]);

  async function create(kind: Kind) {
    setBusy(true); setMessage("");
    try {
      await request(`/company/master-catalogs/${kind}`, { method: "POST", body: JSON.stringify({ ...drafts[kind], aliases: drafts[kind].aliases.split(/[\n,]/).map(value => value.trim()).filter(Boolean) }) });
      setDrafts(current => ({ ...current, [kind]: { code: "", name: "", aliases: "" } }));
      await load();
      setMessage(t("Company value created.", "Valor de la empresa creado."));
    } catch (error) { setMessage(explainRequestError(error)); } finally { setBusy(false); }
  }

  async function toggle(kind: Kind, entry: Entry) {
    setBusy(true); setMessage("");
    try {
      await request(`/company/master-catalogs/${kind}/${entry.id}`, { method: "PATCH", body: JSON.stringify({ state: entry.state === "active" ? "inactive" : "active", expectedVersion: entry.version }) });
      await load();
      setMessage(t("State saved; historical selections are preserved.", "Estado guardado; las selecciones históricas se conservan."));
    } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
  }

  async function saveName() {
    if (!editing || editing.kind === "client" || !editing.name.trim()) return;
    setBusy(true); setMessage("");
    try {
      await request(`/company/master-catalogs/${editing.kind}/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editing.name.trim(), aliases: editing.aliases.split(/[\n,]/).map(value => value.trim()).filter(Boolean), expectedVersion: editing.version }),
      });
      await load();
      setEditing(null);
      setMessage(t("Name saved; existing project snapshots retain their historical text.", "Nombre guardado; los registros históricos del proyecto conservan su texto anterior."));
    } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
  }

  async function grant(action: "grant" | "revoke") {
    setBusy(true); setMessage("");
    try {
      await request(action === "grant" ? "/admin/company-master-catalog-grants" : "/admin/company-master-catalog-grants/revoke-by-email", { method: "POST", body: JSON.stringify({ email: grantEmail.trim() }) });
      setGrantEmail("");
      await load();
      setMessage(action === "grant" ? t("Company PMO access granted to the existing user account.", "Acceso PMO de empresa otorgado a la cuenta existente.") : t("Company PMO access revoked.", "Acceso PMO de empresa revocado."));
    } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
  }

  async function savePolicy() {
    if (!capability?.policyVersion) return;
    setBusy(true); setMessage("");
    try {
      await request("/company/master-catalogs/policy", { method: "PATCH", body: JSON.stringify({ mode: policyDraft, expectedVersion: capability.policyVersion }) });
      await load();
      setMessage(t("Company catalog policy saved.", "Política del catálogo de empresa guardada."));
    } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
  }

  async function loadUsage(kind: Kind, entry: Entry) {
    setUsage(current => ({ ...current, [entry.id]: "loading" }));
    try {
      const body = await request(`/company/master-catalogs/${kind}/${entry.id}/usage`);
      setUsage(current => ({ ...current, [entry.id]: body.usage as Usage }));
    } catch {
      setUsage(current => ({ ...current, [entry.id]: "error" }));
    }
  }

  async function saveServiceWorkflow(entry: Entry, workflowVersionId: string) {
    setBusy(true); setMessage("");
    try {
      await request(`/company/master-catalogs/service/${entry.id}/delivery-workflow`, { method: "PUT", body: JSON.stringify({ workflowVersionId, expectedVersion: entry.deliveryWorkflowBindingVersion ?? null }) });
      await load();
      setMessage(t("Service workflow saved. New Contract Items using this Service will receive the exact published workflow and its phases automatically.", "Flujo del servicio guardado. Las nuevas Partidas que usen este Servicio recibirán automáticamente el flujo publicado exacto y sus fases."));
    } catch (error) { setMessage(explainRequestError(error)); } finally { setBusy(false); }
  }

  const ready = capability !== null && !loading && !loadError;
  const visibleEntries = useMemo(() => filterCompanyCatalogEntries(entries[selectedKind], search, stateFilter), [entries, search, selectedKind, stateFilter]);
  const selectedDraftIssue = validateCompanyCatalogDraft(drafts[selectedKind]);
  return <section className="company-catalog-workspace" aria-labelledby="company-master-title" style={{ display: "grid", gap: 16, minWidth: 0, width: "100%" }}>
    <div><h2 id="company-master-title">{t("Company Master Catalogs", "Catálogos maestros de la empresa")}</h2><p>{t("Clients, disciplines, services, and phases are configured once for this company and reused across its projects. Changes do not rename historical project snapshots.", "Clientes, disciplinas, servicios y fases se configuran una vez para esta empresa y se reutilizan en sus proyectos. Los cambios no renombran registros históricos.")}</p></div>
    {loading && <p role="status">{t("Loading company catalogs…", "Cargando catálogos de la empresa…")}</p>}
    {loadError && <div role="alert"><p>{t("Company catalogs could not be loaded. Check your connection or access and retry.", "No se pudieron cargar los catálogos de la empresa. Revise su conexión o acceso y vuelva a intentar.")}</p><button type="button" onClick={() => { setLoading(true); void load().catch(error => setLoadError(String(error))).finally(() => setLoading(false)); }}>{t("Retry", "Reintentar")}</button></div>}
    {!capability && !loading && !loadError && <p role="alert">{t("Company catalog access is unavailable.", "El acceso al catálogo de empresa no está disponible.")}</p>}
    {ready && capability && <p style={{ background: "#eff6ff", padding: 12, borderRadius: 8 }}>{capability.canManage ? t("Company PMO administration enabled.", "Administración PMO de la empresa habilitada.") : t("Read-only: a Super Administrator must grant Company PMO access to this existing account.", "Solo lectura: un Super Administrador debe otorgar acceso PMO de empresa a esta cuenta existente.")}</p>}
    {ready && capability && <section aria-labelledby="related-company-authorities-title" style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, minWidth: 0 }}>
      <h3 id="related-company-authorities-title">{t("Where related setup belongs", "Dónde se configura lo relacionado")}</h3>
      <p>{t("This page owns reusable clients, disciplines, services, and phases. Other governed values stay with the authority that controls their lifecycle.", "Esta página administra clientes, disciplinas, servicios y fases reutilizables. Los demás valores gobernados permanecen con la autoridad que controla su ciclo de vida.")}</p>
      <div className="company-catalog-authority-grid">
        <article><strong>{t("Delivery statuses and transitions", "Estados y transiciones de entrega")}</strong><p>{t("Configure the company workflow, then govern approvals and allowed changes.", "Configure el flujo de la empresa y luego gobierne las aprobaciones y los cambios permitidos.")}</p><div className="company-catalog-authority-actions"><Link href="/company-workflows">{t("Open Delivery Workflows", "Abrir Flujos de Entrega")}</Link><Link href="/company-workflow-governance">{t("Open Workflow Governance", "Abrir Gobernanza de Flujos")}</Link></div></article>
        <article><strong>{t("Document types, locations, metadata, and naming", "Tipos de documento, ubicaciones, metadatos y nomenclatura")}</strong><p>{t("These are versioned in each project's Convention Builder so project history and generated names remain reproducible.", "Estos se versionan en el Constructor de Convención de cada proyecto para que el historial y los nombres generados sigan siendo reproducibles.")}</p><p>{t("Open a project, then use Directory & administration → Convention Builder.", "Abra un proyecto y luego use Directorio y administración → Constructor de Convención.")}</p></article>
        <article><strong>{t("Commercial classifications and rates", "Clasificaciones y tarifas comerciales")}</strong><p>{t("Reusable pricing belongs to the separate approved pricing authority.", "Los precios reutilizables pertenecen a la autoridad separada de precios aprobados.")}</p><div className="company-catalog-authority-actions"><Link href="/company-pricing-templates">{t("Open Pricing Templates", "Abrir Plantillas de Precios")}</Link></div></article>
      </div>
    </section>}
    {ready && capability && <section style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, minWidth: 0 }}><h3>{t("Company catalog policy", "Política del catálogo de empresa")}</h3><p>{t("This policy remains in force even if the last PMO administrator is revoked. Approved-only requires active company values for new project selections; existing saved selections remain historical.", "Esta política sigue vigente aunque se revoque al último administrador PMO. Solo aprobados exige valores activos de la empresa para nuevas selecciones del proyecto; las selecciones guardadas permanecen como historial.")}</p><label style={{ display: "grid", gap: 5, minWidth: 0 }}>{t("Selection mode", "Modo de selección")} <select style={{ width: "100%", minWidth: 0 }} value={policyDraft} disabled={!capability.canManage || !capability.policyVersion || busy} onChange={event => setPolicyDraft(event.target.value as PolicyMode)}><option value="approved_only">{t("Approved company values only", "Solo valores aprobados de la empresa")}</option><option value="defaults_allowed">{t("Company values and BIMLog defaults", "Valores de empresa y predeterminados de BIMLog")}</option></select></label>{capability.canManage && <button type="button" disabled={busy || !capability.policyVersion || policyDraft === capability.mode} onClick={() => void savePolicy()}>{t("Save policy", "Guardar política")}</button>}</section>}
    {message && <p role="status" style={{ padding: 10, background: "#fef3c7", borderRadius: 8 }}>{message}</p>}
    {ready && capability?.isSuperAdmin && <section style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 14 }}><h3>{t("Grant or revoke Company PMO access", "Otorgar o revocar acceso PMO de empresa")}</h3><p>{t("Enter the existing user's email. The server binds the grant to that user's own company; it does not grant global Super Admin.", "Ingrese el correo de la cuenta existente. El servidor vincula el permiso a la empresa de esa cuenta; no otorga Super Administrador global.")}</p><label>{t("User email", "Correo del usuario")} <input type="email" value={grantEmail} onChange={event => setGrantEmail(event.target.value)} /></label><div style={{ display: "flex", gap: 8, marginTop: 9 }}><button type="button" disabled={busy || !grantEmail.includes("@")} onClick={() => void grant("grant")}>{t("Grant PMO", "Otorgar PMO")}</button><button type="button" disabled={busy || !grantEmail.includes("@")} onClick={() => void grant("revoke")}>{t("Revoke PMO", "Revocar PMO")}</button></div></section>}
    {ready && capability && <nav className="company-catalog-kind-nav" aria-label={t("Company catalog sections", "Secciones del catálogo de empresa")} style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8, position: "sticky", top: 0, zIndex: 2, padding: "8px 0", background: "hsl(var(--background))" }}>
      {kinds.map(kind => { const summary = summarizeCompanyCatalog(entries[kind]); return <button key={kind} type="button" aria-pressed={selectedKind === kind} onClick={() => { setSelectedKind(kind); setEditing(null); setSearch(""); setStateFilter("all"); }} style={{ minWidth: 0, padding: "10px 8px", borderRadius: 8, border: selectedKind === kind ? "2px solid #2563eb" : "1px solid #cbd5e1", background: selectedKind === kind ? "#eff6ff" : "white" }}>
        <span style={{ display: "block", fontWeight: 700 }}>{spanish ? labels[kind][1] : labels[kind][0]}</span>
        <small>{summary.active} {t("active", "activos")} · {summary.total} {t("total", "total")}</small>
      </button>})}
    </nav>}
    {ready && capability && <div style={{ display: "grid", gap: 14, minWidth: 0 }}>{kinds.filter(kind => kind === selectedKind).map(kind => <section key={kind} aria-labelledby={`catalog-${kind}-title`} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, minWidth: 0 }}><h3 id={`catalog-${kind}-title`}>{spanish ? labels[kind][1] : labels[kind][0]}</h3>
      <p>{spanish ? COMPANY_CATALOG_GUIDANCE[kind].purpose.es : COMPANY_CATALOG_GUIDANCE[kind].purpose.en}</p>
      <p><strong>{t("Used by", "Usado por")}:</strong> {spanish ? COMPANY_CATALOG_GUIDANCE[kind].usedBy.es : COMPANY_CATALOG_GUIDANCE[kind].usedBy.en}</p>
      <div className="company-catalog-filter" role="search" aria-label={t("Filter company catalog", "Filtrar catálogo de empresa")} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(150px,1fr) auto", gap: 8, alignItems: "end", marginBottom: 12 }}>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>{t("Search code, name, or alias", "Buscar código, nombre o alias")}<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label style={{ display: "grid", gap: 4, minWidth: 0 }}>{t("State", "Estado")}<select value={stateFilter} onChange={event => setStateFilter(event.target.value as CompanyCatalogEntryState | "all")}><option value="all">{t("All states", "Todos los estados")}</option><option value="active">{t("Active", "Activo")}</option><option value="inactive">{t("Inactive", "Inactivo")}</option><option value="retired">{t("Retired", "Retirado")}</option></select></label>
        <button type="button" disabled={!search && stateFilter === "all"} onClick={() => { setSearch(""); setStateFilter("all"); }}>{t("Clear", "Limpiar")}</button>
      </div>
      {kind === "client" && <p>{t("Client names come from canonical Companies. Company PMO can add or deactivate options here; name corrections require Company Directory administration.", "Los nombres de clientes provienen de Empresas canónicas. PMO puede agregar o desactivar opciones aquí; las correcciones de nombres requieren administración del Directorio de Empresas.")}</p>}
      {capability?.canManage && <div style={{ display: "grid", gap: 7, marginBottom: 12, minWidth: 0 }}><label style={{ display: "grid", gap: 4, minWidth: 0 }}>{t("Code", "Código")} <input aria-invalid={selectedDraftIssue === "code_required" || selectedDraftIssue === "code_format"} aria-describedby={`catalog-${kind}-draft-guidance`} style={{ width: "100%", minWidth: 0 }} value={drafts[kind].code} maxLength={64} onChange={event => setDrafts(old => ({ ...old, [kind]: { ...old[kind], code: event.target.value.toUpperCase() } }))} /></label><label style={{ display: "grid", gap: 4, minWidth: 0 }}>{t("Name", "Nombre")} <input aria-invalid={selectedDraftIssue === "name_required" || selectedDraftIssue === "name_format"} aria-describedby={`catalog-${kind}-draft-guidance`} style={{ width: "100%", minWidth: 0 }} value={drafts[kind].name} maxLength={200} onChange={event => setDrafts(old => ({ ...old, [kind]: { ...old[kind], name: event.target.value } }))} /></label><label style={{ display: "grid", gap: 4, minWidth: 0 }}>{t("Aliases (comma separated)", "Alias (separados por comas)")} <input aria-invalid={selectedDraftIssue === "aliases_limit"} aria-describedby={`catalog-${kind}-draft-guidance`} style={{ width: "100%", minWidth: 0 }} value={drafts[kind].aliases} maxLength={1000} onChange={event => setDrafts(old => ({ ...old, [kind]: { ...old[kind], aliases: event.target.value } }))} /></label><p id={`catalog-${kind}-draft-guidance`} role="status" style={{ margin: 0, minHeight: 20 }}>{selectedDraftIssue ? explainDraftIssue(selectedDraftIssue) : t("Code and name are ready to add.", "El código y el nombre están listos para agregar.")}</p><button type="button" disabled={busy || selectedDraftIssue !== null} onClick={() => void create(kind)}>{t("Add to company catalog", "Agregar al catálogo de empresa")}</button></div>}
      {entries[kind].length === 0 && <p>{capability?.mode === "approved_only"
        ? t("No approved company values yet. Add one before making a new project selection of this kind.", "Aún no hay valores de empresa aprobados. Agregue uno antes de hacer una nueva selección de este tipo en el proyecto.")
        : t("No company values yet; BIMLog defaults remain available in project choices.", "Aún no hay valores de empresa; los valores predeterminados de BIMLog siguen disponibles en las opciones del proyecto.")}</p>}
      {visibleEntries.length === 0 && entries[kind].length > 0 && <p role="status">{t("No company values match these filters.", "Ningún valor de empresa coincide con estos filtros.")}</p>}
      <div style={{ display: "grid", gap: 7 }}>{visibleEntries.map(entry => {
        const isEditing = editing?.kind === kind && editing.id === entry.id;
        const entryUsage = usage[entry.id];
        return <div key={entry.id} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 7, display: "grid", gap: 7, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8, flexWrap: "wrap" }}>
            <span><strong>{entry.code} — {entry.name}</strong>{entry.aliases?.length > 0 && <small style={{ display: "block" }}>{t("Aliases", "Alias")}: {entry.aliases.join(", ")}</small>}<small style={{ display: "block" }}>{({ active: t("Active", "Activo"), inactive: t("Inactive", "Inactivo"), retired: t("Retired", "Retirado") })[entry.state]} · v{entry.version}</small></span>
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" disabled={busy || entryUsage === "loading"} onClick={() => void loadUsage(kind, entry)}>{entryUsage === "loading" ? t("Checking…", "Consultando…") : t("View usage", "Ver uso")}</button>
            {capability?.canManage && entry.state !== "retired" && <>
              {kind !== "client" && <button type="button" disabled={busy} onClick={() => setEditing({ kind, id: entry.id, name: entry.name, aliases: (entry.aliases ?? []).join(", "), version: entry.version })}>{t("Edit name and aliases", "Editar nombre y alias")}</button>}
              <button type="button" disabled={busy} onClick={() => void toggle(kind, entry)}>{entry.state === "active" ? t("Deactivate", "Desactivar") : t("Activate", "Activar")}</button>
            </>}
            </span>
          </div>
          {kind === "service" && <label style={{ display: "grid", gap: 4, minWidth: 0 }}>{t("Automatic Delivery Workflow", "Flujo de Entrega automático")}
            <select aria-label={t(`Automatic workflow for ${entry.name}`, `Flujo automático para ${entry.name}`)} value={entry.deliveryWorkflowVersionId ?? ""} disabled={!capability?.canManage || busy || entry.state !== "active"} onChange={event => void saveServiceWorkflow(entry, event.target.value)}>
              <option value="" disabled>{workflowOptions.length ? t("Select a published company workflow", "Seleccione un flujo publicado de la empresa") : t("Publish a company workflow first", "Publique primero un flujo de la empresa")}</option>
              {workflowOptions.map(option => <option key={option.versionId} value={option.versionId}>{option.name} · v{option.version} · {option.definition.phases.map(phase => phase.name).join(" → ")}</option>)}
            </select>
            <small>{entry.deliveryWorkflowVersionId ? t("Used automatically only for new or still-unbound Contract Items; saved choices and reviewed text are preserved.", "Se usa automáticamente solo en Partidas nuevas o aún sin vínculo; se conservan las selecciones guardadas y el texto revisado.") : t("No automatic workflow is configured for this Service.", "No hay un flujo automático configurado para este Servicio.")}</small>
          </label>}
          {entryUsage === "error" && <p role="alert">{t("Usage could not be loaded. Retry.", "No se pudo cargar el uso. Vuelva a intentar.")}</p>}
          {typeof entryUsage === "object" && <p role="status" style={{ margin: 0, padding: 8, background: "#f8fafc", borderRadius: 6 }}>
            {t("Used in", "Usado en")}: {entryUsage.intakeCount} {t("intakes", "ingresos")}, {entryUsage.taskCount} {t("tasks", "tareas")}, {entryUsage.workPackageCount} {t("work packages", "paquetes de trabajo")} · {entryUsage.totalCount} {t("total references", "referencias totales")}
          </p>}
          {isEditing && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 180px" }}>{t("New name", "Nuevo nombre")} <input style={{ width: "100%", minWidth: 0 }} value={editing.name} maxLength={200} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label>
            <label style={{ flex: "1 1 180px" }}>{t("Aliases", "Alias")} <input style={{ width: "100%", minWidth: 0 }} value={editing.aliases} maxLength={1000} onChange={event => setEditing({ ...editing, aliases: event.target.value })} /></label>
            <button type="button" disabled={busy || !editing.name.trim() || (editing.name.trim() === entry.name && editing.aliases === (entry.aliases ?? []).join(", "))} onClick={() => void saveName()}>{t("Save", "Guardar")}</button>
            <button type="button" disabled={busy} onClick={() => setEditing(null)}>{t("Cancel", "Cancelar")}</button>
          </div>}
        </div>;
      })}</div>
    </section>)}</div>}
  </section>;
}
