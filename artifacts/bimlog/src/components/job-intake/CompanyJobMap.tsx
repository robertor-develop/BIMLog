import React, { useMemo, useState } from "react";
import { ArrowRight, Building2, Plus, Trash2, UsersRound } from "lucide-react";

type Translate = (en: string, es: string) => string;
type Props = { data: any; setData: React.Dispatch<React.SetStateAction<any>>; tt: Translate };
const roles = ["owner", "general_contractor", "customer", "service_provider", "trade_contractor", "consultant", "vendor", "other"];

export function CompanyJobMap({ data, setData, tt }: Props) {
  const participants = data.relationships?.participants ?? [];
  const engagements = data.relationships?.engagements ?? [];
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("service_provider");
  const [provider, setProvider] = useState("");
  const [customer, setCustomer] = useState("");
  const [description, setDescription] = useState("");
  const contracts = data.commercial?.contracts ?? [];
  const scopeItems = data.scopeItems ?? [];
  const participant = (id: string) => participants.find((item: any) => item.id === id);
  const stats = useMemo(() => ({ companies: participants.length, relationships: engagements.length, contracts: contracts.length, scope: scopeItems.length }), [participants, engagements, contracts, scopeItems]);
  const roleLabel = (value: string) => ({ owner: tt("Owner", "Propietario"), general_contractor: tt("General contractor", "Contratista general"), customer: tt("Customer", "Cliente"), service_provider: tt("Service provider", "Proveedor de servicios"), trade_contractor: tt("Trade contractor", "Contratista especializado"), consultant: tt("Consultant", "Consultor"), vendor: tt("Vendor", "Proveedor"), other: tt("Other", "Otro") } as Record<string,string>)[value] || value;
  const update = (nextParticipants: any[], nextEngagements: any[]) => setData((old: any) => ({ ...old, relationships: { participants: nextParticipants, engagements: nextEngagements } }));
  const seed = () => {
    const providerId = `PARTICIPANT-${crypto.randomUUID()}`, customerId = `PARTICIPANT-${crypto.randomUUID()}`;
    const next = [
      { id: providerId, companyId: null, companyName: tt("Your company", "Su empresa"), role: "service_provider", contactName: "" },
      { id: customerId, companyId: null, companyName: data.identity?.clientCompany || tt("Customer company", "Empresa cliente"), role: "customer", contactName: data.identity?.primaryContact || "" },
    ];
    update(next, [{ id: `ENGAGEMENT-${crypto.randomUUID()}`, providerParticipantId: providerId, customerParticipantId: customerId, description: scopeItems[0]?.name || "" }]);
  };
  const addCompany = () => {
    if (!companyName.trim() || participants.length >= 50) return;
    update([...participants, { id: `PARTICIPANT-${crypto.randomUUID()}`, companyId: null, companyName: companyName.trim(), role, contactName: "" }], engagements);
    setCompanyName("");
  };
  const removeCompany = (id: string) => update(participants.filter((item: any) => item.id !== id), engagements.filter((item: any) => item.providerParticipantId !== id && item.customerParticipantId !== id));
  const addRelationship = () => {
    if (!provider || !customer || provider === customer || engagements.length >= 100) return;
    update(participants, [...engagements, { id: `ENGAGEMENT-${crypto.randomUUID()}`, providerParticipantId: provider, customerParticipantId: customer, description: description.trim() }]);
    setDescription("");
  };
  return <section className="cjm" aria-label={tt("Company job map", "Mapa de empresas del trabajo")}>
    <style>{`.cjm{background:#071f28;color:#e9fbf6;border-radius:18px;padding:22px;margin:18px 0}.cjm *{box-sizing:border-box}.cjm-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.cjm h2,.cjm h3{margin:0 0 5px}.cjm p{color:#abd1c8}.cjm-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.cjm-stat,.cjm-card,.cjm-form,.cjm-edge{background:#0c2b35;border:1px solid #23505a;border-radius:12px;padding:12px}.cjm-stat strong{display:block;font-size:21px;color:#6ee7c1}.cjm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}.cjm-card-head{display:flex;justify-content:space-between;gap:8px}.cjm-card span{display:inline-block;margin-top:7px;padding:3px 8px;border-radius:99px;background:#123f48;color:#9ff3d5;font-size:11px}.cjm button,.cjm input,.cjm select{border:1px solid #35616a;border-radius:8px;padding:9px;background:#09252e;color:#e9fbf6}.cjm button{cursor:pointer}.cjm button.primary{background:#26a780;border-color:#26a780;color:#031b18;font-weight:800}.cjm button.danger{padding:5px 7px;color:#ffb4b4}.cjm-form{display:grid;grid-template-columns:2fr 1fr auto;gap:8px;margin-top:12px}.cjm-rel-form{grid-template-columns:1fr 1fr 1.5fr auto}.cjm-edges{display:grid;gap:8px;margin-top:10px}.cjm-edge{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px}.cjm-edge strong:last-child{text-align:right}.cjm-empty{text-align:center;padding:28px;border:1px dashed #4b7780;border-radius:12px}.cjm-note{font-size:12px;color:#9bc4bb}@media(max-width:700px){.cjm{padding:14px}.cjm-head{display:block}.cjm-stats{grid-template-columns:repeat(2,1fr)}.cjm-form,.cjm-rel-form{grid-template-columns:1fr}.cjm-edge{grid-template-columns:1fr}.cjm-edge strong:last-child{text-align:left}}`}</style>
    <div className="cjm-head"><div><span className="ji-simple-kicker">{tt("One job · many companies", "Un trabajo · muchas empresas")}</span><h2><UsersRound size={20}/> {tt("Who is connected to this job?", "¿Quién está conectado a este trabajo?")}</h2><p>{tt("See the real hiring chain without duplicating the job. Each arrow means “provides work to.”", "Vea la cadena real de contratación sin duplicar el trabajo. Cada flecha significa “presta trabajo a”.")}</p></div><span className="cjm-note">{tt("Draft map · autosaved", "Mapa borrador · guardado automático")}</span></div>
    <div className="cjm-stats"><div className="cjm-stat"><strong>{stats.companies}</strong>{tt("Companies", "Empresas")}</div><div className="cjm-stat"><strong>{stats.relationships}</strong>{tt("Hiring relationships", "Relaciones de contratación")}</div><div className="cjm-stat"><strong>{stats.contracts}</strong>{tt("Agreements", "Acuerdos")}</div><div className="cjm-stat"><strong>{stats.scope}</strong>{tt("Scope items", "Partidas de alcance")}</div></div>
    {!participants.length ? <div className="cjm-empty"><Building2 size={28}/><h3>{tt("Start with your company and customer", "Comience con su empresa y el cliente")}</h3><p>{tt("BIMLog will use the customer already entered above. You can rename either company and add the GC, owner, trades, consultants, or vendors afterward.", "BIMLog usará el cliente ingresado arriba. Después puede renombrar cualquiera y agregar contratista general, propietario, especialidades, consultores o proveedores.")}</p><button type="button" className="primary" onClick={seed}>{tt("Create the starting map", "Crear el mapa inicial")}</button></div> : <>
      <div className="cjm-grid">{participants.map((item: any) => <article className="cjm-card" key={item.id}><div className="cjm-card-head"><div><Building2 size={18}/><h3>{item.companyName || tt("Unnamed company", "Empresa sin nombre")}</h3></div><button type="button" className="danger" aria-label={tt("Remove company", "Eliminar empresa")} onClick={() => removeCompany(item.id)}><Trash2 size={14}/></button></div><span>{roleLabel(item.role)}</span>{item.contactName && <p>{tt("Contact", "Contacto")}: {item.contactName}</p>}</article>)}</div>
      <div className="cjm-form"><input aria-label={tt("Company name", "Nombre de empresa")} placeholder={tt("Add another company", "Agregar otra empresa")} value={companyName} onChange={(event) => setCompanyName(event.target.value)}/><select aria-label={tt("Company role", "Función de la empresa")} value={role} onChange={(event) => setRole(event.target.value)}>{roles.map((value) => <option key={value} value={value}>{roleLabel(value)}</option>)}</select><button type="button" onClick={addCompany}><Plus size={14}/>{tt("Add", "Agregar")}</button></div>
      <h3 style={{marginTop:20}}>{tt("Hiring and service relationships", "Relaciones de contratación y servicio")}</h3>
      <div className="cjm-edges">{engagements.map((edge: any) => <div className="cjm-edge" key={edge.id}><strong>{participant(edge.providerParticipantId)?.companyName || "—"}</strong><ArrowRight size={18}/><strong>{participant(edge.customerParticipantId)?.companyName || "—"}</strong>{edge.description && <small>{edge.description}</small>}</div>)}</div>
      <div className="cjm-form cjm-rel-form"><select aria-label={tt("Service provider", "Proveedor del servicio")} value={provider} onChange={(event) => setProvider(event.target.value)}><option value="">{tt("Who provides the work?", "¿Quién presta el trabajo?")}</option>{participants.map((item:any)=><option key={item.id} value={item.id}>{item.companyName}</option>)}</select><select aria-label={tt("Customer company", "Empresa cliente")} value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="">{tt("Who receives the work?", "¿Quién recibe el trabajo?")}</option>{participants.map((item:any)=><option key={item.id} value={item.id}>{item.companyName}</option>)}</select><input aria-label={tt("Relationship scope", "Alcance de la relación")} placeholder={tt("What are they providing?", "¿Qué están prestando?")} value={description} onChange={(event) => setDescription(event.target.value)}/><button type="button" onClick={addRelationship}><Plus size={14}/>{tt("Connect", "Conectar")}</button></div>
    </>}
  </section>;
}
