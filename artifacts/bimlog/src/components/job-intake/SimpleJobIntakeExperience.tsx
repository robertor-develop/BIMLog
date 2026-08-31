import { Check, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import React, { useMemo, useState } from "react";

type Translate = (en: string, es: string) => string;

type Props = {
  data: any;
  setData: React.Dispatch<React.SetStateAction<any>>;
  members: any[];
  defaultRate: string;
  tt: Translate;
  onAdvanced: () => void;
};

const questions = ["job", "customer", "scope", "agreement", "estimate", "team", "review"] as const;

function text(value: unknown) {
  return String(value ?? "").trim();
}

export function SimpleJobIntakeExperience({ data, setData, members, defaultRate, tt, onAdvanced }: Props) {
  const [step, setStep] = useState(0);
  const primary = data.commercial?.contracts?.[0] ?? {};
  const scope = data.scopeItems?.[0] ?? {};
  const assignment = data.team?.assignments?.[0] ?? {};
  const selectedMember = members.find((member) => Number(member.id) === Number(assignment.userId));
  const labels = [
    tt("The job", "El trabajo"), tt("Customer", "Cliente"), tt("Scope", "Alcance"),
    tt("Agreement", "Acuerdo"), tt("Estimate", "Estimado"), tt("Team", "Equipo"), tt("Review", "Revisión"),
  ];
  const readiness = useMemo(() => [
    Boolean(text(data.identity?.jobName) && text(data.identity?.jobCode)),
    Boolean(text(data.identity?.clientCompany) && text(data.identity?.primaryContact)),
    Boolean(text(scope.name)), Boolean(text(primary.counterpartyName)),
    Number(scope.plannedHours) > 0, Boolean(assignment.userId && text(assignment.role)),
    Boolean(data.review?.scopeConfirmed && data.review?.teamConfirmed),
  ], [assignment, data, primary, scope]);
  const patchIdentity = (field: string, value: unknown) => setData((old: any) => ({ ...old, identity: { ...old.identity, [field]: value } }));
  const patchPrimary = (patch: Record<string, unknown>) => setData((old: any) => {
    const contracts = [...(old.commercial?.contracts ?? [])];
    contracts[0] = { ...contracts[0], ...patch };
    return { ...old, commercial: { ...old.commercial, ...patch, contracts }, review: { ...old.review, contractConfirmed: false } };
  });
  const patchScope = (patch: Record<string, unknown>) => setData((old: any) => {
    const current = old.scopeItems?.[0] ?? {
      id: `CI-${crypto.randomUUID()}`, name: "", description: "", plannedHours: "1",
      billingHourlyRate: defaultRate || "0", unit: "Hours", apuPlanVersion: null,
      workflowTemplate: old.delivery?.workflowTemplate || "bim-submittal",
      contractId: old.commercial?.contracts?.[0]?.id || "PRIMARY", provenance: null,
    };
    const scopeItems = [{ ...current, ...patch }, ...(old.scopeItems ?? []).slice(1)];
    return { ...old, scopeItems, review: { ...old.review, scopeConfirmed: false, pricingConfirmed: false } };
  });
  const patchAssignment = (patch: Record<string, unknown>) => setData((old: any) => {
    const currentScope = old.scopeItems?.[0];
    const current = old.team?.assignments?.[0] ?? {
      id: `ASSIGN-${crypto.randomUUID()}`, userId: null, personName: "", role: "",
      employmentType: "employee", scopeItemId: currentScope?.id || "", plannedHours: currentScope?.plannedHours || "1", internalHourlyRate: "0",
    };
    const assignments = [{ ...current, scopeItemId: currentScope?.id || current.scopeItemId, ...patch }, ...(old.team?.assignments ?? []).slice(1)];
    return { ...old, team: { ...old.team, projectLeaderUserId: patch.userId ?? old.team?.projectLeaderUserId, assignments }, review: { ...old.review, teamConfirmed: false } };
  });
  const confirm = () => setData((old: any) => ({
    ...old,
    delivery: {
      ...old.delivery,
      submittalStrategy: old.delivery?.submittalStrategy || tt("Standard review and delivery workflow", "Flujo estándar de revisión y entrega"),
    },
    review: {
      ...old.review, sourceConfirmed: (old.documents?.length ?? 0) > 0 ? old.review.sourceConfirmed : false,
      scopeConfirmed: true, pricingConfirmed: true, contractConfirmed: true, deliveryConfirmed: true, teamConfirmed: true,
    },
  }));

  return <section className="ji-simple" aria-label={tt("Simple Job Intake", "Ingreso simple del trabajo")}>
    <div className="ji-simple-top"><div><span className="ji-simple-kicker">{tt("Two-minute setup", "Configuración en dos minutos")}</span><h2>{tt("Let’s create this job together", "Creemos este trabajo juntos")}</h2><p>{tt("Answer seven plain questions. BIMLog saves automatically and keeps the technical setup out of your way.", "Responda siete preguntas sencillas. BIMLog guarda automáticamente y mantiene la configuración técnica fuera de su camino.")}</p></div><button type="button" onClick={onAdvanced}><Settings2 size={16}/>{tt("Advanced setup", "Configuración avanzada")}</button></div>
    <ol className="ji-simple-steps">{labels.map((label, index) => <li key={label} className={index === step ? "on" : readiness[index] ? "done" : ""}><button type="button" onClick={() => setStep(index)}><span>{readiness[index] ? <Check size={13}/> : index + 1}</span>{label}</button></li>)}</ol>
    <div className="ji-simple-question">
      {step === 0 && <><h3>{tt("1. What job are you creating?", "1. ¿Qué trabajo está creando?")}</h3><p>{tt("Use the name people recognize and a short internal code. The site can be completed now or later.", "Use el nombre que las personas reconocen y un código interno corto. El sitio puede completarse ahora o después.")}</p><div className="ji-grid three"><label>{tt("Job name", "Nombre del trabajo")}<input autoFocus value={data.identity?.jobName || ""} onChange={(e) => patchIdentity("jobName", e.target.value)}/></label><label>{tt("Job code", "Código del trabajo")}<input value={data.identity?.jobCode || ""} onChange={(e) => patchIdentity("jobCode", e.target.value)}/></label><label>{tt("Job / site location (optional)", "Ubicación del trabajo / sitio (opcional)")}<input value={data.identity?.location || ""} onChange={(e) => patchIdentity("location", e.target.value)}/></label></div></>}
      {step === 1 && <><h3>{tt("2. Who hired you?", "2. ¿Quién lo contrató?")}</h3><p>{tt("Select the customer relationship for this agreement—not every company participating in the job.", "Indique la relación con el cliente para este acuerdo, no todas las empresas que participan en el trabajo.")}</p><div className="ji-grid"><label>{tt("Customer company", "Empresa cliente")}<input autoFocus value={data.identity?.clientCompany || ""} onChange={(e) => { patchIdentity("clientCompany", e.target.value); patchIdentity("clientName", e.target.value); patchPrimary({ counterpartyName: e.target.value, perspective: "upstream" }); }}/></label><label>{tt("Customer contact", "Contacto del cliente")}<input value={data.identity?.primaryContact || ""} onChange={(e) => patchIdentity("primaryContact", e.target.value)}/></label></div></>}
      {step === 2 && <><h3>{tt("3. What are they hiring you to do?", "3. ¿Para qué lo están contratando?")}</h3><p>{tt("Describe the first deliverable or service in everyday language. More scope items can be added later.", "Describa el primer entregable o servicio con lenguaje cotidiano. Puede agregar más partidas después.")}</p><label>{tt("Service or deliverable", "Servicio o entregable")}<input autoFocus value={scope.name || ""} placeholder={tt("Example: HVAC shop drawings", "Ejemplo: planos de taller HVAC")} onChange={(e) => patchScope({ name: e.target.value, description: e.target.value })}/></label></>}
      {step === 3 && <><h3>{tt("4. What kind of agreement is this?", "4. ¿Qué tipo de acuerdo es?")}</h3><p>{tt("Choose the best current description. You can add formal numbers and additional contracts later.", "Elija la mejor descripción actual. Puede agregar números formales y contratos adicionales después.")}</p><div className="ji-choice-grid">{[["quote",tt("Quote / proposal", "Cotización / propuesta")],["base",tt("Base contract", "Contrato base")],["additional",tt("Additional work", "Trabajo adicional")]].map(([value,label]) => <button type="button" key={value} className={primary.agreementKind === value ? "on" : ""} onClick={() => patchPrimary({ agreementKind: value, contractType: value === "base" ? "consultant_agreement" : "other_commitment" })}>{label}</button>)}</div></>}
      {step === 4 && <><h3>{tt("5. How should it be estimated?", "5. ¿Cómo debe estimarse?")}</h3><p>{tt("Start with planned hours. Advanced setup supports detailed APU methods, quantities, rates, and versions.", "Comience con horas planificadas. La configuración avanzada admite métodos APU detallados, cantidades, tarifas y versiones.")}</p><div className="ji-grid"><label>{tt("Planned hours", "Horas planificadas")}<input autoFocus type="number" min="0.01" step="0.25" value={scope.plannedHours || ""} onChange={(e) => patchScope({ plannedHours: e.target.value })}/></label><label>{tt("Customer hourly rate", "Tarifa horaria al cliente")}<input type="number" min="0" step="0.01" value={scope.billingHourlyRate || defaultRate || "0"} onChange={(e) => patchScope({ billingHourlyRate: e.target.value })}/></label></div><small>{tt("This rate is a visible starting value, not financial approval.", "Esta tarifa es un valor inicial visible, no una aprobación financiera.")}</small></>}
      {step === 5 && <><h3>{tt("6. Who will work on it?", "6. ¿Quién trabajará en esto?")}</h3><p>{tt("Choose one starting team member and role. More people, companies, floors, and tasks can be assigned later.", "Elija un miembro inicial y su función. Puede asignar más personas, empresas, pisos y tareas después.")}</p><div className="ji-grid"><label>{tt("Team member", "Miembro del equipo")}<select autoFocus value={assignment.userId ?? ""} onChange={(e) => { const member = members.find((item) => String(item.id) === e.target.value); patchAssignment({ userId: member ? Number(member.id) : null, personName: member?.name || member?.email || "" }); }}><option value="">{tt("Select a BIMLog member", "Seleccione un miembro de BIMLog")}</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}</select></label><label>{tt("Role on this scope", "Función en este alcance")}<input value={assignment.role || ""} placeholder={tt("Example: BIM Coordinator", "Ejemplo: Coordinador BIM")} onChange={(e) => patchAssignment({ role: e.target.value, plannedHours: scope.plannedHours || "1" })}/></label></div></>}
      {step === 6 && <><h3>{tt("7. Is this summary correct?", "7. ¿Este resumen es correcto?")}</h3><div className="ji-summary"><div><span>{tt("Job", "Trabajo")}</span><strong>{data.identity?.jobName || "—"}</strong></div><div><span>{tt("Customer", "Cliente")}</span><strong>{data.identity?.clientCompany || "—"}</strong></div><div><span>{tt("Scope", "Alcance")}</span><strong>{scope.name || "—"}</strong></div><div><span>{tt("Estimate", "Estimado")}</span><strong>{scope.plannedHours || "0"}h × {scope.billingHourlyRate || "0"} {data.identity?.currency || "USD"}</strong></div><div><span>{tt("Starting team", "Equipo inicial")}</span><strong>{selectedMember?.name || selectedMember?.email || "—"} · {assignment.role || "—"}</strong></div></div><button type="button" className="primary" disabled={!readiness.slice(0,6).every(Boolean)} onClick={confirm}><Check size={16}/>{tt("Yes—mark setup reviewed", "Sí—marcar configuración revisada")}</button></>}
    </div>
    <div className="ji-simple-nav"><button type="button" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ChevronLeft size={16}/>{tt("Back", "Atrás")}</button><span>{tt(`Question ${step + 1} of 7`, `Pregunta ${step + 1} de 7`)}</span><button type="button" className="primary" disabled={step === 6} onClick={() => setStep((value) => value + 1)}>{tt("Continue", "Continuar")}<ChevronRight size={16}/></button></div>
  </section>;
}
