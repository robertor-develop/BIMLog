import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

export type CreatedProjectCompany = {
  id: number;
  name: string;
  directoryEntry: {
    id: number | string;
    fullName?: string | null;
    email?: string | null;
    companyId?: number | null;
    companyName?: string | null;
  };
};

type Props = {
  request: (path: string, init?: RequestInit) => Promise<any>;
  projectId: number;
  onCreated: (company: CreatedProjectCompany) => void;
  tt: (en: string, es: string) => string;
};

export function ProjectCompanyCreator({ request, projectId, onCreated, tt }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [catalog, setCatalog] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");
  const [catalogGoverned, setCatalogGoverned] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    setCatalogState("loading");
    request(`/master-catalogs/clients?projectId=${projectId}`)
      .then(body => { if (active) { setCatalog(Array.isArray(body.entries) ? body.entries : []); setCatalogGoverned(body.governed === true); setCatalogState("ready"); } })
      .catch(() => { if (active) setCatalogState("error"); });
    return () => { active = false; };
  }, [open, projectId, request]);

  const close = () => {
    if (saving) return;
    setOpen(false);
    setError("");
  };

  const save = async () => {
    const selectedClient = catalog.find(entry => String(entry.id) === selectedClientId);
    const companyName = selectedClient?.name ?? name.trim();
    if (catalogState !== "ready" || ((catalog.length > 0 || catalogGoverned) && !selectedClient)) {
      setError(tt("Select an approved client from the company catalog.", "Seleccione un cliente aprobado del catálogo de la empresa.")); return;
    }
    if (!companyName) {
      setError(tt("Company name is required.", "El nombre de la empresa es obligatorio."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const company = await request(`/projects/${projectId}/directory/companies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName,
          ...(selectedClient ? { canonical_company_id: selectedClient.id } : {}),
          primary_contact_name: contactName.trim(),
          primary_contact_email: contactEmail.trim(),
          notes: "Registered from Job Intake.",
        }),
      }) as CreatedProjectCompany;
      onCreated(company);
      setName("");
      setSelectedClientId("");
      setContactName("");
      setContactEmail("");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tt("Company could not be added.", "No se pudo agregar la empresa."));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return <button type="button" className="ji-company-create-button" onClick={() => setOpen(true)}><Plus size={14} />{tt("Add client company", "Agregar empresa cliente")}</button>;
  }

  return <div className="ji-company-create" aria-label={tt("Add client company", "Agregar empresa cliente")}>
    <div className="ji-company-create-head"><strong>{tt("Add a company to this project", "Agregar una empresa a este proyecto")}</strong><button type="button" aria-label={tt("Close", "Cerrar")} onClick={close}><X size={14} /></button></div>
    <p>{tt("Create or connect the authoritative company once, then use it throughout this job.", "Cree o conecte la empresa autorizada una sola vez y úsela en todo este trabajo.")}</p>
    <div className="ji-grid three">
      {catalogState === "error" ? <p role="alert">{tt("Client catalog could not be loaded. No company will be created.", "No se pudo cargar el catálogo de clientes. No se creará ninguna empresa.")}</p> : catalogState === "loading" ? <p>{tt("Loading client catalog…", "Cargando catálogo de clientes…")}</p> : catalog.length > 0 ? <label>{tt("Approved client — required", "Cliente aprobado — obligatorio")}<select autoFocus value={selectedClientId} onChange={event => setSelectedClientId(event.target.value)}><option value="">{tt("Select client", "Seleccione cliente")}</option>{catalog.map(entry => <option key={entry.id} value={entry.id}>{entry.code} — {entry.name}</option>)}</select></label> : catalogGoverned ? <p role="status">{tt("No active clients are in the company catalog. Ask your Company PMO administrator to add one before connecting it to this project.", "No hay clientes activos en el catálogo de la empresa. Pida al administrador PMO de su empresa que agregue uno antes de conectarlo con este proyecto.")}</p> : <label>{tt("Company name — required", "Nombre de empresa — obligatorio")}<input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>}
      <label>{tt("Primary contact — optional", "Contacto principal — opcional")}<input value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
      <label>{tt("Contact email — optional", "Correo del contacto — opcional")}<input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label>
    </div>
    {error && <div className="ji-error" role="alert">{error}</div>}
    <div className="ji-actions"><button type="button" className="primary" disabled={saving || catalogState !== "ready" || (catalog.length > 0 || catalogGoverned ? !selectedClientId : !name.trim())} onClick={() => void save()}>{saving ? tt("Adding…", "Agregando…") : tt("Add and select company", "Agregar y seleccionar empresa")}</button><button type="button" disabled={saving} onClick={close}>{tt("Cancel", "Cancelar")}</button></div>
  </div>;
}
