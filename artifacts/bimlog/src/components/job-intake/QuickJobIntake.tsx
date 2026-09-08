import { Check, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

type Props = {
  data: any;
  setData: Dispatch<SetStateAction<any>>;
  companies: Array<{ id: number; name: string }>;
  contacts: Array<{ id: string | number; companyId?: number | null; fullName?: string | null; email?: string | null }>;
  defaultRate: string;
  defaultApuVersion: number | null;
  projectId: number;
  tt: (en: string, es: string) => string;
  onAdvanced: () => void;
};

const value = (input: unknown) => String(input ?? "").trim();

export function QuickJobIntake(props: Props) {
  const { data, setData, companies, contacts, defaultRate, defaultApuVersion, projectId, tt, onAdvanced } = props;
  const stepKey = `bimlog:job-intake-quick-step:${projectId}`;
  const [step, setStepState] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(stepKey));
      return Number.isInteger(saved) && saved >= 0 && saved <= 2 ? saved : 0;
    } catch {
      return 0;
    }
  });
  const setStep = (next: number | ((current: number) => number)) =>
    setStepState((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      try { window.localStorage.setItem(stepKey, String(resolved)); } catch { /* Navigation remains usable without browser storage. */ }
      return resolved;
    });
  const primary = data.commercial?.contracts?.[0] ?? {};
  const firstItem = data.scopeItems?.[0] ?? {};
  const ready = useMemo(
    () => [
      Boolean(value(data.identity?.jobName) && value(data.identity?.jobCode)),
      Boolean(value(data.identity?.clientCompany) && value(firstItem.name) && Number(firstItem.plannedHours) > 0),
      Boolean(value(data.identity?.jobName) && value(data.identity?.clientCompany) && value(firstItem.name)),
    ],
    [data.identity, firstItem],
  );

  const patchIdentity = (patch: Record<string, unknown>) =>
    setData((old: any) => ({ ...old, identity: { ...old.identity, ...patch } }));

  const selectCustomer = (companyIdText: string) =>
    setData((old: any) => {
      const selected = companies.find((company) => company.id === Number(companyIdText));
      const company = selected?.name || "";
      const contracts = [...(old.commercial?.contracts ?? [])];
      contracts[0] = { ...contracts[0], counterpartyName: company };
      return {
        ...old,
        identity: { ...old.identity, clientCompanyId: selected?.id ?? null, clientCompany: company, clientName: company, primaryContactId: null, primaryContact: "" },
        commercial: { ...old.commercial, counterpartyName: company, contracts },
        review: { ...old.review, contractConfirmed: false },
      };
    });

  const patchFirstItem = (patch: Record<string, unknown>) =>
    setData((old: any) => {
      const existing = old.scopeItems?.[0] ?? {
        id: `CI-${crypto.randomUUID()}`,
        name: "",
        description: "",
        plannedHours: "1",
        billingHourlyRate: defaultRate || "0",
        unit: "Hours",
        apuPlanVersion: defaultApuVersion,
        workflowTemplate: old.delivery?.workflowTemplate || "bim-submittal",
        contractId: old.commercial?.contracts?.[0]?.id || "PRIMARY",
        provenance: null,
      };
      return {
        ...old,
        scopeItems: [{ ...existing, ...patch }, ...(old.scopeItems ?? []).slice(1)],
        review: { ...old.review, scopeConfirmed: false, pricingConfirmed: false },
      };
    });

  return (
    <section className="ji-quick" aria-label={tt("Quick Job Intake", "Ingreso rápido del trabajo")}>
      <div className="ji-quick-head">
        <div>
          <span className="ji-quick-kicker">{tt("Two-minute start", "Inicio en dos minutos")}</span>
          <h2>{tt("Start with only what you know now", "Comience solo con lo que sabe ahora")}</h2>
          <p>{tt("Three short sections create the saved Intake draft. Contracts, APUs, documents, delivery, and staffing remain available in Advanced setup.", "Tres secciones breves crean el borrador guardado. Contratos, APUs, documentos, entrega y personal permanecen disponibles en Configuración avanzada.")}</p>
        </div>
        <button type="button" onClick={onAdvanced}><Settings2 size={16} />{tt("Advanced setup", "Configuración avanzada")}</button>
      </div>
      <div className="ji-quick-steps" aria-label={tt("Quick setup progress", "Progreso del inicio rápido")}>
        {[tt("Job", "Trabajo"), tt("Customer and scope", "Cliente y alcance"), tt("Review", "Revisión")].map((label, index) => (
          <button type="button" key={label} className={step === index ? "on" : ready[index] ? "done" : ""} onClick={() => setStep(index)}>
            <span>{ready[index] ? <Check size={13} /> : index + 1}</span>{label}
          </button>
        ))}
      </div>
      <div className="ji-quick-question">
        {step === 0 && <>
          <h3>{tt("What job are you starting?", "¿Qué trabajo está iniciando?")}</h3>
          <div className="ji-grid three">
            <label>{tt("Job name — required", "Nombre del trabajo — obligatorio")}<input autoFocus value={data.identity?.jobName || ""} onChange={(event) => patchIdentity({ jobName: event.target.value })} /></label>
            <label>{tt("Job code — required", "Código del trabajo — obligatorio")}<input value={data.identity?.jobCode || ""} onChange={(event) => patchIdentity({ jobCode: event.target.value })} /></label>
            <label>{tt("Location — optional", "Ubicación — opcional")}<input value={data.identity?.location || ""} onChange={(event) => patchIdentity({ location: event.target.value })} /></label>
          </div>
        </>}
        {step === 1 && <>
          <h3>{tt("Who hired you, and what is the first item of work?", "¿Quién lo contrató y cuál es la primera partida?")}</h3>
          <div className="ji-grid">
            <label>{tt("Customer company — required", "Empresa cliente — obligatoria")}<select autoFocus value={data.identity?.clientCompanyId || ""} onChange={(event) => selectCustomer(event.target.value)}><option value="">{tt("Select a project company", "Seleccione una empresa del proyecto")}</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
            <label>{tt("Customer contact — optional now", "Contacto del cliente — opcional ahora")}<select disabled={!data.identity?.clientCompanyId} value={data.identity?.primaryContactId || ""} onChange={(event) => { const contact=contacts.find((item)=>String(item.id)===event.target.value); patchIdentity({ primaryContactId: contact ? Number(contact.id) : null, primaryContact: contact?.fullName || "" }); }}><option value="">{tt("Select later", "Seleccionar después")}</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.fullName}{contact.email ? ` — ${contact.email}` : ""}</option>)}</select></label>
            <label>{tt("First Contract Item — required", "Primera Partida de Contrato — obligatoria")}<input value={firstItem.name || ""} onChange={(event) => patchFirstItem({ name: event.target.value, description: event.target.value })} /></label>
            <label>{tt("Quantity / planned hours — required", "Cantidad / horas planificadas — obligatoria")}<input inputMode="decimal" value={firstItem.plannedHours || ""} onChange={(event) => patchFirstItem({ plannedHours: event.target.value })} /></label>
          </div>
        </>}
        {step === 2 && <>
          <h3>{tt("Your Intake draft is ready to continue", "Su borrador está listo para continuar")}</h3>
          <div className="ji-quick-summary">
            <div><span>{tt("Job", "Trabajo")}</span><strong>{data.identity?.jobName || "—"} · {data.identity?.jobCode || "—"}</strong></div>
            <div><span>{tt("Customer", "Cliente")}</span><strong>{data.identity?.clientCompany || "—"}{data.identity?.primaryContact ? ` · ${data.identity.primaryContact}` : ""}</strong></div>
            <div><span>{tt("First item", "Primera partida")}</span><strong>{firstItem.name || "—"} · {firstItem.plannedHours || "0"} {firstItem.unit || "Hours"}</strong></div>
          </div>
          <p>{tt("BIMLog autosaves this draft. Continue in Advanced setup when you are ready to add contracts, APUs, documents, delivery details, or team assignments.", "BIMLog guarda automáticamente este borrador. Continúe en Configuración avanzada cuando esté listo para agregar contratos, APUs, documentos, detalles de entrega o asignaciones del equipo.")}</p>
          <button className="primary" type="button" disabled={!ready.slice(0, 2).every(Boolean)} onClick={onAdvanced}>{tt("Continue to full setup", "Continuar a la configuración completa")}<ChevronRight size={16} /></button>
        </>}
      </div>
      <div className="ji-quick-nav">
        <button type="button" disabled={step === 0} onClick={() => setStep((current) => current - 1)}><ChevronLeft size={16} />{tt("Back", "Atrás")}</button>
        <span>{tt(`Section ${step + 1} of 3`, `Sección ${step + 1} de 3`)}</span>
        <button className="primary" type="button" disabled={step === 2 || !ready[step]} onClick={() => setStep((current) => current + 1)}>{tt("Continue", "Continuar")}<ChevronRight size={16} /></button>
      </div>
    </section>
  );
}
