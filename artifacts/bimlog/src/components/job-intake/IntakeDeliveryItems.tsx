import React from "react";
import { intakeWorkflowPreview } from "../../lib/intake-workflow-preview-selection";
type Props = {
  items: any[];
  setItems: (updater: (items: any[]) => any[]) => void;
  defaultWorkflow: string;
  deliveryWorkflowOptions?: Array<{ versionId: string; name: string; source: string; version: number;
    governancePolicy?: { code: string; version: number } | null;
    activationBlock?: { code: string; message: string } | null;
    definition: { deliverableTypes: string[]; phases: Array<{ name: string; tasks: unknown[] }> } }>;
  deliveryWorkflowMode?: "approved_only" | "defaults_allowed";
  tt: (en: string, es: string) => string;
};
export function IntakeDeliveryItems(props: Props) {
 const update = (index: number, patch: any) => props.setItems(items => items.map((item, i) => i === index ? {...item, ...patch} : item));
 return <div><p>{props.tt("Choose a delivery type and a published workflow for each scope item. Saved choices are retained until you explicitly replace them. Add buildings, floors or zones below; employees can be assigned later.", "Elija un tipo de entrega y un flujo publicado por partida. Las selecciones guardadas se conservan hasta reemplazarlas expresamente. Agregue edificios, pisos o zonas abajo; el personal se puede asignar después.")}</p>
 {props.items.length === 0 && <p role="status">{props.tt("Add a scope item in step 3 before configuring its delivery.", "Agregue una partida en el paso 3 antes de configurar su entrega.")}</p>}
 {props.items.map((item, index) => <div className="ji-row" key={item.id}><h3>{item.name || props.tt("Untitled scope item", "Partida sin título")}</h3><div className="ji-grid three">
              <label>
                {props.tt("Workflow", "Flujo")}
                <select
                  value={item.workflowTemplate || props.defaultWorkflow}
                  aria-label={props.tt(
                    `Workflow row ${index + 1}`,
                    `Flujo fila ${index + 1}`,
                  )}
                  onChange={(event) =>
                    update(index, { workflowTemplate: event.target.value })
                  }
                >
                  <option value="generic">
                    {props.tt(
                      "Generic configurable workflow",
                      "Flujo genérico configurable",
                    )}
                  </option>
                  <option value="bim-submittal">
                    {props.tt(
                      "BIM delivery (display alias: Submittal)",
                      "Entrega BIM (alias visible: Submittal)",
                    )}
                  </option>
                </select>
              </label>
              <label>
                {props.tt("Deliverable type", "Tipo de entregable")}
                <select value={item.deliverableType || "GENERAL"} onChange={event => update(index, { deliverableType: event.target.value, deliveryWorkflowVersionId: "" })}>
                  <option value="GENERAL">{props.tt("General", "General")}</option>
                  <option value="SHOP_DRAWING">{props.tt("Shop drawing", "Plano de taller")}</option>
                  <option value="SLEEVE">{props.tt("Sleeve", "Sleeve")}</option>
                </select>
              </label>
              <label>
                {props.tt("Delivery Workflow version", "Versión del flujo de entrega")}
                <select value={item.deliveryWorkflowVersionId || ""} onChange={event => update(index, { deliveryWorkflowVersionId: event.target.value })}>
                  <option value="">{props.tt("Auto-select when exactly one is applicable", "Selección automática si solo hay una opción aplicable")}</option>
                  {item.deliveryWorkflowVersionId && intakeWorkflowPreview(props.deliveryWorkflowOptions ?? [], item.deliverableType || "GENERAL", item.deliveryWorkflowVersionId).unavailableSavedVersion && <option value={item.deliveryWorkflowVersionId}>{props.tt("Saved version unavailable — select a replacement", "Versión guardada no disponible — seleccione un reemplazo")}</option>}
                  {(props.deliveryWorkflowOptions ?? []).filter(option => option.definition.deliverableTypes.includes(item.deliverableType || "GENERAL")).map(option => <option key={option.versionId} value={option.versionId}>{option.name} · v{option.version} · {option.source === "company" ? props.tt("Company", "Empresa") : "BIMLog"}{option.activationBlock ? ` · ${props.tt("Blocked by policy", "Bloqueado por política")}` : ""}</option>)}
                </select>
                {(() => { const { matches, selected, unavailableSavedVersion } = intakeWorkflowPreview(props.deliveryWorkflowOptions ?? [], item.deliverableType || "GENERAL", item.deliveryWorkflowVersionId || ""); if (unavailableSavedVersion) return <small role="alert">{props.tt("The saved workflow version is no longer available for this deliverable. Its saved identity is preserved; explicitly choose a current version before activation. No replacement has been selected automatically.", "La versión guardada del flujo ya no está disponible para este entregable. Se conserva su identidad; elija expresamente una versión vigente antes de activar. No se ha seleccionado ningún reemplazo automáticamente.")}</small>; return selected ? <>
                  <small>{selected.definition.phases.map(phase => `${phase.name} (${phase.tasks.length})`).join(" → ")}</small>
                  <small>{selected.governancePolicy ? `${props.tt("Published company Governance Policy", "Política de gobernanza empresarial publicada")}: ${selected.governancePolicy.code} · v${selected.governancePolicy.version}` : props.tt("No published company Governance Policy applies to this workflow.", "Ninguna política de gobernanza empresarial publicada aplica a este flujo.")}</small>
                  {selected.activationBlock && <small role="alert">{props.tt("Activation blocked by published Governance Policy", "Activación bloqueada por la política de gobernanza publicada")}: {selected.activationBlock.code}</small>}
                </> : <small role="alert">{props.deliveryWorkflowMode === "approved_only" && matches.length === 0 ? props.tt("Company PMO must publish a matching workflow before activation.", "PMO debe publicar un flujo compatible antes de activar.") : props.tt("Select one company workflow before activation.", "Seleccione un flujo de empresa antes de activar.")}</small>; })()}
              </label>

</div></div>)}
</div>;
}
