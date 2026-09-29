import React from "react";
import { exactProduct } from "./ContractItemBulkEditor";
type Props = { assignments: any[]; scopeItems: any[]; currency: string; budgetEnabled: boolean; canReleaseLegacyAssignment?: boolean; tt: (en: string, es: string) => string; onChange: (rows: any[]) => void };
export function GenericResourcePlan({ assignments, scopeItems, currency, budgetEnabled, canReleaseLegacyAssignment = false, tt, onChange }: Props) {
 const update = (id: string, patch: any) => onChange(assignments.map(row => row.id === id ? {...row, ...patch} : row));
 return <div>
  <p>{tt("Plan the work by role without choosing employees. This is an optional estimate, not an approved employee pay rate. Assign people later in Job Operations when staffing is known.", "Planifique el trabajo por rol sin elegir empleados. Es una estimación opcional, no una tarifa salarial aprobada. Asigne personas después en Operaciones cuando conozca el personal disponible.")}</p>
  {assignments.length === 0 && <p role="status">{tt("No resource budget yet. You can activate with staffing pending.", "Aún no hay presupuesto de recursos. Puede activar con personal pendiente.")}</p>}
  {assignments.map((row, index) => row.userId != null || row.personName ? <div className="ji-row" key={row.id}>
    <strong>{tt("Existing assignment preserved", "Asignación existente conservada")}: {row.personName || tt("Project member", "Miembro del proyecto")}</strong>
    <p>{row.role} · {row.plannedHours}h · {tt("Manage named assignments in Job Operations.", "Administre las asignaciones de personas en Operaciones.")}</p>
    {canReleaseLegacyAssignment && <button type="button" onClick={() => update(row.id, {userId:null,personName:""})}>{tt("Leave staffing pending; keep this plan", "Dejar personal pendiente; conservar este plan")}</button>}
   </div> : <div className="ji-row" key={row.id}>
    <div className="ji-grid three">
     <label>{tt("Planned role", "Rol previsto")}<input aria-label={tt(`Planned role ${index + 1}`, `Rol previsto ${index + 1}`)} value={row.role} placeholder={tt("e.g. BIM coordinator", "p. ej. Coordinador BIM")} onChange={event => update(row.id, {role:event.target.value})}/></label>
     <label>{tt("Scope item", "Partida")}<select value={row.scopeItemId} onChange={event => { const scope = scopeItems.find(item => item.id === event.target.value); update(row.id, {scopeItemId: event.target.value, contractId: scope?.contractId || 'PRIMARY', assignmentTargetType:'contract_item', workPackageId:'', workPackageTaskId:''}); }}><option value="">{tt("Choose scope item", "Elija una partida")}</option>{scopeItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
     <label>{tt("Planned hours", "Horas previstas")}<input inputMode="decimal" value={row.plannedHours} onChange={event => update(row.id, {plannedHours:event.target.value})}/></label>
     {budgetEnabled && <><label>{tt("Estimated internal cost / hour", "Costo interno estimado / hora")}<input inputMode="decimal" value={row.internalHourlyRate} onChange={event => update(row.id, {internalHourlyRate:event.target.value})}/></label>
     <label>{tt("Planned labor cost", "Costo laboral previsto")}<output>{exactProduct(row.plannedHours, row.internalHourlyRate)} {currency}</output></label></>}
    </div>
    {row.workPackageId && <p>{tt("Existing location / task link preserved", "Vínculo existente de ubicación / tarea conservado")}: {row.workPackageId}</p>}
    <button type="button" onClick={() => onChange(assignments.filter(item => item.id !== row.id))}>{tt("Remove planned role", "Eliminar rol previsto")}</button>
   </div>)}
  <button type="button" disabled={!scopeItems.length} onClick={() => onChange([...assignments, {id:crypto.randomUUID(), userId:null, personName:"", role:"", scopeItemId:scopeItems[0]?.id || "", contractId:scopeItems[0]?.contractId || "PRIMARY", assignmentTargetType:"contract_item", workPackageId:"", workPackageTaskId:"", employmentType:"employee", plannedHours:"0", internalHourlyRate:"0"}])}>{tt("Add planned role", "Agregar rol previsto")}</button>
 </div>;
}
