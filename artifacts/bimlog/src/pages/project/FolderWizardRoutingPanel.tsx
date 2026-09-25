import { useEffect, useMemo, useState } from "react";

type Tier = { label: string; items: string[] };
type Blueprint = { name: string; include: boolean; tiers: Tier[] };
type Definition = { selectors: { tagKey: string; tagValue: string; blueprintName: string }[];
  tierMappings: { blueprintName: string; tierLabel: string; tagKey: string; values: { tagValue: string; item: string }[] }[] };
type Profile = { version: number; fingerprint: string; definition: Definition; valid: boolean; stale: boolean };
type Response = { projectProfile: Profile | null; companyProfile: Profile | null; canEditProject: boolean; canEditCompany: boolean };

function blank(blueprints: Blueprint[]): Definition {
  return { selectors: blueprints.length > 1 ? blueprints.map((bp) => ({ tagKey: "type", tagValue: "", blueprintName: bp.name })) : [],
    tierMappings: blueprints.flatMap((bp) => bp.tiers.filter((tier) => tier.items.length > 1).map((tier) => ({
      blueprintName: bp.name, tierLabel: tier.label, tagKey: "", values: tier.items.map((item) => ({ tagValue: "", item })),
    }))) };
}

export function FolderWizardRoutingPanel({ projectId, token, lang, blueprints }: {
  projectId: number; token: string | null; lang: string; blueprints: Blueprint[];
}) {
  const tr = (en: string, es: string) => lang === "es" ? es : en;
  const included = useMemo(() => blueprints.filter((bp) => bp.include), [blueprints]);
  const [loaded, setLoaded] = useState<Response | null>(null);
  const [scopeType, setScopeType] = useState<"project" | "company">("project");
  const [definition, setDefinition] = useState<Definition>(() => blank(included));
  const [tags, setTags] = useState<Record<string, string>>({});
  const [filename, setFilename] = useState("example.pdf");
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/v1/projects/${projectId}/integrations/folder-wizard/routing`;

  async function refresh() {
    if (!token) return;
    const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`routing ${response.status}`);
    const data = await response.json() as Response;
    setLoaded(data);
    const selected = scopeType === "project" ? data.projectProfile : data.companyProfile;
    setDefinition(selected?.definition ?? blank(included));
  }
  useEffect(() => { setLoaded(null); setError(""); void refresh().catch(() => setError(tr("Routing rules could not be loaded.", "No se pudieron cargar las reglas de rutas."))); }, [projectId, token]);
  const selected = scopeType === "project" ? loaded?.projectProfile : loaded?.companyProfile;
  const canEdit = scopeType === "project" ? loaded?.canEditProject : loaded?.canEditCompany;
  const keys = [...new Set([...definition.selectors.map((entry) => entry.tagKey), ...definition.tierMappings.map((entry) => entry.tagKey)].filter(Boolean))];
  function selectScope(next: "project" | "company") {
    setScopeType(next); setPreview(""); setError("");
    setDefinition((next === "project" ? loaded?.projectProfile : loaded?.companyProfile)?.definition ?? blank(included));
  }
  function updateSelector(index: number, change: Partial<Definition["selectors"][number]>) {
    setDefinition((before) => ({ ...before, selectors: before.selectors.map((entry, i) => i === index ? { ...entry, ...change } : entry) }));
    setPreview("");
  }
  function updateTier(index: number, change: Partial<Definition["tierMappings"][number]>) {
    setDefinition((before) => ({ ...before, tierMappings: before.tierMappings.map((entry, i) => i === index ? { ...entry, ...change } : entry) }));
    setPreview("");
  }
  async function request(path: string, body: unknown) {
    const response = await fetch(`${endpoint}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(result.error ?? `HTTP ${response.status}`);
    }
    return response.json() as Promise<Record<string, unknown>>;
  }
  async function save() {
    if (!canEdit) return;
    setBusy(true); setError("");
    try {
      await request("", { scopeType, definition, expectedFingerprint: selected?.fingerprint ?? null });
      await refresh();
    } catch (cause) { setError(cause instanceof Error && cause.message.includes("STALE")
      ? tr("Rules changed elsewhere. Reload before saving.", "Las reglas cambiaron en otra sesión. Recargue antes de guardar.")
      : tr("Rules were not saved. Check every tag value and Wizard item.", "No se guardaron las reglas. Revise cada etiqueta y elemento del Wizard.")); }
    finally { setBusy(false); }
  }
  async function calculate() {
    setBusy(true); setError(""); setPreview("");
    try {
      const result = await request("/preview", { definition, tags, filename });
      setPreview(String(result.relativeFilePath ?? ""));
    } catch { setError(tr("No exact folder path matched these tags. Complete the mapping and try again.", "No existe una ruta exacta para estas etiquetas. Complete las correspondencias y reintente.")); }
    finally { setBusy(false); }
  }

  return <section aria-label={tr("Folder routing rules", "Reglas de rutas de carpetas")} style={{ borderTop: "1px solid hsl(var(--border))", marginTop: 16, paddingTop: 16, fontSize: 12 }}>
    <h3 style={{ fontSize: 15, margin: "0 0 7px" }}>{tr("Tag-to-folder rules", "Correspondencia entre etiquetas y carpetas")}</h3>
    <p>{tr("Map each confirmed intake tag to an exact Wizard item. Unmapped values stop routing; no folder is guessed.", "Asigne cada etiqueta confirmada a un elemento exacto del Wizard. Una etiqueta sin correspondencia detiene la ruta; no se adivina una carpeta.")}</p>
    {!loaded ? <p role="status">{error || tr("Loading rules…", "Cargando reglas…")}</p> : <>
      <label>{tr("Rule scope", "Alcance de las reglas")}
        <select value={scopeType} onChange={(event) => selectScope(event.target.value as "project" | "company")} style={{ display: "block", marginTop: 4 }}>
          <option value="project">{tr("This project", "Este proyecto")}</option><option value="company">{tr("Company default", "Valor predeterminado de la empresa")}</option>
        </select>
      </label>
      {selected && <p>{tr("Version", "Versión")}: {selected.version} · {selected.stale ? tr("Stale after import; save a new version", "Desactualizada tras importar; guarde una nueva versión") : selected.valid ? tr("Valid for this import", "Válida para esta importación") : tr("Incompatible with this import", "Incompatible con esta importación")}</p>}
      {included.length > 1 && <div><h4>{tr("Select a blueprint", "Seleccione un esquema")}</h4>{definition.selectors.map((entry, index) => <div key={`${entry.blueprintName}-${index}`} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 7, marginBottom: 8 }}>
        <strong>{entry.blueprintName}</strong>
        <label>{tr("Tag field", "Campo de etiqueta")}<input value={entry.tagKey} onChange={(event) => updateSelector(index, { tagKey: event.target.value })} placeholder="type" /></label>
        <label>{tr("Tag value", "Valor de etiqueta")}<input value={entry.tagValue} onChange={(event) => updateSelector(index, { tagValue: event.target.value })} placeholder="NWF" /></label>
      </div>)}</div>}
      <h4>{tr("Folder tiers", "Niveles de carpeta")}</h4>
      {definition.tierMappings.map((mapping, index) => <div key={`${mapping.blueprintName}-${mapping.tierLabel}`} style={{ border: "1px solid hsl(var(--border))", borderRadius: 7, padding: 9, marginBottom: 9 }}>
        <strong>{mapping.blueprintName} · {mapping.tierLabel}</strong>
        <label style={{ display: "block", margin: "7px 0" }}>{tr("Source tag field", "Campo de etiqueta de origen")}
          <input value={mapping.tagKey} onChange={(event) => updateTier(index, { tagKey: event.target.value })} placeholder="level" style={{ display: "block" }} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
          {mapping.values.map((value, itemIndex) => <label key={value.item}>{value.item}
            <input value={value.tagValue} onChange={(event) => updateTier(index, { values: mapping.values.map((candidate, i) => i === itemIndex ? { ...candidate, tagValue: event.target.value } : candidate) })} placeholder={tr("Exact intake value", "Valor exacto en Ingreso")} style={{ display: "block", width: "100%" }} />
          </label>)}
        </div>
      </div>)}
      {!canEdit && <p>{tr("You can view these rules, but only a project administrator or company PMO can change the corresponding scope.", "Puede ver estas reglas, pero solo un administrador del proyecto o PMO de la empresa puede cambiar el alcance correspondiente.")}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}><button type="button" disabled={!canEdit || busy} onClick={() => void save()}>{tr("Save new rule version", "Guardar nueva versión de reglas")}</button>
        <button type="button" disabled={busy} onClick={() => void refresh()}>{tr("Cancel and reload", "Cancelar y recargar")}</button></div>
      <h4>{tr("Test an exact destination", "Probar un destino exacto")}</h4>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 8 }}>
        {keys.map((key) => <label key={key}>{key}<input value={tags[key] ?? ""} onChange={(event) => setTags((before) => ({ ...before, [key]: event.target.value }))} /></label>)}
        <label>{tr("File name", "Nombre del archivo")}<input value={filename} onChange={(event) => setFilename(event.target.value)} /></label>
      </div>
      <button type="button" disabled={busy} onClick={() => void calculate()} style={{ marginTop: 8 }}>{tr("Preview path", "Vista previa de ruta")}</button>
      {preview && <p role="status" style={{ overflowWrap: "anywhere" }}>{preview}</p>}
      {error && <p role="alert" style={{ color: "#991B1B" }}>{error}</p>}
    </>}
  </section>;
}
