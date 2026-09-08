import { Plus, X } from "lucide-react";
import { useState } from "react";

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

  const close = () => {
    if (saving) return;
    setOpen(false);
    setError("");
  };

  const save = async () => {
    const companyName = name.trim();
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
          primary_contact_name: contactName.trim(),
          primary_contact_email: contactEmail.trim(),
          notes: "Registered from Job Intake.",
        }),
      }) as CreatedProjectCompany;
      onCreated(company);
      setName("");
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
      <label>{tt("Company name — required", "Nombre de empresa — obligatorio")}<input autoFocus value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>{tt("Primary contact — optional", "Contacto principal — opcional")}<input value={contactName} onChange={(event) => setContactName(event.target.value)} /></label>
      <label>{tt("Contact email — optional", "Correo del contacto — opcional")}<input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} /></label>
    </div>
    {error && <div className="ji-error" role="alert">{error}</div>}
    <div className="ji-actions"><button type="button" className="primary" disabled={saving || !name.trim()} onClick={() => void save()}>{saving ? tt("Adding…", "Agregando…") : tt("Add and select company", "Agregar y seleccionar empresa")}</button><button type="button" disabled={saving} onClick={close}>{tt("Cancel", "Cancelar")}</button></div>
  </div>;
}
