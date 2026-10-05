import { ArrowRight, Building2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

type Company = { id: number; name: string };
type Contact = { id: number | string; companyId?: number | null; fullName?: string | null };
type Props = { data: any; companies: Company[]; contacts: Contact[]; setData: React.Dispatch<React.SetStateAction<any>>; tt: (en: string, es: string) => string };
const roles = ["owner", "general_contractor", "customer", "service_provider", "trade_contractor", "consultant", "vendor", "other"];

export function CompanyJobMap({ data, companies, contacts, setData, tt }: Props) {
  const participants = data.relationships?.participants ?? [];
  const engagements = data.relationships?.engagements ?? [];
  const [providerId, setProviderId] = useState("");
  const [customerId, setCustomerId] = useState("");
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
    <h3>{tt("Who hires whom", "Quién contrata a quién")}</h3>
    <p>{tt("An agreement connects the service provider to the customer who hires them. Use this only when the job involves multiple companies; contract records are configured in the next stage.", "Un acuerdo conecta al proveedor del servicio con el cliente que lo contrata. Úselo solo cuando intervengan varias empresas; los contratos se configuran en la siguiente etapa.")}</p>
    {engagements.map((edge: any) => { const provider=participants.find((item:any)=>item.id===edge.providerParticipantId); const customer=participants.find((item:any)=>item.id===edge.customerParticipantId); return <div className="ji-company-row" key={edge.id}><span>{provider?.companyName} <ArrowRight size={13}/> {customer?.companyName}</span><span>{edge.description || tt("Provides services to", "Presta servicios a")}</span><button type="button" aria-label={tt("Remove company relationship","Eliminar relación entre empresas")} onClick={()=>update(participants,engagements.filter((item:any)=>item.id!==edge.id))}><Trash2 size={14}/></button></div>; })}
    <div className="ji-grid two"><label>{tt("Service provider","Proveedor de servicios")}<select value={providerId} onChange={event=>setProviderId(event.target.value)}><option value="">{tt("Choose provider company","Elegir empresa proveedora")}</option>{participants.map((item:any)=><option key={item.id} value={item.id}>{item.companyName}</option>)}</select></label><label>{tt("Customer","Cliente")}<select value={customerId} onChange={event=>setCustomerId(event.target.value)}><option value="">{tt("Choose customer company","Elegir empresa cliente")}</option>{participants.filter((item:any)=>item.id!==providerId).map((item:any)=><option key={item.id} value={item.id}>{item.companyName}</option>)}</select></label></div>
    <p className="ji-small">{tt("A company relationship records who provides services to whom. It is optional until a contract must be linked to that relationship.","Una relación entre empresas registra quién presta servicios a quién. Es opcional hasta que un contrato deba vincularse a esa relación.")}</p>
    <button type="button" disabled={!providerId||!customerId||providerId===customerId} onClick={() => { const provider=participants.find((item:any)=>item.id===providerId),customer=participants.find((item:any)=>item.id===customerId); if(!provider||!customer)return; const providerContact=contacts.find((contact)=>Number(contact.companyId)===provider.companyId); const customerContact=contacts.find((contact)=>Number(contact.companyId)===customer.companyId); update(participants,[...engagements,{id:`ENGAGEMENT-${crypto.randomUUID()}`,providerParticipantId:provider.id,customerParticipantId:customer.id,providerContactId:providerContact?Number(providerContact.id):null,customerContactId:customerContact?Number(customerContact.id):null,description:""}]); setProviderId("");setCustomerId(""); }}><Plus size={14}/> {tt("Add company relationship", "Agregar relación entre empresas")}</button>
  </section>;
}
