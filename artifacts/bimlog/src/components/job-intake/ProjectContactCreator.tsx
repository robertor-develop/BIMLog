import { Plus, X } from "lucide-react";
import { useState } from "react";

export type CreatedProjectContact = {
  id: number | string;
  fullName: string;
  email?: string | null;
  companyId: number;
  companyName?: string | null;
};

type Props = {
  request: (path: string, init?: RequestInit) => Promise<any>;
  projectId: number;
  companyId?: number | null;
  companyName?: string | null;
  onCreated: (contact: CreatedProjectContact) => void;
  tt: (en: string, es: string) => string;
};

export function ProjectContactCreator({ request, projectId, companyId, companyName, onCreated, tt }: Props) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    if (saving) return;
    setOpen(false);
    setError("");
  };

  const save = async () => {
    if (!companyId || !fullName.trim()) {
      setError(tt("Select a client company and enter the contact name.", "Seleccione una empresa cliente e ingrese el nombre del contacto."));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const contact = await request(`/projects/${projectId}/directory/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          company_name: companyName || "",
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: "Client Contact",
          notes: "Registered from Job Intake.",
        }),
      }) as CreatedProjectContact;
      onCreated(contact);
      setFullName("");
      setEmail("");
      setPhone("");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tt("Contact could not be added.", "No se pudo agregar el contacto."));
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return <button type="button" className="ji-company-create-button" disabled={!companyId} onClick={() => setOpen(true)}><Plus size={14} />{tt("Add company contact", "Agregar contacto de empresa")}</button>;
  }

  return <div className="ji-company-create" aria-label={tt("Add company contact", "Agregar contacto de empresa")}>
    <div className="ji-company-create-head"><strong>{tt(`Add a contact for ${companyName || "this company"}`, `Agregar un contacto para ${companyName || "esta empresa"}`)}</strong><button type="button" aria-label={tt("Close", "Cerrar")} onClick={close}><X size={14} /></button></div>
    <p>{tt("Add another authoritative contact to the selected current-project company.", "Agregue otro contacto autorizado a la empresa seleccionada del proyecto actual.")}</p>
    <div className="ji-grid three">
      <label>{tt("Contact name — required", "Nombre del contacto — obligatorio")}<input autoFocus value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
      <label>{tt("Email — optional", "Correo — opcional")}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>{tt("Phone — optional", "Teléfono — opcional")}<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
    </div>
    {error && <div className="ji-error" role="alert">{error}</div>}
    <div className="ji-actions"><button type="button" className="primary" disabled={saving || !fullName.trim()} onClick={() => void save()}>{saving ? tt("Adding…", "Agregando…") : tt("Add and select contact", "Agregar y seleccionar contacto")}</button><button type="button" disabled={saving} onClick={close}>{tt("Cancel", "Cancelar")}</button></div>
  </div>;
}
