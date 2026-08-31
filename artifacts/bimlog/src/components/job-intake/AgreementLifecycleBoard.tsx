import React from "react";
import { ArrowRight, FileSignature, Link2, Plus, Trash2 } from "lucide-react";

type Translate = (en: string, es: string) => string;
type Props = { data: any; setData: React.Dispatch<React.SetStateAction<any>>; tt: Translate };

const kinds = ["quote", "base", "change_order", "addition", "amendment"];
const statuses = ["draft", "proposed", "sent", "negotiating", "accepted", "active", "rejected", "superseded", "cancelled", "completed"];
const childKinds = new Set(["change_order", "addition", "amendment"]);

export function AgreementLifecycleBoard({ data, setData, tt }: Props) {
  const contracts = data.commercial?.contracts ?? [];
  const participants = data.relationships?.participants ?? [];
  const engagements = data.relationships?.engagements ?? [];
  const participant = (id: string) => participants.find((item: any) => item.id === id);
  const relationshipLabel = (id: string) => {
    const edge = engagements.find((item: any) => item.id === id);
    if (!edge) return tt("Relationship not selected", "Relación no seleccionada");
    return `${participant(edge.providerParticipantId)?.companyName || "—"} → ${participant(edge.customerParticipantId)?.companyName || "—"}`;
  };
  const kindLabel = (value: string) => ({ quote: tt("Quote / proposal", "Cotización / propuesta"), base: tt("Base contract", "Contrato base"), additional: tt("Additional work (legacy)", "Trabajo adicional (anterior)"), change_order: tt("Change order", "Orden de cambio"), addition: tt("Addition / extra work", "Adición / trabajo extra"), amendment: tt("Amendment", "Enmienda") } as Record<string, string>)[value] || value;
  const statusLabel = (value: string) => ({ draft: tt("Draft", "Borrador"), proposed: tt("Proposed", "Propuesto"), sent: tt("Sent", "Enviado"), negotiating: tt("Negotiating", "En negociación"), accepted: tt("Accepted", "Aceptado"), active: tt("Active", "Activo"), rejected: tt("Rejected", "Rechazado"), superseded: tt("Superseded", "Reemplazado"), cancelled: tt("Cancelled", "Cancelado"), completed: tt("Completed", "Completado") } as Record<string, string>)[value] || value;
  const updateContracts = (next: any[]) => setData((old: any) => ({
    ...old,
    commercial: {
      ...old.commercial,
      contracts: next,
      ...(next[0] ? {
        quotationNumber: next[0].quotationNumber || "",
        contractNumber: next[0].contractNumber || "",
        counterpartyName: next[0].counterpartyName || "",
        perspective: next[0].perspective || "downstream",
        contractType: next[0].contractType || "subcontract",
        paymentTerms: next[0].paymentTerms || "",
        effectiveDate: next[0].effectiveDate || "",
        completionDate: next[0].completionDate || "",
      } : {}),
    },
    review: { ...old.review, contractConfirmed: false },
  }));
  const patch = (id: string, values: Record<string, unknown>) => updateContracts(contracts.map((item: any) => item.id === id ? { ...item, ...values } : item));
  const add = () => {
    if (contracts.length >= 50) return;
    updateContracts([...contracts, { id: `CONTRACT-${crypto.randomUUID()}`, title: "", quotationNumber: "", contractNumber: "", counterpartyName: "", perspective: "downstream", agreementKind: "quote", status: "draft", engagementId: engagements[0]?.id || "", parentContractId: "", contractType: "other_commitment", paymentTerms: "", effectiveDate: "", completionDate: "" }]);
  };
  const remove = (id: string) => {
    if ((data.scopeItems ?? []).some((item: any) => item.contractId === id) || contracts.some((item: any) => item.parentContractId === id)) return;
    updateContracts(contracts.filter((item: any) => item.id !== id));
  };

  return <section className="alb" aria-label={tt("Agreement lifecycle", "Ciclo de acuerdos")}>
    <style>{`.alb{background:#fff;border:1px solid #dbe6e3;border-radius:18px;padding:22px;margin:18px 0;color:#102f35}.alb *{box-sizing:border-box}.alb-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.alb h2,.alb h3{margin:0}.alb p{color:#526b70}.alb-summary{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.alb-pill{padding:6px 10px;background:#e8f7f2;border-radius:999px;font-size:12px;font-weight:700}.alb-list{display:grid;gap:12px}.alb-card{border:1px solid #cddbd8;border-radius:14px;padding:15px;background:#fbfdfc}.alb-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.alb-title{display:flex;gap:9px;align-items:flex-start}.alb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.alb label{display:grid;gap:5px;font-size:12px;font-weight:700}.alb input,.alb select,.alb button{border:1px solid #b9cbc7;border-radius:9px;padding:9px;background:#fff;color:#102f35;min-width:0}.alb button{cursor:pointer;display:inline-flex;align-items:center;gap:6px}.alb .primary{background:#087f68;border-color:#087f68;color:#fff;font-weight:800}.alb .danger{color:#a33;padding:6px}.alb-binding{display:flex;align-items:center;gap:8px;margin-top:10px;padding:9px;background:#eef7f4;border-radius:9px;font-size:12px}.alb-warning{color:#9a5a00;background:#fff4dc;padding:8px;border-radius:8px;margin-top:9px;font-size:12px}.alb-number-note{font-size:11px;color:#667d81;margin-top:5px}.alb-empty{text-align:center;padding:28px;border:1px dashed #a9c4bd;border-radius:12px}@media(max-width:700px){.alb{padding:14px}.alb-head,.alb-card-head{display:block}.alb-grid{grid-template-columns:1fr}.alb .danger{margin-top:8px}.alb-binding{align-items:flex-start}}`}</style>
    <div className="alb-head"><div><span className="ji-simple-kicker">{tt("One relationship · clear agreements", "Una relación · acuerdos claros")}</span><h2><FileSignature size={21}/> {tt("What has been proposed or agreed?", "¿Qué se propuso o acordó?")}</h2><p>{tt("Connect every quote or agreement to the companies it belongs to. Numbers stay blank until a person enters the real number.", "Conecte cada cotización o acuerdo con las empresas correspondientes. Los números quedan vacíos hasta que una persona ingrese el número real.")}</p></div><button type="button" className="primary" onClick={add}><Plus size={15}/>{tt("Add agreement", "Agregar acuerdo")}</button></div>
    <div className="alb-summary"><span className="alb-pill">{contracts.length} {tt("agreements", "acuerdos")}</span><span className="alb-pill">{contracts.filter((item:any)=>item.engagementId).length} {tt("relationship-bound", "vinculados")}</span><span className="alb-pill">{contracts.filter((item:any)=>childKinds.has(item.agreementKind)).length} {tt("changes / additions", "cambios / adiciones")}</span></div>
    {!contracts.length ? <div className="alb-empty"><h3>{tt("No agreements yet", "Aún no hay acuerdos")}</h3><p>{tt("Start with a quote or base contract. You do not need a legal number to save a draft.", "Comience con una cotización o contrato base. No necesita un número legal para guardar un borrador.")}</p></div> : <div className="alb-list">{contracts.map((contract:any,index:number)=>{
      const needsParent = childKinds.has(contract.agreementKind);
      const canRemove = index > 0 && !(data.scopeItems ?? []).some((item:any)=>item.contractId===contract.id) && !contracts.some((item:any)=>item.parentContractId===contract.id);
      return <article className="alb-card" key={contract.id}>
        <div className="alb-card-head"><div className="alb-title"><FileSignature size={18}/><div><h3>{contract.title || kindLabel(contract.agreementKind)}</h3><span>{kindLabel(contract.agreementKind)} · {statusLabel(contract.status || "draft")}</span></div></div>{canRemove && <button type="button" className="danger" onClick={()=>remove(contract.id)} aria-label={tt("Remove agreement", "Eliminar acuerdo")}><Trash2 size={14}/>{tt("Remove", "Eliminar")}</button>}</div>
        <div className="alb-grid">
          <label>{tt("Agreement name", "Nombre del acuerdo")}<input value={contract.title || ""} placeholder={tt("Example: HVAC coordination proposal", "Ejemplo: Propuesta de coordinación HVAC")} onChange={e=>patch(contract.id,{title:e.target.value})}/></label>
          <label>{tt("Agreement type", "Tipo de acuerdo")}<select value={contract.agreementKind || "base"} onChange={e=>patch(contract.id,{agreementKind:e.target.value,parentContractId:childKinds.has(e.target.value)?contract.parentContractId || "":""})}>{kinds.map(value=><option key={value} value={value}>{kindLabel(value)}</option>)}</select></label>
          <label>{tt("Current status", "Estado actual")}<select value={contract.status || "draft"} onChange={e=>patch(contract.id,{status:e.target.value})}>{statuses.map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
          <label>{tt("Provider → customer", "Proveedor → cliente")}<select value={contract.engagementId || ""} onChange={e=>{const edge=engagements.find((item:any)=>item.id===e.target.value);patch(contract.id,{engagementId:e.target.value,counterpartyName:edge ? participant(edge.customerParticipantId)?.companyName || "" : ""});}}><option value="">{tt("Select relationship", "Seleccione la relación")}</option>{engagements.map((edge:any)=><option key={edge.id} value={edge.id}>{relationshipLabel(edge.id)}</option>)}</select></label>
          {needsParent && <label>{tt("Changes which agreement?", "¿Qué acuerdo modifica?")}<select value={contract.parentContractId || ""} onChange={e=>patch(contract.id,{parentContractId:e.target.value})}><option value="">{tt("Select parent agreement", "Seleccione el acuerdo principal")}</option>{contracts.filter((item:any)=>item.id!==contract.id && !childKinds.has(item.agreementKind)).map((item:any)=><option key={item.id} value={item.id}>{item.title || kindLabel(item.agreementKind)}</option>)}</select></label>}
          <label>{contract.agreementKind === "quote" ? tt("Quotation number (optional)", "Número de cotización (opcional)") : tt("Contract / PO number (optional)", "Número de contrato / OC (opcional)")}<input value={(contract.agreementKind === "quote" ? contract.quotationNumber : contract.contractNumber) || ""} onChange={e=>patch(contract.id,contract.agreementKind === "quote" ? {quotationNumber:e.target.value}:{contractNumber:e.target.value})}/><span className="alb-number-note">{tt("BIMLog never generates a legal number here.", "BIMLog nunca genera un número legal aquí.")}</span></label>
        </div>
        <div className="alb-binding"><Link2 size={14}/><strong>{relationshipLabel(contract.engagementId)}</strong>{contract.parentContractId && <><ArrowRight size={14}/><span>{tt("changes", "modifica")} {contracts.find((item:any)=>item.id===contract.parentContractId)?.title || kindLabel(contracts.find((item:any)=>item.id===contract.parentContractId)?.agreementKind)}</span></>}</div>
        {!contract.engagementId && <div className="alb-warning">{tt("Choose the provider/customer relationship before activation.", "Seleccione la relación proveedor/cliente antes de activar.")}</div>}
        {needsParent && !contract.parentContractId && <div className="alb-warning">{tt("Choose the base agreement this change or addition belongs to.", "Seleccione el acuerdo base al que pertenece este cambio o adición.")}</div>}
      </article>;
    })}</div>}
  </section>;
}
