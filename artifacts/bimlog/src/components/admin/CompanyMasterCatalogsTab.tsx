import { useCallback, useEffect, useState } from "react";

const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
type Kind = "client" | "discipline" | "service" | "phase";
type Entry = { id: string; code: string; name: string; state: "active" | "inactive" | "retired"; version: number; canonicalCompanyId?: number | null };
type PolicyMode = "approved_only" | "defaults_allowed";
type Capability = { companyId: number; canManage: boolean; isSuperAdmin: boolean; mode: PolicyMode; policyVersion: number | null };
const kinds: Kind[] = ["client", "discipline", "service", "phase"];
const labels: Record<Kind, [string, string]> = {
  client: ["Clients", "Clientes"], discipline: ["Disciplines", "Disciplinas"], service: ["Services", "Servicios"], phase: ["Phases", "Fases"],
};

export function CompanyMasterCatalogsTab({ token, spanish }: { token: string; spanish: boolean }) {
  const [capability, setCapability] = useState<Capability | null>(null);
  const [entries, setEntries] = useState<Record<Kind, Entry[]>>({ client: [], discipline: [], service: [], phase: [] });
  const [drafts, setDrafts] = useState<Record<Kind, { code: string; name: string }>>({ client: { code: "", name: "" }, discipline: { code: "", name: "" }, service: { code: "", name: "" }, phase: { code: "", name: "" } });
  const [grantEmail, setGrantEmail] = useState("");
  const [policyDraft, setPolicyDraft] = useState<PolicyMode>("defaults_allowed");
  const [editing, setEditing] = useState<{ kind: Kind; id: string; name: string; version: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const t = (en: string, es: string) => spanish ? es : en;
  const request = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`${base}/api/v1${path}`, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || body.code || `${response.status}`);
    return body;
  }, [token]);
  const load = useCallback(async () => {
    const cap = await request("/company/master-catalogs/capabilities") as Capability;
    const rows = await Promise.all(kinds.map(async kind => [kind, (await request(`/company/master-catalogs/${kind}?includeInactive=true`)).entries ?? []] as const));
    setCapability(cap);
    setPolicyDraft(cap.mode);
    setEntries(Object.fromEntries(rows) as Record<Kind, Entry[]>);
    setLoadError("");
  }, [request]);
  useEffect(() => {
    setLoading(true);
    void load().catch(error => setLoadError(String(error))).finally(() => setLoading(false));
  }, [load]);

  async function create(kind: Kind) {
    setBusy(true); setMessage("");
    try {
      await request(`/company/master-catalogs/${kind}`, { method: "POST", body: JSON.stringify(drafts[kind]) });
      setDrafts(current => ({ ...current, [kind]: { code: "", name: "" } }));
      await load();
      setMessage(t("Company value created.", "Valor de la empresa creado."));
    } catch (error) { setMessage(String(error)); } finally { setBusy(false); }
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
        body: JSON.stringify({ name: editing.name.trim(), expectedVersion: editing.version }),
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

  const ready = capability !== null && !loading && !loadError;
  return <section aria-labelledby="company-master-title" style={{ display: "grid", gap: 16, minWidth: 0, width: "100%" }}>
    <div><h2 id="company-master-title">{t("Company Master Catalogs", "Catálogos maestros de la empresa")}</h2><p>{t("Clients, disciplines, services, and phases are configured once for this company and reused across its projects. Changes do not rename historical project snapshots.", "Clientes, disciplinas, servicios y fases se configuran una vez para esta empresa y se reutilizan en sus proyectos. Los cambios no renombran registros históricos.")}</p></div>
    {loading && <p role="status">{t("Loading company catalogs…", "Cargando catálogos de la empresa…")}</p>}
    {loadError && <div role="alert"><p>{t("Company catalogs could not be loaded. Check your connection or access and retry.", "No se pudieron cargar los catálogos de la empresa. Revise su conexión o acceso y vuelva a intentar.")}</p><button type="button" onClick={() => { setLoading(true); void load().catch(error => setLoadError(String(error))).finally(() => setLoading(false)); }}>{t("Retry", "Reintentar")}</button></div>}
    {!capability && !loading && !loadError && <p role="alert">{t("Company catalog access is unavailable.", "El acceso al catálogo de empresa no está disponible.")}</p>}
    {ready && capability && <p style={{ background: "#eff6ff", padding: 12, borderRadius: 8 }}>{capability.canManage ? t("Company PMO administration enabled.", "Administración PMO de la empresa habilitada.") : t("Read-only: a Super Administrator must grant Company PMO access to this existing account.", "Solo lectura: un Super Administrador debe otorgar acceso PMO de empresa a esta cuenta existente.")}</p>}
    {ready && capability && <section style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, minWidth: 0 }}><h3>{t("Company catalog policy", "Política del catálogo de empresa")}</h3><p>{t("This policy remains in force even if the last PMO administrator is revoked. Approved-only requires active company values for new project selections; existing saved selections remain historical.", "Esta política sigue vigente aunque se revoque al último administrador PMO. Solo aprobados exige valores activos de la empresa para nuevas selecciones del proyecto; las selecciones guardadas permanecen como historial.")}</p><label style={{ display: "grid", gap: 5, minWidth: 0 }}>{t("Selection mode", "Modo de selección")} <select style={{ width: "100%", minWidth: 0 }} value={policyDraft} disabled={!capability.canManage || !capability.policyVersion || busy} onChange={event => setPolicyDraft(event.target.value as PolicyMode)}><option value="approved_only">{t("Approved company values only", "Solo valores aprobados de la empresa")}</option><option value="defaults_allowed">{t("Company values and BIMLog defaults", "Valores de empresa y predeterminados de BIMLog")}</option></select></label>{capability.canManage && <button type="button" disabled={busy || !capability.policyVersion || policyDraft === capability.mode} onClick={() => void savePolicy()}>{t("Save policy", "Guardar política")}</button>}</section>}
    {message && <p role="status" style={{ padding: 10, background: "#fef3c7", borderRadius: 8 }}>{message}</p>}
    {ready && capability?.isSuperAdmin && <section style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 14 }}><h3>{t("Grant or revoke Company PMO access", "Otorgar o revocar acceso PMO de empresa")}</h3><p>{t("Enter the existing user's email. The server binds the grant to that user's own company; it does not grant global Super Admin.", "Ingrese el correo de la cuenta existente. El servidor vincula el permiso a la empresa de esa cuenta; no otorga Super Administrador global.")}</p><label>{t("User email", "Correo del usuario")} <input type="email" value={grantEmail} onChange={event => setGrantEmail(event.target.value)} /></label><div style={{ display: "flex", gap: 8, marginTop: 9 }}><button type="button" disabled={busy || !grantEmail.includes("@")} onClick={() => void grant("grant")}>{t("Grant PMO", "Otorgar PMO")}</button><button type="button" disabled={busy || !grantEmail.includes("@")} onClick={() => void grant("revoke")}>{t("Revoke PMO", "Revocar PMO")}</button></div></section>}
    {ready && capability && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(280px,100%),1fr))", gap: 14, minWidth: 0 }}>{kinds.map(kind => <section key={kind} style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: 14, minWidth: 0 }}><h3>{spanish ? labels[kind][1] : labels[kind][0]}</h3>
      {kind === "client" && <p>{t("Client names come from canonical Companies. Company PMO can add or deactivate options here; name corrections require Company Directory administration.", "Los nombres de clientes provienen de Empresas canónicas. PMO puede agregar o desactivar opciones aquí; las correcciones de nombres requieren administración del Directorio de Empresas.")}</p>}
      {capability?.canManage && <div style={{ display: "grid", gap: 7, marginBottom: 12, minWidth: 0 }}><label style={{ display: "grid", gap: 4, minWidth: 0 }}>{t("Code", "Código")} <input style={{ width: "100%", minWidth: 0 }} value={drafts[kind].code} maxLength={64} onChange={event => setDrafts(old => ({ ...old, [kind]: { ...old[kind], code: event.target.value.toUpperCase() } }))} /></label><label style={{ display: "grid", gap: 4, minWidth: 0 }}>{t("Name", "Nombre")} <input style={{ width: "100%", minWidth: 0 }} value={drafts[kind].name} maxLength={200} onChange={event => setDrafts(old => ({ ...old, [kind]: { ...old[kind], name: event.target.value } }))} /></label><button type="button" disabled={busy || !drafts[kind].code.trim() || !drafts[kind].name.trim()} onClick={() => void create(kind)}>{t("Add to company catalog", "Agregar al catálogo de empresa")}</button></div>}
      {entries[kind].length === 0 && <p>{capability?.mode === "approved_only"
        ? t("No approved company values yet. Add one before making a new project selection of this kind.", "Aún no hay valores de empresa aprobados. Agregue uno antes de hacer una nueva selección de este tipo en el proyecto.")
        : t("No company values yet; BIMLog defaults remain available in project choices.", "Aún no hay valores de empresa; los valores predeterminados de BIMLog siguen disponibles en las opciones del proyecto.")}</p>}
      <div style={{ display: "grid", gap: 7 }}>{entries[kind].map(entry => {
        const isEditing = editing?.kind === kind && editing.id === entry.id;
        return <div key={entry.id} style={{ borderTop: "1px solid #e2e8f0", paddingTop: 7, display: "grid", gap: 7, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8, flexWrap: "wrap" }}>
            <span><strong>{entry.code} — {entry.name}</strong><small style={{ display: "block" }}>{({ active: t("Active", "Activo"), inactive: t("Inactive", "Inactivo"), retired: t("Retired", "Retirado") })[entry.state]} · v{entry.version}</small></span>
            {capability?.canManage && entry.state !== "retired" && <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {kind !== "client" && <button type="button" disabled={busy} onClick={() => setEditing({ kind, id: entry.id, name: entry.name, version: entry.version })}>{t("Edit name", "Editar nombre")}</button>}
              <button type="button" disabled={busy} onClick={() => void toggle(kind, entry)}>{entry.state === "active" ? t("Deactivate", "Desactivar") : t("Activate", "Activar")}</button>
            </span>}
          </div>
          {isEditing && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <label style={{ flex: "1 1 180px" }}>{t("New name", "Nuevo nombre")} <input style={{ width: "100%", minWidth: 0 }} value={editing.name} maxLength={200} onChange={event => setEditing({ ...editing, name: event.target.value })} /></label>
            <button type="button" disabled={busy || !editing.name.trim() || editing.name.trim() === entry.name} onClick={() => void saveName()}>{t("Save name", "Guardar nombre")}</button>
            <button type="button" disabled={busy} onClick={() => setEditing(null)}>{t("Cancel", "Cancelar")}</button>
          </div>}
        </div>;
      })}</div>
    </section>)}</div>}
  </section>;
}
