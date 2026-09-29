import { isCompanyOnlyEntry, isDirectoryRecipientEmail } from "@workspace/api-zod";
import { useState } from "react";
import { useProjectParties } from "@/hooks/use-project-parties";
import { projectCompanyNames, projectCompanyIdentities, type ProjectParty } from "@/lib/project-party-options";
import { ProjectCompanyCreator } from "./job-intake/ProjectCompanyCreator";
import { ProjectContactCreator } from "./job-intake/ProjectContactCreator";
import "./ProjectPartyPicker.css";

type Props = {
  projectId: number;
  company: string;
  onSelect: (company: string, person: string, email: string) => void;
  tt: (en: string, es: string) => string;
  contacts?: boolean;
  canCreate?: boolean;
  additionalContacts?: ProjectParty[];
};

export function ProjectPartyPicker({ projectId, company, onSelect, tt, contacts = true, canCreate = false, additionalContacts = [] }: Props) {
  const parties = useProjectParties(projectId);
  const entries = [...parties.entries];
  // RFI also permits its already-authorized active project members as recipients.
  for (const contact of additionalContacts) {
    if (isDirectoryRecipientEmail(contact.email) && !entries.some(entry => entry.email?.toLowerCase() === contact.email!.toLowerCase())) entries.push(contact);
  }
  const [selectedContact, setSelectedContact] = useState<{ company: string; id: string }>({ company: "", id: "" });
  const matches = projectCompanyIdentities(parties.entries).filter(entry => entry.name === company);
  const selectedIdentity = matches.length === 1 ? matches[0] : undefined;
  const people = entries.filter(entry => entry.companyName === company && entry.fullName && !isCompanyOnlyEntry(entry));
  return <fieldset className="project-party-picker">
    <legend>{tt("Project parties", "Participantes del proyecto")}</legend>
    <p>{tt("Reuse companies and contacts connected to this project. Selecting a contact does not invite or email them.", "Reutilice empresas y contactos de este proyecto. Seleccionar un contacto no lo invita ni envía un correo.")}</p>
    {parties.state === "loading" && <p role="status">{tt("Loading project directory…", "Cargando directorio del proyecto…")}</p>}
    {parties.state === "error" && <div role="alert">{tt("Project directory could not be loaded. Your selection is unchanged.", "No se pudo cargar el directorio. Su selección no cambió.")} <button type="button" onClick={parties.refresh}>{tt("Retry", "Reintentar")}</button></div>}
    <div className="project-party-fields">
      <label>{tt("Project company", "Empresa del proyecto")}<select disabled={parties.state !== "ready"} value={company} onChange={event => onSelect(event.target.value, "", "")}>
        <option value="">{tt("Select company", "Seleccione empresa")}</option>
        {projectCompanyNames(entries, company).map(name => <option key={name} value={name}>{name}</option>)}
      </select></label>
      {contacts && <label>{tt("Project contact", "Contacto del proyecto")}<select value={selectedContact.company === company ? selectedContact.id : ""} disabled={parties.state !== "ready" || !company} onChange={event => {
        const person = people.find(entry => String(entry.id ?? entry.email) === event.target.value);
        setSelectedContact({ company, id: event.target.value });
        onSelect(company, person?.fullName || "", isDirectoryRecipientEmail(person?.email) ? person.email : "");
      }}><option value="">{tt("Select contact", "Seleccione contacto")}</option>{people.map(person => <option key={person.id ?? person.email} value={String(person.id ?? person.email)}>{person.fullName}</option>)}</select></label>}
    </div>
    {parties.state === "ready" && entries.length === 0 && <p role="status">{tt("No companies are connected yet.", "Todavía no hay empresas conectadas.")}</p>}
    {canCreate && parties.state === "ready" && <div className="project-party-create">
      <ProjectCompanyCreator projectId={projectId} request={parties.request} tt={tt} label={tt("Add project company", "Agregar empresa al proyecto")} onCreated={created => { const person = created.directoryEntry; const hasContact = isDirectoryRecipientEmail(person.email); setSelectedContact({ company: created.name, id: hasContact ? String(person.id) : "" }); onSelect(created.name, hasContact ? person.fullName || "" : "", hasContact ? person.email! : ""); parties.refresh(); }} />
      {contacts && <ProjectContactCreator key={`${projectId}-${selectedIdentity?.id}`} projectId={projectId} companyId={selectedIdentity?.id} companyName={company} request={parties.request} tt={tt} onCreated={created => { setSelectedContact({ company, id: String(created.id) }); onSelect(company, created.fullName, isDirectoryRecipientEmail(created.email) ? created.email : ""); parties.refresh(); }} />}
    </div>}
  </fieldset>;
}
