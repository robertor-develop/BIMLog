import { ArrowRight, Building2, Plus, Trash2 } from "lucide-react";

type Company = { id: number; name: string };
type Contact = { id: number | string; companyId?: number | null; fullName?: string | null };
type Props = { data: any; companies: Company[]; contacts: Contact[]; setData: React.Dispatch<React.SetStateAction<any>>; tt: (en: string, es: string) => string };
const roles = ["owner", "general_contractor", "customer", "service_provider", "trade_contractor", "consultant", "vendor", "other"];

export function CompanyJobMap({ data, companies, contacts, setData, tt }: Props) {
  const participants = data.relationships?.participants ?? [];
  const engagements = data.relationships?.engagements ?? [];
  const available = companies.filter((company) => !participants.some((item: any) => item.companyId === company.id));
  const update = (next: any[], nextEngagements = engagements) => setData((old: any) => ({ ...old, relationships: { ...old.relationships, participants: next, engagements: nextEngagements }, review: { ...old.review, contractConfirmed: false } }));
  const add = () => {
    const company = available[0];
    if (!company) return;
    update([...participants, { id: `PARTICIPANT-${crypto.randomUUID()}`, companyId: company.id, companyName: company.name, role: "other", primary: participants.length === 0 }]);
  };
  return <section className="ji-company-map" aria-label={tt("Company job map", "Mapa de empresas del trabajo")}>
    <h3><Building2 size={17}/> {tt("Companies connected to this job", "Empresas conectadas a este trabajo")}</h3>
    <p>{tt("Only authoritative companies already in this project's directory can be connected.", "Solo se pueden conectar empresas autorizadas que ya están en el directorio de este proyecto.")}</p>
    {participants.map((item: any) => <div className="ji-company-row" key={item.id}>
      <strong>{item.companyName}</strong>
      <select aria-label={tt("Company role", "Rol de empresa")} value={item.role} onChange={(event) => update(participants.map((candidate: any) => candidate.id === item.id ? { ...candidate, role: event.target.value } : candidate))}>{roles.map((role) => <option value={role} key={role}>{role.replaceAll("_", " ")}</option>)}</select>
      <button type="button" aria-label={tt("Remove company", "Eliminar empresa")} onClick={() => update(participants.filter((candidate: any) => candidate.id !== item.id), engagements.filter((edge: any) => edge.providerParticipantId !== item.id && edge.customerParticipantId !== item.id))}><Trash2 size={14}/></button>
    </div>)}
    <button type="button" disabled={!available.length} onClick={add}><Plus size={14}/> {tt("Add project company", "Agregar empresa del proyecto")}{available[0] ? `: ${available[0].name}` : ""}</button>
    <h3>{tt("Engagements", "Relaciones contractuales")}</h3>
    {engagements.map((edge: any) => { const provider=participants.find((item:any)=>item.id===edge.providerParticipantId); const customer=participants.find((item:any)=>item.id===edge.customerParticipantId); return <div className="ji-company-row" key={edge.id}><span>{provider?.companyName} <ArrowRight size={13}/> {customer?.companyName}</span><span>{edge.description || tt("Services", "Servicios")}</span><button type="button" onClick={()=>update(participants,engagements.filter((item:any)=>item.id!==edge.id))}><Trash2 size={14}/></button></div>; })}
    <button type="button" disabled={participants.length < 2} onClick={() => { const provider=participants[0], customer=participants[1]; const providerContact=contacts.find((contact)=>Number(contact.companyId)===provider.companyId); const customerContact=contacts.find((contact)=>Number(contact.companyId)===customer.companyId); update(participants,[...engagements,{id:`ENGAGEMENT-${crypto.randomUUID()}`,providerParticipantId:provider.id,customerParticipantId:customer.id,providerContactId:providerContact?Number(providerContact.id):null,customerContactId:customerContact?Number(customerContact.id):null,description:""}]); }}><Plus size={14}/> {tt("Connect first two companies", "Conectar las primeras dos empresas")}</button>
  </section>;
}
