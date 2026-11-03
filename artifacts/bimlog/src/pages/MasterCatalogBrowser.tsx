import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuthStore } from "@/store/auth";
import { useI18n } from "@/lib/i18n";

type Entry = { id: string | number; catalogEntryId?: string; code: string; name: string; aliases?: string[]; state?: string; version?: number; source?: string };
export function MasterCatalogBrowser() {
  const { token } = useAuthStore();
  const { tt } = useI18n();
  const [catalog, setCatalog] = useState("services");
  const [projectDraft, setProjectDraft] = useState("");
  const [projectId, setProjectId] = useState("");
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [governed, setGoverned] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState(false);
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    setBusy(true); setError(""); setEntries([]); setGoverned(null);
    fetch(`/api/v1/master-catalogs/${catalog}${projectId ? `?projectId=${projectId}` : ""}`, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } }).then(async response => {
      if (!response.ok) throw new Error(response.status === 403 ? "denied" : "unavailable");
      const data = await response.json();
      if (!Array.isArray(data.entries) || typeof data.governed !== "boolean" || data.catalog !== catalog || !data.entries.every((entry: Entry) => (typeof entry.id === "string" || typeof entry.id === "number") && typeof entry.code === "string" && typeof entry.name === "string" && (entry.aliases === undefined || (Array.isArray(entry.aliases) && entry.aliases.every(alias => typeof alias === "string"))) && (entry.state === undefined || typeof entry.state === "string") && (entry.version === undefined || Number.isSafeInteger(entry.version)) && (entry.source === undefined || typeof entry.source === "string") && (entry.catalogEntryId === undefined || typeof entry.catalogEntryId === "string"))) throw new Error("invalid");
      if (!controller.signal.aborted) { setEntries(data.entries); setGoverned(data.governed); }
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "unavailable"); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [token, catalog, projectId, retry]);
  const visible = entries.filter(entry => `${entry.code} ${entry.name} ${(entry.aliases ?? []).join(" ")}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <main style={{ maxWidth: 1100, margin: "24px auto", padding: 18, minWidth: 0, overflowWrap: "anywhere" }}>
    <Link href="/all-tools">{tt("All Tools", "Todas las herramientas")}</Link>
    <h1>{tt("Available Master Catalogs", "Catálogos maestros disponibles")}</h1>
    <p>{tt("Inspect the clients, disciplines, services and phases available to your company or an authorized project. These are the same governed entries used by operational forms; this view does not change them.", "Inspeccione clientes, disciplinas, servicios y fases disponibles para su empresa o un proyecto autorizado. Son las mismas entradas gobernadas de los formularios operativos; esta vista no las modifica.")}</p>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <label>{tt("Catalog", "Catálogo")} <select value={catalog} onChange={event => { setCatalog(event.target.value); setQuery(""); }}>{[["clients",tt("Clients","Clientes")],["disciplines",tt("Disciplines","Disciplinas")],["services",tt("Services","Servicios")],["phases",tt("Phases","Fases")]].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <form onSubmit={event => { event.preventDefault(); const value=projectDraft.trim(); if (value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value)<=0)) { setValidation(true); return; } setValidation(false); setProjectId(value ? String(Number(value)) : ""); setRetry(value => value + 1); }}>
        <label>{tt("Project ID (optional)", "ID de proyecto (opcional)")} <input inputMode="numeric" value={projectDraft} onChange={event=>setProjectDraft(event.target.value)} style={{ maxWidth: 150 }} /></label> <button>{tt("Apply scope", "Aplicar alcance")}</button>
      </form>
      <button disabled={busy} onClick={()=>setRetry(value=>value+1)}>{tt("Reload saved catalog", "Recargar catálogo guardado")}</button>
    </div>
    {validation && <p role="alert">{tt("Use a positive whole project ID, or leave blank for your company.", "Use un ID de proyecto entero positivo, o deje vacío para su empresa.")}</p>}
    <p>{projectId ? tt(`Requested project #${projectId}`, `Proyecto solicitado #${projectId}`) : tt("Scope: your current company", "Alcance: su empresa actual")}</p>
    {busy && <p role="status">{tt("Loading authorized entries…", "Cargando entradas autorizadas…")}</p>}
    {error && <p role="alert">{error === "denied" ? tt("Access to this project catalog was denied. Use an active authorized project or your company scope.", "Se denegó acceso al catálogo de este proyecto. Use un proyecto autorizado activo o el alcance de su empresa.") : tt("Catalog unavailable or invalid. Reload to retry; no catalog was changed.", "Catálogo no disponible o inválido. Recargue para reintentar; no se modificó ningún catálogo.")}</p>}
    {governed !== null && <p>{governed ? tt("Policy: company-approved entries only", "Política: solo entradas aprobadas por la empresa") : tt("Policy: company entries with BIMLog defaults", "Política: entradas de empresa con valores de BIMLog")}</p>}
    <label>{tt("Search names, codes and aliases", "Buscar nombres, códigos y alias")} <input value={query} onChange={event=>setQuery(event.target.value)} /></label>
    {!busy && !error && <p role="status">{tt(`${visible.length} of ${entries.length} entries`, `${visible.length} de ${entries.length} entradas`)}</p>}
    <ul style={{ paddingLeft: 20 }}>{visible.map(entry=><li key={`${entry.source}:${entry.id}`} style={{ margin: "14px 0" }}><strong>{entry.name}</strong> — {entry.code}<br />{tt("Record ID", "ID de registro")}: {entry.id}{entry.catalogEntryId && <> · {tt("Catalog entry", "Entrada de catálogo")}: {entry.catalogEntryId}</>} · {tt("Source", "Fuente")}: {entry.source === "company" ? tt("Company", "Empresa") : entry.source === "bimlog" ? "BIMLog" : tt("Not returned", "No devuelta")} · {tt("State", "Estado")}: {entry.state ?? tt("Not returned", "No devuelto")} · {tt("Version", "Versión")}: {entry.version ?? tt("Not returned", "No devuelta")}{entry.aliases?.length ? <p>{tt("Aliases", "Alias")}: {entry.aliases.join(", ")}</p> : null}</li>)}</ul>
    <p>{tt("Use these exact saved identities in the relevant intake or operational form. Authorized company administrators manage company standards in Company Master Catalogs.", "Use estas identidades guardadas exactas en el formulario de ingreso u operación correspondiente. Los administradores autorizados gestionan estándares en Catálogos maestros de empresa.")}</p>
    <Link href="/company-catalogs">{tt("Company Master Catalogs", "Catálogos maestros de empresa")}</Link>
  </main>;
}
